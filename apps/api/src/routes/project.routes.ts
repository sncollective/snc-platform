import { randomUUID } from "node:crypto";

import { Hono } from "hono";
import { describeRoute, resolver, validator } from "hono-openapi";
import { eq, and, asc, gt, or, isNull, gte, ne } from "drizzle-orm";

import {
  CreateProjectSchema,
  UpdateProjectSchema,
  ProjectsQuerySchema,
  ProjectEventsQuerySchema,
  ProjectResponseSchema,
  ProjectsResponseSchema,
  CalendarEventsResponseSchema,
  NotFoundError,
  AppError,
} from "@snc/shared";
import type {
  Project,
  ProjectsQuery,
  ProjectEventsQuery,
} from "@snc/shared";

import { db } from "../db/connection.js";
import { projects } from "../db/schema/project.schema.js";
import { calendarEvents } from "../db/schema/calendar.schema.js";
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
import { requireCreatorPermission } from "../services/creator-team.js";
import { generateUniqueSlug } from "../services/slug.js";
import { toISO, toISOOrNull } from "../lib/response-helpers.js";
import { IdParam } from "./route-params.js";

// ── Private Types ──

type ProjectRow = typeof projects.$inferSelect;

// ── Private Helpers ──

const toProjectResponse = (row: ProjectRow): Project => ({
  id: row.id,
  name: row.name,
  slug: row.slug,
  description: row.description,
  creatorId: row.creatorId ?? null,
  createdBy: row.createdBy,
  completed: row.completed,
  completedAt: toISOOrNull(row.completedAt),
  createdAt: toISO(row.createdAt),
  updatedAt: toISO(row.updatedAt),
});

const findProjectByIdOrSlug = async (param: string): Promise<ProjectRow | undefined> => {
  // UUID pattern: 8-4-4-4-12 hex chars
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(param);

  if (isUuid) {
    const [row] = await db.select().from(projects).where(eq(projects.id, param));
    return row;
  }

  const [row] = await db.select().from(projects).where(eq(projects.slug, param));
  return row;
};

// ── Public API ──

export const projectRoutes = new Hono<AuthEnv>();

projectRoutes.use("*", requireAuth);
projectRoutes.use("*", requireRole("stakeholder"));

// ── GET /projects — List projects ──

projectRoutes.get(
  "/",
  describeRoute({
    description: "List projects with optional filters",
    tags: ["projects"],
    responses: {
      200: {
        description: "Paginated list of projects",
        content: {
          "application/json": {
            schema: resolver(ProjectsResponseSchema),
          },
        },
      },
      400: ERROR_400,
      401: ERROR_401,
      403: ERROR_403,
    },
  }),
  validator("query", ProjectsQuerySchema),
  async (c) => {
    const { creatorId, completed, cursor, limit } =
      c.req.valid("query" as never) as ProjectsQuery;

    const conditions = [];

    if (creatorId !== undefined) {
      conditions.push(
        or(
          eq(projects.creatorId, creatorId),
          isNull(projects.creatorId),
        )!,
      );
    }
    if (completed !== undefined) {
      conditions.push(eq(projects.completed, completed));
    }

    if (cursor) {
      const decoded = decodeCursor(cursor, {
        timestampField: "createdAt",
        idField: "id",
      });
      conditions.push(
        buildCursorCondition(projects.createdAt, projects.id, decoded, "asc"),
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const rows = await db
      .select()
      .from(projects)
      .where(whereClause)
      .orderBy(asc(projects.createdAt), asc(projects.id))
      .limit(limit + 1);

    const { items: rawItems, nextCursor } = buildPaginatedResponse(
      rows,
      limit,
      (last) => ({
        createdAt: last.createdAt.toISOString(),
        id: last.id,
      }),
    );

    return c.json({ items: rawItems.map(toProjectResponse), nextCursor });
  },
);

// ── GET /projects/:id — Get single project ──

projectRoutes.get(
  "/:id",
  describeRoute({
    description: "Get a single project by ID",
    tags: ["projects"],
    responses: {
      200: {
        description: "Project detail",
        content: {
          "application/json": {
            schema: resolver(ProjectResponseSchema),
          },
        },
      },
      401: ERROR_401,
      403: ERROR_403,
      404: ERROR_404,
    },
  }),
  validator("param", IdParam),
  async (c) => {
    const { id } = c.req.valid("param" as never) as { id: string };

    const row = await findProjectByIdOrSlug(id);

    if (!row) {
      throw new NotFoundError("Project not found");
    }

    return c.json({ project: toProjectResponse(row) });
  },
);

// ── POST /projects — Create project ──

projectRoutes.post(
  "/",
  describeRoute({
    description: "Create a new project",
    tags: ["projects"],
    responses: {
      201: {
        description: "Project created",
        content: {
          "application/json": {
            schema: resolver(ProjectResponseSchema),
          },
        },
      },
      400: ERROR_400,
      401: ERROR_401,
      403: ERROR_403,
    },
  }),
  validator("json", CreateProjectSchema),
  async (c) => {
    const data = c.req.valid("json");
    const user = c.get("user");
    const roles = (c.get("roles") as string[] | undefined) ?? [];

    if (data.creatorId) {
      await requireCreatorPermission(user.id, data.creatorId, "manageScheduling", roles);
    }

    const id = randomUUID();
    const now = new Date();

    const slug = await generateUniqueSlug(data.name, {
      table: projects,
      slugColumn: projects.slug,
    });

    const [project] = await db
      .insert(projects)
      .values({
        id,
        name: data.name,
        slug,
        description: data.description,
        creatorId: data.creatorId ?? null,
        createdBy: user.id,
        completed: false,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    return c.json({ project: toProjectResponse(project!) }, 201);
  },
);

// ── PATCH /projects/:id — Update project ──

projectRoutes.patch(
  "/:id",
  describeRoute({
    description: "Update a project",
    tags: ["projects"],
    responses: {
      200: {
        description: "Updated project",
        content: {
          "application/json": {
            schema: resolver(ProjectResponseSchema),
          },
        },
      },
      400: ERROR_400,
      401: ERROR_401,
      403: ERROR_403,
      404: ERROR_404,
    },
  }),
  validator("param", IdParam),
  validator("json", UpdateProjectSchema),
  async (c) => {
    const { id } = c.req.valid("param" as never) as { id: string };
    const data = c.req.valid("json");

    const existing = await findProjectByIdOrSlug(id);

    if (!existing) {
      throw new NotFoundError("Project not found");
    }

    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (data.name !== undefined) {
      updates.name = data.name;
      updates.slug = await generateUniqueSlug(data.name, {
        table: projects,
        slugColumn: projects.slug,
        excludeId: existing.id,
        idColumn: projects.id,
      });
    }
    if (data.description !== undefined) updates.description = data.description;
    if (data.completed !== undefined) {
      updates.completed = data.completed;
      if (data.completed) {
        updates.completedAt = new Date();
      } else {
        updates.completedAt = null;
      }
    }

    const [updated] = await db
      .update(projects)
      .set(updates)
      .where(eq(projects.id, existing.id))
      .returning();

    return c.json({ project: toProjectResponse(updated!) });
  },
);

// ── DELETE /projects/:id — Hard delete project ──

projectRoutes.delete(
  "/:id",
  describeRoute({
    description: "Hard delete a project",
    tags: ["projects"],
    responses: {
      204: { description: "Project deleted" },
      401: ERROR_401,
      403: ERROR_403,
      404: ERROR_404,
    },
  }),
  validator("param", IdParam),
  async (c) => {
    const { id } = c.req.valid("param" as never) as { id: string };

    const existing = await findProjectByIdOrSlug(id);

    if (!existing) {
      throw new NotFoundError("Project not found");
    }

    await db.delete(projects).where(eq(projects.id, existing.id));

    return c.body(null, 204);
  },
);

// ── GET /projects/:id/events — Project timeline ──

projectRoutes.get(
  "/:id/events",
  describeRoute({
    description: "List calendar events for a project (timeline)",
    tags: ["projects"],
    responses: {
      200: {
        description: "Paginated list of project calendar events",
        content: {
          "application/json": {
            schema: resolver(CalendarEventsResponseSchema),
          },
        },
      },
      400: ERROR_400,
      401: ERROR_401,
      403: ERROR_403,
      404: ERROR_404,
    },
  }),
  validator("param", IdParam),
  validator("query", ProjectEventsQuerySchema),
  async (c) => {
    const { id } = c.req.valid("param" as never) as { id: string };
    const { limit, cursor } = c.req.valid("query" as never) as ProjectEventsQuery;

    const project = await findProjectByIdOrSlug(id);

    if (!project) {
      throw new NotFoundError("Project not found");
    }

    const now = new Date();

    const conditions = [
      eq(calendarEvents.projectId, project.id),
      isNull(calendarEvents.deletedAt),
      or(
        gte(calendarEvents.startAt, now),
        and(
          eq(calendarEvents.eventType, "task"),
          isNull(calendarEvents.completedAt),
        ),
      )!,
    ];

    if (cursor) {
      const decoded = decodeCursor(cursor, {
        timestampField: "startAt",
        idField: "id",
      });
      conditions.push(
        buildCursorCondition(calendarEvents.startAt, calendarEvents.id, decoded, "asc"),
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
      .where(
        and(...conditions),
      )
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

    const items = rawItems.map((row) =>
      toEventResponse(row.event, row.projectName ?? null, row.creatorName ?? null),
    );

    return c.json({ items, nextCursor });
  },
);
