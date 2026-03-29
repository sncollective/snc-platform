import { Hono } from "hono";
import type { Context } from "hono";
import { describeRoute, resolver, validator } from "hono-openapi";
import { eq } from "drizzle-orm";

import {
  CreatorProfileResponseSchema,
  NotFoundError,
  ValidationError,
  AppError,
  ACCEPTED_MIME_TYPES,
  MAX_FILE_SIZES,
} from "@snc/shared";

import { db } from "../db/connection.js";
import { creatorProfiles } from "../db/schema/creator.schema.js";
import { requireAuth } from "../middleware/require-auth.js";
import { storage } from "../storage/index.js";
import type { AuthEnv } from "../middleware/auth-env.js";
import { ERROR_400, ERROR_401, ERROR_403, ERROR_404 } from "../lib/openapi-errors.js";
import { sanitizeFilename, streamFile } from "../lib/file-utils.js";
import { requireCreatorPermission } from "../services/creator-team.js";
import { findCreatorProfile, getContentCount, toProfileResponse } from "../lib/creator-helpers.js";
import { CreatorIdParam } from "./route-params.js";

// ── Private Helpers ──

const handleImageUpload = async (
  c: Context<AuthEnv>,
  field: "avatar" | "banner",
): Promise<Response> => {
  const identifier = c.req.param("creatorId") ?? ""; // validated-upstream
  const user = c.get("user");

  // Pre-check Content-Length header before any DB lookup
  const contentLengthHeader = c.req.header("content-length");
  if (contentLengthHeader) {
    const contentLength = parseInt(contentLengthHeader, 10);
    if (!Number.isNaN(contentLength) && contentLength > MAX_FILE_SIZES.image) {
      throw new ValidationError(
        `File size exceeds the ${MAX_FILE_SIZES.image} byte limit`,
      );
    }
  }

  // Resolve profile (by UUID or handle)
  const profile = await findCreatorProfile(identifier);
  if (!profile) {
    throw new NotFoundError("Creator profile not found");
  }

  // Permission check using canonical profile ID
  await requireCreatorPermission(user.id, profile.id, "editProfile");

  // Parse multipart body
  const body = await c.req.parseBody();
  const file = body["file"];
  if (!(file instanceof File)) {
    throw new ValidationError("No file provided in 'file' form field");
  }

  // Validate actual file size
  if (file.size > MAX_FILE_SIZES.image) {
    throw new ValidationError(
      `File size ${file.size} exceeds the ${MAX_FILE_SIZES.image} byte limit`,
    );
  }

  // Validate MIME type
  if (!(ACCEPTED_MIME_TYPES.image as readonly string[]).includes(file.type)) {
    throw new ValidationError(
      `Invalid MIME type '${file.type}'. Accepted: ${ACCEPTED_MIME_TYPES.image.join(", ")}`,
    );
  }

  // Generate storage key using canonical profile ID
  const sanitized = sanitizeFilename(file.name || field);
  const key = `creators/${profile.id}/${field}/${sanitized}`;

  // Delete old file if re-uploading
  const oldKey = field === "avatar" ? profile.avatarKey : profile.bannerKey;
  if (oldKey) {
    const deleteResult = await storage.delete(oldKey);
    if (!deleteResult.ok) {
      c.var.logger.warn({ error: deleteResult.error.message, field }, "Failed to delete old file");
    }
  }

  // Upload new file
  const stream = file.stream();
  const uploadResult = await storage.upload(key, stream, {
    contentType: file.type,
    contentLength: file.size,
  });

  if (!uploadResult.ok) {
    throw new AppError("UPLOAD_ERROR", `Failed to upload ${field}`, 500);
  }

  // Update DB with new storage key
  const [updated] = await db
    .update(creatorProfiles)
    .set({
      [field === "avatar" ? "avatarKey" : "bannerKey"]: key,
      updatedAt: new Date(),
    })
    .where(eq(creatorProfiles.id, profile.id))
    .returning();

  if (!updated) {
    throw new NotFoundError("Creator profile not found");
  }

  const contentCount = await getContentCount(profile.id);
  const response = toProfileResponse(updated, contentCount);
  return c.json(response);
};

const handleImageStream = async (
  c: Context,
  field: "avatar" | "banner",
): Promise<Response> => {
  const profile = await findCreatorProfile(c.req.param("creatorId") ?? ""); // validated-upstream
  const key = field === "avatar" ? profile?.avatarKey : profile?.bannerKey;
  if (!profile || !key) throw new NotFoundError(`${field} not found`);
  return streamFile(c, storage, key, `${field} file not found`);
};

// ── Public API ──

/** Creator media upload and streaming routes. */
export const creatorMediaRoutes = new Hono<AuthEnv>();

// POST /:creatorId/avatar — Upload avatar image
creatorMediaRoutes.post(
  "/:creatorId/avatar",
  requireAuth,
  describeRoute({
    description: "Upload avatar image for a creator profile (owner/editor)",
    tags: ["creators"],
    responses: {
      200: {
        description: "Avatar uploaded, updated creator profile returned",
        content: {
          "application/json": {
            schema: resolver(CreatorProfileResponseSchema),
          },
        },
      },
      400: ERROR_400,
      401: ERROR_401,
      403: ERROR_403,
    },
  }),
  validator("param", CreatorIdParam),
  async (c) => handleImageUpload(c, "avatar"),
);

// POST /:creatorId/banner — Upload banner image
creatorMediaRoutes.post(
  "/:creatorId/banner",
  requireAuth,
  describeRoute({
    description: "Upload banner image for a creator profile (owner/editor)",
    tags: ["creators"],
    responses: {
      200: {
        description: "Banner uploaded, updated creator profile returned",
        content: {
          "application/json": {
            schema: resolver(CreatorProfileResponseSchema),
          },
        },
      },
      400: ERROR_400,
      401: ERROR_401,
      403: ERROR_403,
    },
  }),
  validator("param", CreatorIdParam),
  async (c) => handleImageUpload(c, "banner"),
);

// GET /:creatorId/avatar — Stream avatar image
creatorMediaRoutes.get(
  "/:creatorId/avatar",
  describeRoute({
    description: "Stream the avatar image for a creator",
    tags: ["creators"],
    responses: {
      200: {
        description: "Avatar image stream",
        content: {
          "application/octet-stream": {
            schema: { type: "string", format: "binary" },
          },
        },
      },
      404: ERROR_404,
    },
  }),
  validator("param", CreatorIdParam),
  async (c) => handleImageStream(c, "avatar"),
);

// GET /:creatorId/banner — Stream banner image
creatorMediaRoutes.get(
  "/:creatorId/banner",
  describeRoute({
    description: "Stream the banner image for a creator",
    tags: ["creators"],
    responses: {
      200: {
        description: "Banner image stream",
        content: {
          "application/octet-stream": {
            schema: { type: "string", format: "binary" },
          },
        },
      },
      404: ERROR_404,
    },
  }),
  validator("param", CreatorIdParam),
  async (c) => handleImageStream(c, "banner"),
);
