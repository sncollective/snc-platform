import { randomUUID } from "node:crypto";

import { Hono } from "hono";
import { describeRoute, resolver, validator } from "hono-openapi";
import { eq, desc, and, type SQL } from "drizzle-orm";

import {
  AdminCreatorsQuerySchema,
  AdminCreatorsResponseSchema,
  AdminCreatorResponseSchema,
  AdminCreateCreatorSchema,
  UpdateCreatorStatusSchema,
  NotFoundError,
  ValidationError,
  AppError,
} from "@snc/shared";
import type {
  AdminCreatorsQuery,
  AdminCreateCreator,
  UpdateCreatorStatus,
} from "@snc/shared";

import { db } from "../db/connection.js";
import { creatorProfiles } from "../db/schema/creator.schema.js";
import { requireAuth } from "../middleware/require-auth.js";
import { requireRole } from "../middleware/require-role.js";
import type { AuthEnv } from "../middleware/auth-env.js";
import { ERROR_400, ERROR_401, ERROR_403, ERROR_404 } from "../lib/openapi-errors.js";
import {
  buildCursorCondition,
  buildPaginatedResponse,
  decodeCursor,
} from "../lib/cursor.js";
import { getClientIp } from "../lib/request-helpers.js";
import { generateUniqueSlug } from "../services/slug.js";
import { toProfileResponse, getContentCount } from "../lib/creator-helpers.js";
import { archiveCreator } from "../services/creator-lifecycle.js";
import { rootLogger } from "../logging/logger.js";
import { CreatorIdParam } from "./route-params.js";
import { batchGetContentCounts } from "../services/creator-list.js";

/** Admin creator lifecycle management: list, create, change status. */
export const adminCreatorRoutes = new Hono<AuthEnv>();

// GET / — List all creators (admin)

adminCreatorRoutes.get(
  "/",
  requireAuth,
  requireRole("admin"),
  describeRoute({
    description: "List all creators with status (admin only, cursor-paginated)",
    tags: ["admin"],
    responses: {
      200: {
        description: "Paginated creator list",
        content: {
          "application/json": { schema: resolver(AdminCreatorsResponseSchema) },
        },
      },
      400: ERROR_400,
      401: ERROR_401,
      403: ERROR_403,
    },
  }),
  validator("query", AdminCreatorsQuerySchema),
  async (c) => {
    const { limit, cursor, status } =
      c.req.valid("query" as never) as AdminCreatorsQuery;

    const conditions: SQL[] = [];

    if (status) {
      conditions.push(eq(creatorProfiles.status, status));
    }

    if (cursor) {
      const decoded = decodeCursor(cursor, {
        timestampField: "createdAt",
        idField: "id",
      });
      conditions.push(
        buildCursorCondition(
          creatorProfiles.createdAt,
          creatorProfiles.id,
          decoded,
          "desc",
        ),
      );
    }

    const rows = await db
      .select()
      .from(creatorProfiles)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(creatorProfiles.createdAt), desc(creatorProfiles.id))
      .limit(limit + 1);

    const { items: rawRows, nextCursor } = buildPaginatedResponse(
      rows,
      limit,
      (last) => ({
        createdAt: last.createdAt.toISOString(),
        id: last.id,
      }),
    );

    const countMap = await batchGetContentCounts(rawRows.map((r) => r.id));
    const items = rawRows.map((row) =>
      toProfileResponse(row, countMap.get(row.id) ?? 0),
    );

    return c.json({ items, nextCursor });
  },
);

// POST / — Create creator (admin)

adminCreatorRoutes.post(
  "/",
  requireAuth,
  requireRole("admin"),
  describeRoute({
    description: "Create a new creator as inactive (admin only)",
    tags: ["admin"],
    responses: {
      201: {
        description: "Creator created",
        content: {
          "application/json": { schema: resolver(AdminCreatorResponseSchema) },
        },
      },
      400: ERROR_400,
      401: ERROR_401,
      403: ERROR_403,
    },
  }),
  validator("json", AdminCreateCreatorSchema),
  async (c) => {
    const body = c.req.valid("json") as AdminCreateCreator;

    if (body.handle) {
      const existing = await db
        .select({ id: creatorProfiles.id })
        .from(creatorProfiles)
        .where(eq(creatorProfiles.handle, body.handle));
      if (existing.length > 0) {
        throw new ValidationError(`Handle '${body.handle}' is already taken`);
      }
    }

    const id = randomUUID();
    const now = new Date();

    const [inserted] = await db
      .insert(creatorProfiles)
      .values({
        id,
        displayName: body.displayName,
        handle:
          body.handle ??
          (await generateUniqueSlug(body.displayName, {
            table: creatorProfiles,
            slugColumn: creatorProfiles.handle,
            maxLength: 30,
            fallbackPrefix: "creator",
          })),
        status: "inactive",
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    if (!inserted) {
      throw new AppError("INSERT_FAILED", "Failed to create creator profile", 500);
    }

    const logger = c.var?.logger ?? rootLogger;
    logger.info(
      {
        event: "creator_created",
        actorId: c.get("user").id,
        creatorId: id,
        ip: getClientIp(c),
      },
      "Admin created creator",
    );

    return c.json({ creator: toProfileResponse(inserted, 0) }, 201);
  },
);

// PATCH /:creatorId/status — Change creator status

adminCreatorRoutes.patch(
  "/:creatorId/status",
  requireAuth,
  requireRole("admin"),
  describeRoute({
    description: "Change creator status (admin only). Archiving removes content from channel pools.",
    tags: ["admin"],
    responses: {
      200: {
        description: "Creator with updated status",
        content: {
          "application/json": { schema: resolver(AdminCreatorResponseSchema) },
        },
      },
      400: ERROR_400,
      401: ERROR_401,
      403: ERROR_403,
      404: ERROR_404,
    },
  }),
  validator("param", CreatorIdParam),
  validator("json", UpdateCreatorStatusSchema),
  async (c) => {
    const { creatorId } = c.req.valid("param" as never) as { creatorId: string };
    const { status } = c.req.valid("json") as UpdateCreatorStatus;

    const [existing] = await db
      .select()
      .from(creatorProfiles)
      .where(eq(creatorProfiles.id, creatorId));

    if (!existing) {
      throw new NotFoundError("Creator not found");
    }

    // Archive side effects run before status update
    if (status === "archived" && existing.status !== "archived") {
      await archiveCreator(creatorId);
    }

    const [updated] = await db
      .update(creatorProfiles)
      .set({ status, updatedAt: new Date() })
      .where(eq(creatorProfiles.id, creatorId))
      .returning();

    const logger = c.var?.logger ?? rootLogger;
    logger.info(
      {
        event: "creator_status_changed",
        actorId: c.get("user").id,
        creatorId,
        previousStatus: existing.status,
        newStatus: status,
        ip: getClientIp(c),
      },
      "Admin changed creator status",
    );

    const contentCount = await getContentCount(creatorId);
    return c.json({ creator: toProfileResponse(updated!, contentCount) });
  },
);
