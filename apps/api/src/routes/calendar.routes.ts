import { randomUUID } from "node:crypto";

import { Hono } from "hono";
import { describeRoute, resolver, validator } from "hono-openapi";
import { eq, and, gte, lte, or, asc, isNull } from "drizzle-orm";

import {
  CreateCalendarEventSchema,
  UpdateCalendarEventSchema,
  CalendarEventsQuerySchema,
  CalendarEventResponseSchema,
  CalendarEventsResponseSchema,
  AppError,
  NotFoundError,
} from "@snc/shared";
import type { CalendarEventsQuery } from "@snc/shared";

import { db } from "../db/connection.js";
import { calendarEvents } from "../db/schema/calendar.schema.js";
import { projects } from "../db/schema/project.schema.js";
import { creatorProfiles } from "../db/schema/creator.schema.js";
import { requireAuth } from "../middleware/require-auth.js";
import { requireRole } from "../middleware/require-role.js";
import type { AuthEnv } from "../middleware/auth-env.js";
import {
  ERROR_400,
  ERROR_401,
  ERROR_403,
  ERROR_404,
} from "../lib/openapi-errors.js";
import { buildCursorCondition, buildPaginatedResponse, decodeCursor } from "../lib/cursor.js";
import { toEventResponse } from "../lib/calendar-helpers.js";

// ── Private Types ──

type CalendarEventRow = typeof calendarEvents.$inferSelect;

// ── Private Helpers ──

const findActiveEvent = async (id: string): Promise<CalendarEventRow | undefined> => {
  const [row] = await db
    .select()
    .from(calendarEvents)
    .where(and(eq(calendarEvents.id, id), isNull(calendarEvents.deletedAt)));
  return row;
};

const fetchEventWithJoins = async (id: string) => {
  const [row] = await db
    .select({
      event: calendarEvents,
      projectName: projects.name,
      creatorName: creatorProfiles.displayName,
    })
    .from(calendarEvents)
    .leftJoin(projects, eq(calendarEvents.projectId, projects.id))
    .leftJoin(creatorProfiles, eq(calendarEvents.creatorId, creatorProfiles.id))
    .where(eq(calendarEvents.id, id));
  return row;
};

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
    const { from, to, eventType, projectId, creatorId, cursor, limit } =
      c.req.valid("query" as never) as CalendarEventsQuery;

    const conditions = [isNull(calendarEvents.deletedAt)];

    if (from && to) {
      // Event is visible if it overlaps the date range:
      // startAt <= to AND (endAt >= from OR (endAt IS NULL AND startAt >= from))
      conditions.push(lte(calendarEvents.startAt, new Date(to)));
      conditions.push(
        or(
          gte(calendarEvents.endAt, new Date(from)),
          and(isNull(calendarEvents.endAt), gte(calendarEvents.startAt, new Date(from))),
        )!,
      );
    } else if (from) {
      conditions.push(
        or(
          gte(calendarEvents.startAt, new Date(from)),
          gte(calendarEvents.endAt, new Date(from)),
        )!,
      );
    } else if (to) {
      conditions.push(lte(calendarEvents.startAt, new Date(to)));
    }
    if (eventType) {
      conditions.push(eq(calendarEvents.eventType, eventType));
    }
    if (projectId) {
      conditions.push(eq(calendarEvents.projectId, projectId));
    }
    if (creatorId) {
      conditions.push(eq(calendarEvents.creatorId, creatorId));
    }

    if (cursor) {
      const decoded = decodeCursor(cursor, {
        timestampField: "startAt",
        idField: "id",
      });
      conditions.push(
        buildCursorCondition(
          calendarEvents.startAt,
          calendarEvents.id,
          decoded,
          "asc",
        ),
      );
    }

    const rows = await db
      .select({
        event: calendarEvents,
        projectName: projects.name,
        creatorName: creatorProfiles.displayName,
      })
      .from(calendarEvents)
      .leftJoin(projects, eq(calendarEvents.projectId, projects.id))
      .leftJoin(creatorProfiles, eq(calendarEvents.creatorId, creatorProfiles.id))
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
      items: rawItems.map((row) => toEventResponse(row.event, row.projectName ?? null, row.creatorName ?? null)),
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
        creatorName: creatorProfiles.displayName,
      })
      .from(calendarEvents)
      .leftJoin(projects, eq(calendarEvents.projectId, projects.id))
      .leftJoin(creatorProfiles, eq(calendarEvents.creatorId, creatorProfiles.id))
      .where(and(eq(calendarEvents.id, id), isNull(calendarEvents.deletedAt)));

    if (!row) {
      throw new NotFoundError("Event not found");
    }

    return c.json({ event: toEventResponse(row.event, row.projectName ?? null, row.creatorName ?? null) });
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

    return c.json({ event: toEventResponse(event!, null, null) }, 201);
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
    const existing = await findActiveEvent(id);

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

    const row = await fetchEventWithJoins(id);

    return c.json({ event: toEventResponse(row!.event, row!.projectName ?? null, row!.creatorName ?? null) });
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

    const existing = await findActiveEvent(id);

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

// ── PATCH /events/:id/complete — Toggle task completion ──

calendarRoutes.patch(
  "/events/:id/complete",
  requireAuth,
  requireRole("stakeholder"),
  describeRoute({
    description: "Toggle task completion status",
    tags: ["calendar"],
    responses: {
      200: {
        description: "Updated event with toggled completion",
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
  async (c) => {
    const { id } = c.req.param();

    const existing = await findActiveEvent(id);

    if (!existing) {
      throw new NotFoundError("Event not found");
    }

    if (existing.eventType !== "task") {
      throw new AppError("INVALID_EVENT_TYPE", "Only task events can be completed", 400);
    }

    const now = new Date();
    const newCompletedAt = existing.completedAt === null ? now : null;

    await db
      .update(calendarEvents)
      .set({ completedAt: newCompletedAt, updatedAt: now })
      .where(eq(calendarEvents.id, id));

    const updated = await fetchEventWithJoins(id);

    return c.json({ event: toEventResponse(updated!.event, updated!.projectName ?? null, updated!.creatorName ?? null) });
  },
);
