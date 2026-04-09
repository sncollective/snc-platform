import { Hono } from "hono";
import { describeRoute, resolver, validator } from "hono-openapi";
import { and, gt, eq, isNull, asc } from "drizzle-orm";
import { z } from "zod";

import { UpcomingEventsResponseSchema } from "@snc/shared";

import { db } from "../db/connection.js";
import { calendarEvents } from "../db/schema/calendar.schema.js";
import { creatorProfiles } from "../db/schema/creator.schema.js";
import { toISO, toISOOrNull } from "../lib/response-helpers.js";
import { optionalAuth } from "../middleware/optional-auth.js";
import type { OptionalAuthEnv } from "../middleware/optional-auth.js";
import { requireAuth } from "../middleware/require-auth.js";
import type { AuthEnv } from "../middleware/auth-env.js";
import { ERROR_401, ERROR_404 } from "../lib/openapi-errors.js";
import { toggleReminder, getUserReminders } from "../services/event-reminder.js";

// ── Query Schema ──

const UpcomingEventsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(20).default(5),
});

const EventIdParam = z.object({ eventId: z.string().min(1) });

const RemindResponseSchema = z.object({ reminded: z.boolean() });

// ── Routes ──

const upcomingEventsRoutes = new Hono<OptionalAuthEnv & AuthEnv>();

/** Public upcoming events for the landing page. Optionally enriched with reminder status. */
upcomingEventsRoutes.get(
  "/",
  optionalAuth,
  describeRoute({
    description: "List upcoming public events (no auth required)",
    tags: ["events"],
    responses: {
      200: {
        description: "Upcoming public events",
        content: {
          "application/json": { schema: resolver(UpcomingEventsResponseSchema) },
        },
      },
    },
  }),
  validator("query", UpcomingEventsQuerySchema),
  async (c) => {
    const { limit } = c.req.valid("query" as never) as { limit: number };

    const rows = await db
      .select({
        event: calendarEvents,
        creatorName: creatorProfiles.displayName,
      })
      .from(calendarEvents)
      .leftJoin(creatorProfiles, eq(calendarEvents.creatorId, creatorProfiles.id))
      .where(
        and(
          eq(calendarEvents.visibility, "public"),
          gt(calendarEvents.startAt, new Date()),
          isNull(calendarEvents.deletedAt),
        ),
      )
      .orderBy(asc(calendarEvents.startAt))
      .limit(limit);

    const user = c.get("user");
    const eventIds = rows.map(({ event: row }) => row.id);
    const remindedSet = user
      ? await getUserReminders(user.id, eventIds)
      : new Set<string>();

    const items = rows.map(({ event: row, creatorName }) => ({
      id: row.id,
      title: row.title,
      description: row.description,
      startAt: toISO(row.startAt),
      endAt: toISOOrNull(row.endAt),
      allDay: row.allDay,
      eventType: row.eventType,
      location: row.location,
      creatorId: row.creatorId ?? null,
      creatorName: creatorName ?? null,
      reminded: remindedSet.has(row.id),
    }));

    return c.json({ items });
  },
);

/** Toggle a reminder for an upcoming event. */
upcomingEventsRoutes.post(
  "/:eventId/remind",
  requireAuth,
  describeRoute({
    description: "Toggle a reminder for a calendar event",
    tags: ["events"],
    responses: {
      200: {
        description: "Reminder toggled",
        content: {
          "application/json": { schema: resolver(RemindResponseSchema) },
        },
      },
      401: ERROR_401,
      404: ERROR_404,
    },
  }),
  validator("param", EventIdParam),
  async (c) => {
    const { eventId } = c.req.valid("param");
    const user = c.get("user");

    const result = await toggleReminder(user.id, eventId);
    if (!result.ok) throw result.error;

    return c.json(result.value);
  },
);

export { upcomingEventsRoutes };
