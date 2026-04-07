import { Hono } from "hono";
import { describeRoute, resolver, validator } from "hono-openapi";
import { and, gt, eq, isNull, asc } from "drizzle-orm";
import { z } from "zod";

import { UpcomingEventsResponseSchema } from "@snc/shared";

import { db } from "../db/connection.js";
import { calendarEvents } from "../db/schema/calendar.schema.js";
import { creatorProfiles } from "../db/schema/creator.schema.js";
import { toISO, toISOOrNull } from "../lib/response-helpers.js";

// ── Query Schema ──

const UpcomingEventsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(20).default(5),
});

// ── Routes ──

/** Public upcoming events for the landing page. No auth required. */
const upcomingEventsRoutes = new Hono();

upcomingEventsRoutes.get(
  "/",
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
    }));

    return c.json({ items });
  },
);

export { upcomingEventsRoutes };
