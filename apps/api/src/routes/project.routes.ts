import { randomUUID } from "node:crypto";

import { Hono } from "hono";
import { describeRoute, resolver, validator } from "hono-openapi";
import { eq, and, asc, gt, or, isNull, gte, ne } from "drizzle-orm";

import {
  CreateProjectSchema,
  UpdateProjectSchema,
  ProjectsQuerySchema,
  ProjectResponseSchema,
  ProjectsResponseSchema,
  CalendarEventsResponseSchema,
  NotFoundError,
  AppError,
} from "@snc/shared";
import type {
  Project,
  ProjectsQuery,
} from "@snc/shared";

import { db } from "../db/connection.js";
import { projects } from "../db/schema/project.schema.js";
import { calendarEvents } from "../db/schema/calendar.schema.js";
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
import { requireCreatorPermission } from "../services/creator-team.js";
import { generateUniqueSlug } from "../services/slug.js";

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
  completedAt: row.completedAt?.toISOString() ?? null,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
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
        or(
          gt(projects.createdAt, decoded.timestamp),
          and(
            eq(projects.createdAt, decoded.timestamp),
            gt(projects.id, decoded.id),
          ),
        )!,
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
  async (c) => {
    const { id } = c.req.param();

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
  validator("json", UpdateProjectSchema),
  async (c) => {
    const { id } = c.req.param();
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
  async (c) => {
    const { id } = c.req.param();

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
      401: ERROR_401,
      403: ERROR_403,
      404: ERROR_404,
    },
  }),
  async (c) => {
    const { id } = c.req.param();

    const project = await findProjectByIdOrSlug(id);

    if (!project) {
      throw new NotFoundError("Project not found");
    }

    const limit = 50;

    const now = new Date();

    const rows = await db
      .select({
        event: calendarEvents,
        projectName: projects.name,
      })
      .from(calendarEvents)
      .leftJoin(projects, eq(calendarEvents.projectId, projects.id))
      .where(
        and(
          eq(calendarEvents.projectId, project.id),
          isNull(calendarEvents.deletedAt),
          or(
            // Future events (any type)
            gte(calendarEvents.startAt, now),
            // Overdue uncompleted tasks
            and(
              eq(calendarEvents.eventType, "task"),
              isNull(calendarEvents.completedAt),
            ),
          ),
        ),
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

    const items = rawItems.map((row) => ({
      id: row.event.id,
      title: row.event.title,
      description: row.event.description,
      startAt: row.event.startAt.toISOString(),
      endAt: row.event.endAt?.toISOString() ?? null,
      allDay: row.event.allDay,
      eventType: row.event.eventType,
      location: row.event.location,
      createdBy: row.event.createdBy,
      creatorId: row.event.creatorId ?? null,
      projectId: row.event.projectId ?? null,
      projectName: row.projectName ?? null,
      completedAt: row.event.completedAt?.toISOString() ?? null,
      createdAt: row.event.createdAt.toISOString(),
      updatedAt: row.event.updatedAt.toISOString(),
    }));

    return c.json({ items, nextCursor });
  },
);
