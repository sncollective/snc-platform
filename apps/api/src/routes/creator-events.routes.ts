import { randomUUID } from "node:crypto";

import { Hono } from "hono";
import { describeRoute, resolver, validator } from "hono-openapi";
import { eq, and, gt, gte, lte, or, asc, isNull } from "drizzle-orm";

import {
  CreateCalendarEventSchema,
  UpdateCalendarEventSchema,
  CalendarEventsQuerySchema,
  CalendarEventResponseSchema,
  CalendarEventsResponseSchema,
  NotFoundError,
} from "@snc/shared";
import type { CalendarEvent, CalendarEventsQuery } from "@snc/shared";

import { db } from "../db/connection.js";
import { calendarEvents } from "../db/schema/calendar.schema.js";
import { creatorProfiles } from "../db/schema/creator.schema.js";
import { projects } from "../db/schema/project.schema.js";
import { requireAuth } from "../middleware/require-auth.js";
import { requireRole } from "../middleware/require-role.js";
import type { AuthEnv } from "../middleware/auth-env.js";
import {
  ERROR_401,
  ERROR_403,
  ERROR_404,
} from "./openapi-errors.js";
import { buildPaginatedResponse, decodeCursor } from "./cursor.js";
import { requireCreatorPermission } from "../services/creator-team.js";

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

const findCreator = async (creatorId: string) => {
  const rows = await db
    .select({ id: creatorProfiles.id })
    .from(creatorProfiles)
    .where(eq(creatorProfiles.id, creatorId));
  return rows[0];
};

const findActiveEvent = async (eventId: string, creatorId: string) => {
  const rows = await db
    .select()
    .from(calendarEvents)
    .where(
      and(
        eq(calendarEvents.id, eventId),
        eq(calendarEvents.creatorId, creatorId),
        isNull(calendarEvents.deletedAt),
      ),
    );
  return rows[0];
};

// ── Public API ──

export const creatorEventRoutes = new Hono<AuthEnv>();

creatorEventRoutes.use("*", requireAuth);
creatorEventRoutes.use("*", requireRole("stakeholder", "admin"));

// ── GET /:creatorId/events — List creator events ──

creatorEventRoutes.get(
  "/:creatorId/events",
  describeRoute({
    description:
      "List events for a creator with optional date range and event type filter",
    tags: ["creator-events"],
    responses: {
      200: {
        description: "Paginated list of creator calendar events",
        content: {
          "application/json": {
            schema: resolver(CalendarEventsResponseSchema),
          },
        },
      },
      401: ERROR_401,
      403: ERROR_403,
      404: ERROR_404,
    },
  }),
  validator("query", CalendarEventsQuerySchema),
  async (c) => {
    const { creatorId } = c.req.param();
    const { from, to, eventType, cursor, limit } =
      c.req.valid("query" as never) as CalendarEventsQuery;

    const creator = await findCreator(creatorId);
    if (!creator) {
      throw new NotFoundError("Creator not found");
    }

    const conditions = [
      isNull(calendarEvents.deletedAt),
      eq(calendarEvents.creatorId, creatorId),
    ];

    if (from) {
      conditions.push(gte(calendarEvents.startAt, new Date(from)));
    }
    if (to) {
      conditions.push(lte(calendarEvents.startAt, new Date(to)));
    }
    if (eventType) {
      conditions.push(eq(calendarEvents.eventType, eventType));
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

// ── POST /:creatorId/events — Create creator event ──

creatorEventRoutes.post(
  "/:creatorId/events",
  describeRoute({
    description: "Create a new event for a creator",
    tags: ["creator-events"],
    responses: {
      201: {
        description: "Creator calendar event created",
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
  validator("json", CreateCalendarEventSchema),
  async (c) => {
    const { creatorId } = c.req.param();
    const data = c.req.valid("json");
    const user = c.get("user");
    const roles = (c.get("roles") as string[] | undefined) ?? [];

    const creator = await findCreator(creatorId);
    if (!creator) {
      throw new NotFoundError("Creator not found");
    }

    await requireCreatorPermission(user.id, creatorId, "manageScheduling", roles);

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
        creatorId,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    return c.json({ event: toEventResponse(event!, null) }, 201);
  },
);

// ── PATCH /:creatorId/events/:eventId — Update creator event ──

creatorEventRoutes.patch(
  "/:creatorId/events/:eventId",
  describeRoute({
    description: "Update a creator calendar event",
    tags: ["creator-events"],
    responses: {
      200: {
        description: "Updated creator calendar event",
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
  validator("json", UpdateCalendarEventSchema),
  async (c) => {
    const { creatorId, eventId } = c.req.param();
    const data = c.req.valid("json");
    const user = c.get("user");
    const roles = (c.get("roles") as string[] | undefined) ?? [];

    await requireCreatorPermission(user.id, creatorId, "manageScheduling", roles);

    const existing = await findActiveEvent(eventId, creatorId);
    if (!existing) {
      throw new NotFoundError("Event not found");
    }

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
      .where(eq(calendarEvents.id, eventId));

    const [row] = await db
      .select({
        event: calendarEvents,
        projectName: projects.name,
      })
      .from(calendarEvents)
      .leftJoin(projects, eq(calendarEvents.projectId, projects.id))
      .where(eq(calendarEvents.id, eventId));

    return c.json({ event: toEventResponse(row!.event, row!.projectName ?? null) });
  },
);

// ── DELETE /:creatorId/events/:eventId — Soft-delete creator event ──

creatorEventRoutes.delete(
  "/:creatorId/events/:eventId",
  describeRoute({
    description: "Soft-delete a creator calendar event",
    tags: ["creator-events"],
    responses: {
      204: { description: "Event deleted" },
      401: ERROR_401,
      403: ERROR_403,
      404: ERROR_404,
    },
  }),
  async (c) => {
    const { creatorId, eventId } = c.req.param();
    const user = c.get("user");
    const roles = (c.get("roles") as string[] | undefined) ?? [];

    await requireCreatorPermission(user.id, creatorId, "manageScheduling", roles);

    const existing = await findActiveEvent(eventId, creatorId);
    if (!existing) {
      throw new NotFoundError("Event not found");
    }

    await db
      .update(calendarEvents)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(eq(calendarEvents.id, eventId));

    return c.body(null, 204);
  },
);
