import { randomUUID } from "node:crypto";

import { Hono } from "hono";
import { describeRoute, resolver } from "hono-openapi";
import { eq, and, gte, lte, asc, isNull } from "drizzle-orm";
import ical, { ICalCalendarMethod, ICalEventStatus } from "ical-generator";

import {
  FeedTokenResponseSchema,
  NotFoundError,
} from "@snc/shared";

import { db } from "../db/connection.js";
import {
  calendarEvents,
  calendarFeedTokens,
} from "../db/schema/calendar.schema.js";
import { creatorProfiles } from "../db/schema/creator.schema.js";
import { requireAuth } from "../middleware/require-auth.js";
import { requireRole } from "../middleware/require-role.js";
import type { AuthEnv } from "../middleware/auth-env.js";
import {
  ERROR_401,
  ERROR_403,
  ERROR_404,
} from "../lib/openapi-errors.js";
import { getFrontendBaseUrl } from "../lib/route-utils.js";

// ── Private Helpers ──

const buildFeedUrl = (token: string): string => {
  const baseUrl = getFrontendBaseUrl();
  return `${baseUrl}/api/calendar/feed.ics?token=${token}`;
};

// ── Public API ──

/** Calendar iCal feed token management and .ics generation. */
export const calendarFeedRoutes = new Hono<AuthEnv>();

// ── POST /feed-token — Generate feed token ──

calendarFeedRoutes.post(
  "/feed-token",
  requireAuth,
  requireRole("stakeholder"),
  describeRoute({
    description: "Generate a new .ics feed token (replaces existing)",
    tags: ["calendar"],
    responses: {
      200: {
        description: "Feed token and URL",
        content: {
          "application/json": {
            schema: resolver(FeedTokenResponseSchema),
          },
        },
      },
      401: ERROR_401,
      403: ERROR_403,
    },
  }),
  async (c) => {
    const user = c.get("user");
    const token = randomUUID();

    // Delete existing tokens for this user
    await db
      .delete(calendarFeedTokens)
      .where(eq(calendarFeedTokens.userId, user.id));

    // Create new token
    await db.insert(calendarFeedTokens).values({
      id: randomUUID(),
      userId: user.id,
      token,
    });

    const url = buildFeedUrl(token);

    return c.json({ token, url });
  },
);

// ── GET /feed-token — Get existing feed token ──

calendarFeedRoutes.get(
  "/feed-token",
  requireAuth,
  requireRole("stakeholder"),
  describeRoute({
    description: "Get the current user's .ics feed token",
    tags: ["calendar"],
    responses: {
      200: {
        description: "Feed token and URL",
        content: {
          "application/json": {
            schema: resolver(FeedTokenResponseSchema),
          },
        },
      },
      401: ERROR_401,
      403: ERROR_403,
      404: ERROR_404,
    },
  }),
  async (c) => {
    const user = c.get("user");

    const [existing] = await db
      .select()
      .from(calendarFeedTokens)
      .where(eq(calendarFeedTokens.userId, user.id));

    if (!existing) {
      throw new NotFoundError("No feed token found");
    }

    const url = buildFeedUrl(existing.token);

    return c.json({ token: existing.token, url });
  },
);

// ── GET /feed.ics — Public .ics feed (token-based auth) ──

calendarFeedRoutes.get("/feed.ics", async (c) => {
  const token = c.req.query("token");

  if (!token) {
    return c.text("Missing token", 401);
  }

  // Validate token
  const [feedToken] = await db
    .select({ token: calendarFeedTokens.token })
    .from(calendarFeedTokens)
    .where(eq(calendarFeedTokens.token, token));

  if (!feedToken) {
    return c.text("Invalid token", 401);
  }

  // Fetch upcoming events (next 6 months + last 1 month)
  const now = new Date();
  const from = new Date(now);
  from.setMonth(from.getMonth() - 1);
  const to = new Date(now);
  to.setMonth(to.getMonth() + 6);

  const events = await db
    .select({
      event: calendarEvents,
      creatorName: creatorProfiles.displayName,
    })
    .from(calendarEvents)
    .leftJoin(creatorProfiles, eq(calendarEvents.creatorId, creatorProfiles.id))
    .where(
      and(
        isNull(calendarEvents.deletedAt),
        gte(calendarEvents.startAt, from),
        lte(calendarEvents.startAt, to),
      ),
    )
    .orderBy(asc(calendarEvents.startAt));

  // Generate .ics
  const calendar = ical({
    name: "S/NC Calendar",
    method: ICalCalendarMethod.PUBLISH,
  });

  for (const row of events) {
    const event = row.event;
    const summary = row.creatorName ? `${event.title} (${row.creatorName})` : event.title;
    const icalEvent = calendar.createEvent({
      id: event.id,
      start: event.startAt,
      end: event.endAt ?? null,
      allDay: event.allDay,
      summary,
      description: event.description ?? null,
      location: event.location ?? null,
    });
    icalEvent.createCategory({ name: event.eventType });
    if (event.eventType === "task" && event.completedAt !== null) {
      icalEvent.status(ICalEventStatus.CONFIRMED);
    } else if (event.eventType === "task") {
      icalEvent.status(ICalEventStatus.TENTATIVE);
    }
  }

  return c.body(calendar.toString(), 200, {
    "Content-Type": "text/calendar; charset=utf-8",
    "Content-Disposition": 'attachment; filename="snc-calendar.ics"',
  });
});
