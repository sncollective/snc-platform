import { randomUUID } from "node:crypto";

import { Hono } from "hono";
import { describeRoute, resolver, validator } from "hono-openapi";
import { eq, and, desc, lt, gt, gte, lte, or, asc, isNull } from "drizzle-orm";
import ical, { ICalCalendarMethod } from "ical-generator";

import {
  CreateCalendarEventSchema,
  UpdateCalendarEventSchema,
  CalendarEventsQuerySchema,
  CalendarEventResponseSchema,
  CalendarEventsResponseSchema,
  FeedTokenResponseSchema,
  EventTypesResponseSchema,
  CreateCustomEventTypeSchema,
  DEFAULT_EVENT_TYPES,
  DEFAULT_EVENT_TYPE_LABELS,
  NotFoundError,
  ForbiddenError,
  ConflictError,
} from "@snc/shared";
import type { CalendarEvent, CalendarEventsQuery } from "@snc/shared";

import { db } from "../db/connection.js";
import {
  calendarEvents,
  calendarFeedTokens,
  customEventTypes,
} from "../db/schema/calendar.schema.js";
import { projects } from "../db/schema/project.schema.js";
import { requireAuth } from "../middleware/require-auth.js";
import { requireRole } from "../middleware/require-role.js";
import type { AuthEnv } from "../middleware/auth-env.js";
import {
  ERROR_400,
  ERROR_401,
  ERROR_403,
  ERROR_404,
} from "./openapi-errors.js";
import { buildPaginatedResponse, decodeCursor } from "./cursor.js";
import { config } from "../config.js";

// ── Private Types ──

type CalendarEventRow = typeof calendarEvents.$inferSelect;

// ── Private Helpers ──

const toEventResponse = (
  row: CalendarEventRow,
  projectName: string | null,
): CalendarEvent => ({
  id: row.id,
  title: row.title,
  description: row.description,
  startAt: row.startAt.toISOString(),
  endAt: row.endAt?.toISOString() ?? null,
  allDay: row.allDay,
  eventType: row.eventType,
  location: row.location,
  createdBy: row.createdBy,
  creatorId: row.creatorId ?? null,
  projectId: row.projectId ?? null,
  projectName: projectName ?? null,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
});

// ── Public API ──

export const calendarRoutes = new Hono<AuthEnv>();

// ── GET /events — List events ──

calendarRoutes.get(
  "/events",
  requireAuth,
  requireRole("stakeholder"),
  describeRoute({
    description:
      "List calendar events with optional date range and event type filter",
    tags: ["calendar"],
    responses: {
      200: {
        description: "Paginated list of calendar events",
        content: {
          "application/json": {
            schema: resolver(CalendarEventsResponseSchema),
          },
        },
      },
      400: ERROR_400,
      401: ERROR_401,
      403: ERROR_403,
    },
  }),
  validator("query", CalendarEventsQuerySchema),
  async (c) => {
    const { from, to, eventType, projectId, cursor, limit } =
      c.req.valid("query" as never) as CalendarEventsQuery;

    const conditions = [isNull(calendarEvents.deletedAt), isNull(calendarEvents.creatorId)];

    if (from) {
      conditions.push(gte(calendarEvents.startAt, new Date(from)));
    }
    if (to) {
      conditions.push(lte(calendarEvents.startAt, new Date(to)));
    }
    if (eventType) {
      conditions.push(eq(calendarEvents.eventType, eventType));
    }
    if (projectId) {
      conditions.push(eq(calendarEvents.projectId, projectId));
    }

    if (cursor) {
      const decoded = decodeCursor(cursor, {
        timestampField: "startAt",
        idField: "id",
      });
      conditions.push(
        or(
          gt(calendarEvents.startAt, decoded.timestamp),
          and(
            eq(calendarEvents.startAt, decoded.timestamp),
            gt(calendarEvents.id, decoded.id),
          ),
        )!,
      );
    }

    const rows = await db
      .select({
        event: calendarEvents,
        projectName: projects.name,
      })
      .from(calendarEvents)
      .leftJoin(projects, eq(calendarEvents.projectId, projects.id))
      .where(and(...conditions))
      .orderBy(asc(calendarEvents.startAt), asc(calendarEvents.id))
      .limit(limit + 1);

    const { items: rawItems, nextCursor } = buildPaginatedResponse(
      rows,
      limit,
      (last) => ({
        startAt: last.event.startAt.toISOString(),
        id: last.event.id,
      }),
    );

    return c.json({
      items: rawItems.map((row) => toEventResponse(row.event, row.projectName ?? null)),
      nextCursor,
    });
  },
);

// ── GET /events/:id — Get single event ──

calendarRoutes.get(
  "/events/:id",
  requireAuth,
  requireRole("stakeholder"),
  describeRoute({
    description: "Get a single calendar event by ID",
    tags: ["calendar"],
    responses: {
      200: {
        description: "Calendar event detail",
        content: {
          "application/json": {
            schema: resolver(CalendarEventResponseSchema),
          },
        },
      },
      401: ERROR_401,
      403: ERROR_403,
      404: ERROR_404,
    },
  }),
  async (c) => {
    const { id } = c.req.param();

    const [row] = await db
      .select({
        event: calendarEvents,
        projectName: projects.name,
      })
      .from(calendarEvents)
      .leftJoin(projects, eq(calendarEvents.projectId, projects.id))
      .where(and(eq(calendarEvents.id, id), isNull(calendarEvents.deletedAt)));

    if (!row) {
      throw new NotFoundError("Event not found");
    }

    return c.json({ event: toEventResponse(row.event, row.projectName ?? null) });
  },
);

// ── POST /events — Create event ──

calendarRoutes.post(
  "/events",
  requireAuth,
  requireRole("stakeholder"),
  describeRoute({
    description: "Create a new calendar event",
    tags: ["calendar"],
    responses: {
      201: {
        description: "Calendar event created",
        content: {
          "application/json": {
            schema: resolver(CalendarEventResponseSchema),
          },
        },
      },
      400: ERROR_400,
      401: ERROR_401,
      403: ERROR_403,
    },
  }),
  validator("json", CreateCalendarEventSchema),
  async (c) => {
    const data = c.req.valid("json");
    const user = c.get("user");

    const id = randomUUID();
    const now = new Date();

    const [event] = await db
      .insert(calendarEvents)
      .values({
        id,
        title: data.title,
        description: data.description,
        startAt: new Date(data.startAt),
        endAt: data.endAt ? new Date(data.endAt) : null,
        allDay: data.allDay,
        eventType: data.eventType,
        location: data.location,
        projectId: data.projectId ?? null,
        createdBy: user.id,
        creatorId: null,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    return c.json({ event: toEventResponse(event!, null) }, 201);
  },
);

// ── PATCH /events/:id — Update event ──

calendarRoutes.patch(
  "/events/:id",
  requireAuth,
  requireRole("stakeholder"),
  describeRoute({
    description: "Update a calendar event",
    tags: ["calendar"],
    responses: {
      200: {
        description: "Updated calendar event",
        content: {
          "application/json": {
            schema: resolver(CalendarEventResponseSchema),
          },
        },
      },
      400: ERROR_400,
      401: ERROR_401,
      403: ERROR_403,
      404: ERROR_404,
    },
  }),
  validator("json", UpdateCalendarEventSchema),
  async (c) => {
    const { id } = c.req.param();
    const data = c.req.valid("json");

    // Verify event exists
    const [existing] = await db
      .select()
      .from(calendarEvents)
      .where(and(eq(calendarEvents.id, id), isNull(calendarEvents.deletedAt)));

    if (!existing) {
      throw new NotFoundError("Event not found");
    }

    // Build update fields
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (data.title !== undefined) updates.title = data.title;
    if (data.description !== undefined) updates.description = data.description;
    if (data.startAt !== undefined) updates.startAt = new Date(data.startAt);
    if (data.endAt !== undefined)
      updates.endAt = data.endAt ? new Date(data.endAt) : null;
    if (data.allDay !== undefined) updates.allDay = data.allDay;
    if (data.eventType !== undefined) updates.eventType = data.eventType;
    if (data.location !== undefined) updates.location = data.location;
    if (data.projectId !== undefined) updates.projectId = data.projectId;

    await db
      .update(calendarEvents)
      .set(updates)
      .where(eq(calendarEvents.id, id));

    const [row] = await db
      .select({
        event: calendarEvents,
        projectName: projects.name,
      })
      .from(calendarEvents)
      .leftJoin(projects, eq(calendarEvents.projectId, projects.id))
      .where(eq(calendarEvents.id, id));

    return c.json({ event: toEventResponse(row!.event, row!.projectName ?? null) });
  },
);

// ── DELETE /events/:id — Soft-delete event ──

calendarRoutes.delete(
  "/events/:id",
  requireAuth,
  requireRole("stakeholder"),
  describeRoute({
    description: "Soft-delete a calendar event",
    tags: ["calendar"],
    responses: {
      204: { description: "Event deleted" },
      401: ERROR_401,
      403: ERROR_403,
      404: ERROR_404,
    },
  }),
  async (c) => {
    const { id } = c.req.param();

    const [existing] = await db
      .select()
      .from(calendarEvents)
      .where(and(eq(calendarEvents.id, id), isNull(calendarEvents.deletedAt)));

    if (!existing) {
      throw new NotFoundError("Event not found");
    }

    await db
      .update(calendarEvents)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(eq(calendarEvents.id, id));

    return c.body(null, 204);
  },
);

// ── POST /feed-token — Generate feed token ──

calendarRoutes.post(
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

    const baseUrl = config.CORS_ORIGIN.split(",")[0]!.trim();
    const url = `${baseUrl}/api/calendar/feed.ics?token=${token}`;

    return c.json({ token, url });
  },
);

// ── GET /feed-token — Get existing feed token ──

calendarRoutes.get(
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

    const baseUrl = config.CORS_ORIGIN.split(",")[0]!.trim();
    const url = `${baseUrl}/api/calendar/feed.ics?token=${existing.token}`;

    return c.json({ token: existing.token, url });
  },
);

// ── GET /feed.ics — Public .ics feed (token-based auth) ──

calendarRoutes.get("/feed.ics", async (c) => {
  const token = c.req.query("token");

  if (!token) {
    return c.text("Missing token", 401);
  }

  // Validate token
  const [feedToken] = await db
    .select()
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
    .select()
    .from(calendarEvents)
    .where(
      and(
        isNull(calendarEvents.deletedAt),
        isNull(calendarEvents.creatorId),
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

  for (const event of events) {
    const icalEvent = calendar.createEvent({
      id: event.id,
      start: event.startAt,
      end: event.endAt ?? null,
      allDay: event.allDay,
      summary: event.title,
      description: event.description ?? null,
      location: event.location ?? null,
    });
    icalEvent.createCategory({ name: event.eventType });
  }

  return c.body(calendar.toString(), 200, {
    "Content-Type": "text/calendar; charset=utf-8",
    "Content-Disposition": 'attachment; filename="snc-calendar.ics"',
  });
});

// ── GET /event-types — List available event types ──

calendarRoutes.get(
  "/event-types",
  requireAuth,
  requireRole("stakeholder"),
  describeRoute({
    description: "List all available event types (defaults merged with custom)",
    tags: ["calendar"],
    responses: {
      200: {
        description: "List of event types",
        content: {
          "application/json": {
            schema: resolver(EventTypesResponseSchema),
          },
        },
      },
      401: ERROR_401,
      403: ERROR_403,
    },
  }),
  async (c) => {
    const customRows = await db.select().from(customEventTypes);

    const defaultItems = DEFAULT_EVENT_TYPES.map((slug) => ({
      id: `default:${slug}`,
      label: DEFAULT_EVENT_TYPE_LABELS[slug] ?? slug,
      slug,
    }));

    const customSlugs = new Set(customRows.map((r) => r.slug));
    const filteredDefaults = defaultItems.filter(
      (d) => !customSlugs.has(d.slug),
    );

    const customItems = customRows.map((r) => ({
      id: r.id,
      label: r.label,
      slug: r.slug,
    }));

    const allItems = [...filteredDefaults, ...customItems].sort((a, b) =>
      a.slug === "other" ? 1 : b.slug === "other" ? -1 : 0,
    );

    return c.json({ items: allItems });
  },
);

// ── POST /event-types — Create custom event type ──

calendarRoutes.post(
  "/event-types",
  requireAuth,
  requireRole("stakeholder"),
  describeRoute({
    description: "Create a custom event type",
    tags: ["calendar"],
    responses: {
      201: {
        description: "Custom event type created",
        content: {
          "application/json": {
            schema: resolver(EventTypesResponseSchema),
          },
        },
      },
      400: ERROR_400,
      401: ERROR_401,
      403: ERROR_403,
    },
  }),
  validator("json", CreateCustomEventTypeSchema),
  async (c) => {
    const { label } = c.req.valid("json");
    const user = c.get("user");

    const slug = label
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "");

    // Check if slug conflicts with default types
    if ((DEFAULT_EVENT_TYPES as readonly string[]).includes(slug)) {
      throw new ConflictError(
        `Event type with slug "${slug}" already exists as a default type`,
      );
    }

    // Check if slug already exists in DB
    const [existing] = await db
      .select()
      .from(customEventTypes)
      .where(eq(customEventTypes.slug, slug));

    if (existing) {
      throw new ConflictError(
        `Event type with slug "${slug}" already exists`,
      );
    }

    const id = randomUUID();
    const now = new Date();

    const [created] = await db
      .insert(customEventTypes)
      .values({
        id,
        label,
        slug,
        createdBy: user.id,
        createdAt: now,
      })
      .returning();

    return c.json(
      { items: [{ id: created!.id, label: created!.label, slug: created!.slug }] },
      201,
    );
  },
);
