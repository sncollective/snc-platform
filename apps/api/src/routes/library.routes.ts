import { Hono } from "hono";
import type { Context } from "hono";
import { describeRoute, resolver, validator } from "hono-openapi";
import { z } from "zod";
import { eq } from "drizzle-orm";

import {
  ACCEPTED_MIME_TYPES,
  ContentAssetGrantRequestSchema,
  ContentAssetListSchema,
  ContentAssetSchema,
  ContentAssetSharingSchema,
  ContentAssetUploadResponseSchema,
  MAX_FILE_SIZES,
  NotFoundError,
  isLibraryAssetKey,
  ValidationError,
} from "@snc/shared";

import { db } from "../db/connection.js";
import { creatorProfiles } from "../db/schema/creator.schema.js";
import type { AuthEnv } from "../middleware/auth-env.js";
import { requireAuth } from "../middleware/require-auth.js";
import { storage } from "../storage/index.js";
import { ERROR_400, ERROR_401, ERROR_403, ERROR_404 } from "../lib/openapi-errors.js";
import { findCreatorProfile } from "../lib/creator-helpers.js";
import { requireCreatorPermission } from "../services/creator-team.js";
import {
  deleteLibraryAsset,
  getLibraryAsset,
  grantLibraryAssetUse,
  listLibraryAssets,
  revokeLibraryAssetUse,
  uploadLibraryAsset,
} from "../services/library.js";
import type { LibraryActor } from "../services/library.js";
import { CreatorIdParam } from "./route-params.js";

const AssetParams = z.object({
  creatorId: CreatorIdParam.shape.creatorId,
  id: z.string().uuid(),
});

const GrantParams = AssetParams.extend({
  granteeCreatorId: z.string().min(1),
});

const ListQuery = z.object({
  limit: z.coerce.number().int().positive().optional(),
  before: z.string().min(1).optional(),
});

const LibraryUsageSchema = z.enum(["avatar", "banner"]);

const parseCursor = (cursor: string | undefined): { createdAt: Date; id: string } | undefined => {
  if (!cursor) return undefined;
  const separator = cursor.indexOf("|");
  if (separator <= 0) throw new ValidationError("Invalid before cursor");
  const createdAt = new Date(cursor.slice(0, separator));
  const id = cursor.slice(separator + 1);
  if (Number.isNaN(createdAt.getTime()) || !z.string().uuid().safeParse(id).success) {
    throw new ValidationError("Invalid before cursor");
  }
  return { createdAt, id };
};

const getCreatorForManage = async (identifier: string) => {
  const profile = await findCreatorProfile(identifier);
  if (!profile) throw new NotFoundError("Creator profile not found");
  return profile;
};

const rolesFor = (c: Context<AuthEnv>) => c.get("roles") ?? [];

const authorizeCreator = async (c: Context<AuthEnv>) => {
  const profile = await getCreatorForManage(c.req.param("creatorId") ?? "");
  const roles = rolesFor(c);
  await requireCreatorPermission(c.get("user").id, profile.id, "editProfile", roles);
  return {
    profile,
    actor: {
      creatorId: profile.id,
      isAdmin: roles.includes("admin"),
    } satisfies LibraryActor,
  };
};

const handleUpload = async (c: Context<AuthEnv>): Promise<Response> => {
  const contentLengthHeader = c.req.header("content-length");
  if (contentLengthHeader) {
    const contentLength = Number.parseInt(contentLengthHeader, 10);
    if (!Number.isNaN(contentLength) && contentLength > MAX_FILE_SIZES.image) {
      throw new ValidationError(`File size exceeds the ${MAX_FILE_SIZES.image} byte limit`);
    }
  }

  const { profile, actor } = await authorizeCreator(c);
  const body = await c.req.parseBody();
  const file = body["file"];
  if (!(file instanceof File)) {
    throw new ValidationError("No file provided in 'file' form field");
  }
  if (file.size > MAX_FILE_SIZES.image) {
    throw new ValidationError(`File size ${file.size} exceeds the ${MAX_FILE_SIZES.image} byte limit`);
  }
  if (!(ACCEPTED_MIME_TYPES.image as readonly string[]).includes(file.type)) {
    throw new ValidationError(
      `Invalid MIME type '${file.type}'. Accepted: ${ACCEPTED_MIME_TYPES.image.join(", ")}`,
    );
  }

  const usageResult = LibraryUsageSchema.optional().safeParse(body["usage"]);
  if (!usageResult.success) throw new ValidationError("Invalid asset usage value");
  const sharingResult = ContentAssetSharingSchema.safeParse(body["sharing"] ?? "private");
  if (!sharingResult.success) throw new ValidationError("Invalid asset sharing value");

  const bytes = new Uint8Array(await file.arrayBuffer());
  const uploadFile = {
    ...(file.name ? { name: file.name } : {}),
    declaredType: file.type,
    size: file.size,
    bytes,
  };
  // Surface uploads are ensure-only: a new registration defaults private, while
  // dedup keeps an existing registration's sharing and filename intact.
  const result = usageResult.data
    ? await uploadLibraryAsset(profile.id, uploadFile)
    : await uploadLibraryAsset(
        actor.isAdmin ? null : profile.id,
        uploadFile,
        sharingResult.data,
      );
  if (!result.ok) throw result.error;

  if (usageResult.data) {
    await db
      .update(creatorProfiles)
      .set({
        [usageResult.data === "avatar" ? "avatarKey" : "bannerKey"]:
          result.value.asset.storageKey,
        updatedAt: new Date(),
      })
      .where(eq(creatorProfiles.id, profile.id));

    const oldKey = usageResult.data === "avatar" ? profile.avatarKey : profile.bannerKey;
    if (oldKey && oldKey !== result.value.asset.storageKey && !isLibraryAssetKey(oldKey)) {
      const deleteResult = await storage.delete(oldKey);
      if (!deleteResult.ok) {
        c.var.logger.warn(
          { error: deleteResult.error.message, key: oldKey },
          `Failed to delete legacy ${usageResult.data}`,
        );
      }
    }
  }

  return c.json({ ...result.value.asset, deduped: result.value.deduped });
};

/** Authenticated creator library discovery and sharing-management routes. */
export const libraryRoutes = new Hono<AuthEnv>();

libraryRoutes.post(
  "/:creatorId/library/assets",
  requireAuth,
  describeRoute({
    description: "Register an image in the shared content library",
    tags: ["library"],
    responses: {
      200: {
        description: "Library asset registered",
        content: { "application/json": { schema: resolver(ContentAssetUploadResponseSchema) } },
      },
      400: ERROR_400,
      401: ERROR_401,
      403: ERROR_403,
      404: ERROR_404,
    },
  }),
  validator("param", CreatorIdParam),
  async (c) => handleUpload(c),
);

libraryRoutes.get(
  "/:creatorId/library/assets",
  requireAuth,
  describeRoute({
    description: "Browse own assets and the requestable/open shared pool",
    tags: ["library"],
    responses: {
      200: {
        description: "Visible library assets with use status",
        content: { "application/json": { schema: resolver(ContentAssetListSchema) } },
      },
      400: ERROR_400,
      401: ERROR_401,
      403: ERROR_403,
      404: ERROR_404,
    },
  }),
  validator("param", CreatorIdParam),
  validator("query", ListQuery),
  async (c) => {
    const { actor } = await authorizeCreator(c);
    const query = c.req.valid("query");
    const before = parseCursor(query.before);
    const result = await listLibraryAssets(actor, {
      ...(query.limit === undefined ? {} : { limit: query.limit }),
      ...(before === undefined ? {} : { before }),
    });
    if (!result.ok) throw result.error;
    return c.json(result.value);
  },
);

libraryRoutes.get(
  "/:creatorId/library/assets/:id",
  requireAuth,
  describeRoute({
    description: "Get one own or shared-pool-visible asset",
    tags: ["library"],
    responses: {
      200: {
        description: "Library asset",
        content: { "application/json": { schema: resolver(ContentAssetSchema) } },
      },
      401: ERROR_401,
      403: ERROR_403,
      404: ERROR_404,
    },
  }),
  validator("param", AssetParams),
  async (c) => {
    const { actor } = await authorizeCreator(c);
    const result = await getLibraryAsset(actor, c.req.param("id"));
    if (!result.ok) throw result.error;
    return c.json(result.value);
  },
);

libraryRoutes.delete(
  "/:creatorId/library/assets/:id",
  requireAuth,
  describeRoute({
    description: "Soft-delete the caller's own library registration",
    tags: ["library"],
    responses: {
      204: { description: "Library asset deleted" },
      401: ERROR_401,
      403: ERROR_403,
      404: ERROR_404,
    },
  }),
  validator("param", AssetParams),
  async (c) => {
    const { actor } = await authorizeCreator(c);
    const result = await deleteLibraryAsset(actor, c.req.param("id"));
    if (!result.ok) throw result.error;
    return c.body(null, 204);
  },
);

libraryRoutes.post(
  "/:creatorId/library/assets/:id/grants",
  requireAuth,
  describeRoute({
    description: "Grant a creator use of a requestable asset (owner or admin)",
    tags: ["library"],
    responses: {
      204: { description: "Use grant recorded" },
      400: ERROR_400,
      401: ERROR_401,
      403: ERROR_403,
      404: ERROR_404,
    },
  }),
  validator("param", AssetParams),
  validator("json", ContentAssetGrantRequestSchema),
  async (c) => {
    const { actor } = await authorizeCreator(c);
    const body = c.req.valid("json");
    const result = await grantLibraryAssetUse(
      actor,
      c.req.param("id"),
      body.granteeCreatorId,
      c.get("user").id,
    );
    if (!result.ok) throw result.error;
    return c.body(null, 204);
  },
);

libraryRoutes.delete(
  "/:creatorId/library/assets/:id/grants/:granteeCreatorId",
  requireAuth,
  describeRoute({
    description: "Revoke a creator's asset-use grant (owner or admin)",
    tags: ["library"],
    responses: {
      204: { description: "Use grant revoked" },
      401: ERROR_401,
      403: ERROR_403,
      404: ERROR_404,
    },
  }),
  validator("param", GrantParams),
  async (c) => {
    const { actor } = await authorizeCreator(c);
    const result = await revokeLibraryAssetUse(
      actor,
      c.req.param("id"),
      c.req.param("granteeCreatorId"),
    );
    if (!result.ok) throw result.error;
    return c.body(null, 204);
  },
);
