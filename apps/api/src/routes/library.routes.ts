import { Hono } from "hono";
import type { Context } from "hono";
import { describeRoute, resolver, validator } from "hono-openapi";
import { z } from "zod";

import {
  ACCEPTED_MIME_TYPES,
  ContentAssetListSchema,
  ContentAssetSchema,
  ContentAssetUploadResponseSchema,
  MAX_FILE_SIZES,
  NotFoundError,
  ValidationError,
} from "@snc/shared";

import type { AuthEnv } from "../middleware/auth-env.js";
import { requireAuth } from "../middleware/require-auth.js";
import { ERROR_400, ERROR_401, ERROR_403, ERROR_404 } from "../lib/openapi-errors.js";
import { findCreatorProfile } from "../lib/creator-helpers.js";
import { requireCreatorPermission } from "../services/creator-team.js";
import {
  deleteLibraryAsset,
  getLibraryAsset,
  listLibraryAssets,
  uploadLibraryAsset,
} from "../services/library.js";
import { CreatorIdParam } from "./route-params.js";

const AssetParams = z.object({
  creatorId: CreatorIdParam.shape.creatorId,
  id: z.string().uuid(),
});

const ListQuery = z.object({
  limit: z.coerce.number().int().positive().optional(),
  before: z.string().min(1).optional(),
});

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

const authorizeCreator = async (c: Context<AuthEnv>) => {
  const profile = await getCreatorForManage(c.req.param("creatorId") ?? "");
  await requireCreatorPermission(c.get("user").id, profile.id, "editProfile");
  return profile;
};

const handleUpload = async (c: Context<AuthEnv>): Promise<Response> => {
  const contentLengthHeader = c.req.header("content-length");
  if (contentLengthHeader) {
    const contentLength = Number.parseInt(contentLengthHeader, 10);
    if (!Number.isNaN(contentLength) && contentLength > MAX_FILE_SIZES.image) {
      throw new ValidationError(`File size exceeds the ${MAX_FILE_SIZES.image} byte limit`);
    }
  }

  const profile = await authorizeCreator(c);
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

  const bytes = new Uint8Array(await file.arrayBuffer());
  const result = await uploadLibraryAsset(profile.id, {
    ...(file.name ? { name: file.name } : {}),
    declaredType: file.type,
    size: file.size,
    bytes,
  });
  if (!result.ok) throw result.error;
  return c.json({ ...result.value.asset, deduped: result.value.deduped });
};

/** Authenticated creator library registry routes. */
export const libraryRoutes = new Hono<AuthEnv>();

libraryRoutes.post(
  "/:creatorId/library/assets",
  requireAuth,
  describeRoute({
    description: "Register an image in a creator's content library",
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
    description: "List a creator's live content library assets",
    tags: ["library"],
    responses: {
      200: {
        description: "Library assets",
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
    const profile = await authorizeCreator(c);
    const query = c.req.valid("query");
    const before = parseCursor(query.before);
    const result = await listLibraryAssets(
      profile.id,
      {
        ...(query.limit === undefined ? {} : { limit: query.limit }),
        ...(before === undefined ? {} : { before }),
      },
    );
    if (!result.ok) throw result.error;
    return c.json(result.value);
  },
);

libraryRoutes.get(
  "/:creatorId/library/assets/:id",
  requireAuth,
  describeRoute({
    description: "Get one live content library asset",
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
    const profile = await authorizeCreator(c);
    const result = await getLibraryAsset(profile.id, c.req.param("id"));
    if (!result.ok) throw result.error;
    return c.json(result.value);
  },
);

libraryRoutes.delete(
  "/:creatorId/library/assets/:id",
  requireAuth,
  describeRoute({
    description: "Soft-delete a content library asset registration",
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
    const profile = await authorizeCreator(c);
    const result = await deleteLibraryAsset(profile.id, c.req.param("id"));
    if (!result.ok) throw result.error;
    return c.body(null, 204);
  },
);
