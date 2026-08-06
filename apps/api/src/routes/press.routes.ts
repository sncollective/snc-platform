import { Hono } from "hono";
import type { Context } from "hono";
import { describeRoute, resolver, validator } from "hono-openapi";
import { z } from "zod";

import {
  ACCEPTED_MIME_TYPES,
  AppError,
  PressConfigPatchSchema,
  PressContentSchema,
  PressPagePayloadSchema,
  ReleaseOneSheetSchema,
  MAX_FILE_SIZES,
  NotFoundError,
  ValidationError,
} from "@snc/shared";

import type { AuthEnv } from "../middleware/auth-env.js";
import { optionalAuth } from "../middleware/optional-auth.js";
import { requireAuth } from "../middleware/require-auth.js";
import { ERROR_400, ERROR_401, ERROR_403, ERROR_404 } from "../lib/openapi-errors.js";
import { findCreatorProfile } from "../lib/creator-helpers.js";
import { sanitizeFilename, streamFile } from "../lib/file-utils.js";
import { requireCreatorPermission } from "../services/creator-team.js";
import { renderOnePagerPdf, renderOneSheetPdf } from "../services/press-pdf.js";
import { getPressConfig, upsertPressConfig } from "../services/press.js";
import { storage } from "../storage/index.js";
import { CreatorIdParam } from "./route-params.js";

const PhotoUploadResponseSchema = z.object({ key: z.string() });

// ── Private Helpers ──

const getEnabledPressContent = async (identifier: string) => {
  const profile = await findCreatorProfile(identifier, { activeOnly: true });
  if (!profile) throw new NotFoundError("Creator not found");

  const result = await getPressConfig(profile.id);
  if (!result.ok) throw result.error;
  if (result.value.enabled !== true) throw new NotFoundError("Press page not found");

  return { profile, content: result.value };
};

const getCreatorProfileForManage = async (identifier: string) => {
  const profile = await findCreatorProfile(identifier);
  if (!profile) throw new NotFoundError("Creator not found");
  return profile;
};

const handlePressPhotoStream = async (c: Context<AuthEnv>): Promise<Response> => {
  const { content } = await getEnabledPressContent(c.req.param("creatorId") ?? "");
  const key = content.photos[Number(c.req.param("index"))];
  if (!key) throw new NotFoundError("Press photo not found");
  return streamFile(c, storage, key, "press photo not found");
};

const handlePressPhotoUpload = async (c: Context<AuthEnv>): Promise<Response> => {
  const identifier = c.req.param("creatorId") ?? ""; // validated-upstream
  const user = c.get("user");

  // Pre-check Content-Length header before any DB lookup.
  const contentLengthHeader = c.req.header("content-length");
  if (contentLengthHeader) {
    const contentLength = parseInt(contentLengthHeader, 10);
    if (!Number.isNaN(contentLength) && contentLength > MAX_FILE_SIZES.image) {
      throw new ValidationError(
        `File size exceeds the ${MAX_FILE_SIZES.image} byte limit`,
      );
    }
  }

  const profile = await getCreatorProfileForManage(identifier);
  await requireCreatorPermission(user.id, profile.id, "editProfile");

  const body = await c.req.parseBody();
  const file = body["file"];
  if (!(file instanceof File)) {
    throw new ValidationError("No file provided in 'file' form field");
  }

  if (file.size > MAX_FILE_SIZES.image) {
    throw new ValidationError(
      `File size ${file.size} exceeds the ${MAX_FILE_SIZES.image} byte limit`,
    );
  }

  if (!(ACCEPTED_MIME_TYPES.image as readonly string[]).includes(file.type)) {
    throw new ValidationError(
      `Invalid MIME type '${file.type}'. Accepted: ${ACCEPTED_MIME_TYPES.image.join(", ")}`,
    );
  }

  const key = `creators/${profile.id}/press/${sanitizeFilename(file.name || "photo")}`;
  const uploadResult = await storage.upload(key, file.stream(), {
    contentType: file.type,
    contentLength: file.size,
  });

  if (!uploadResult.ok) {
    throw new AppError("UPLOAD_ERROR", "Failed to upload press photo", 500);
  }

  return c.json({ key });
};

// ── Public API ──

/** Public press pages and creator-managed press configuration routes. */
export const pressRoutes = new Hono<AuthEnv>();

// GET /:creatorId/press/one-pager.pdf — Public creator one-pager PDF
pressRoutes.get(
  "/:creatorId/press/one-pager.pdf",
  describeRoute({
    description: "Download a creator's public press one-pager as a PDF",
    tags: ["press"],
    responses: {
      200: {
        description: "Creator press one-pager PDF",
        content: {
          "application/pdf": { schema: { type: "string", format: "binary" } },
        },
      },
      404: ERROR_404,
    },
  }),
  optionalAuth,
  validator("param", CreatorIdParam),
  async (c) => {
    const { profile, content } = await getEnabledPressContent(c.req.param("creatorId") ?? "");
    const buffer = await renderOnePagerPdf({
      creator: { displayName: profile.displayName, handle: profile.handle },
      content,
    });
    return c.body(new Uint8Array(buffer), 200, { "Content-Type": "application/pdf" });
  },
);

// GET /:creatorId/press/releases/:releaseSlug/one-sheet.pdf — Public release PDF
pressRoutes.get(
  "/:creatorId/press/releases/:releaseSlug/one-sheet.pdf",
  describeRoute({
    description: "Download a public release one-sheet as a PDF",
    tags: ["press"],
    responses: {
      200: {
        description: "Release one-sheet PDF",
        content: {
          "application/pdf": { schema: { type: "string", format: "binary" } },
        },
      },
      404: ERROR_404,
    },
  }),
  optionalAuth,
  validator(
    "param",
    z.object({ creatorId: CreatorIdParam.shape.creatorId, releaseSlug: z.string().min(1) }),
  ),
  async (c) => {
    const { content } = await getEnabledPressContent(c.req.param("creatorId") ?? "");
    const release = content.releases.find(
      (candidate) => candidate.slug === c.req.param("releaseSlug"),
    );
    if (!release) throw new NotFoundError("Release not found");
    const buffer = await renderOneSheetPdf(release);
    return c.body(new Uint8Array(buffer), 200, { "Content-Type": "application/pdf" });
  },
);

// GET /:creatorId/press/photos/:index — Stream a public press photo
pressRoutes.get(
  "/:creatorId/press/photos/:index",
  describeRoute({
    description: "Stream a public press photo for a creator",
    tags: ["press"],
    responses: {
      200: {
        description: "Press photo stream",
        content: {
          "application/octet-stream": {
            schema: { type: "string", format: "binary" },
          },
        },
      },
      404: ERROR_404,
    },
  }),
  optionalAuth,
  validator(
    "param",
    z.object({ creatorId: CreatorIdParam.shape.creatorId, index: z.string() }),
  ),
  async (c) => handlePressPhotoStream(c),
);

// GET /:creatorId/press — Public press page payload
pressRoutes.get(
  "/:creatorId/press",
  describeRoute({
    description: "Get the public press-page payload for a creator",
    tags: ["press"],
    responses: {
      200: {
        description: "Press-page payload",
        content: { "application/json": { schema: resolver(PressPagePayloadSchema) } },
      },
      404: ERROR_404,
    },
  }),
  optionalAuth,
  validator("param", CreatorIdParam),
  async (c) => {
    const { profile, content } = await getEnabledPressContent(c.req.param("creatorId") ?? "");
    return c.json({
      creator: {
        id: profile.id,
        handle: profile.handle,
        displayName: profile.displayName,
        location: content.location ?? null,
      },
      content,
    });
  },
);

// GET /:creatorId/press/releases/:releaseSlug — Public release one-sheet
pressRoutes.get(
  "/:creatorId/press/releases/:releaseSlug",
  describeRoute({
    description: "Get a public press one-sheet for a creator release",
    tags: ["press"],
    responses: {
      200: {
        description: "Release one-sheet",
        content: { "application/json": { schema: resolver(ReleaseOneSheetSchema) } },
      },
      404: ERROR_404,
    },
  }),
  optionalAuth,
  validator("param", z.object({ creatorId: CreatorIdParam.shape.creatorId, releaseSlug: z.string().min(1) })),
  async (c) => {
    const { content } = await getEnabledPressContent(c.req.param("creatorId") ?? "");
    const release = content.releases.find(
      (candidate) => candidate.slug === c.req.param("releaseSlug"),
    );
    if (!release) throw new NotFoundError("Release not found");
    return c.json(release);
  },
);

// GET /:creatorId/press-config — Read config for an editor
pressRoutes.get(
  "/:creatorId/press-config",
  requireAuth,
  describeRoute({
    description: "Read a creator's press-page configuration (creator members only)",
    tags: ["press"],
    responses: {
      200: {
        description: "Press config",
        content: { "application/json": { schema: resolver(PressContentSchema) } },
      },
      401: ERROR_401,
      403: ERROR_403,
      404: ERROR_404,
    },
  }),
  validator("param", CreatorIdParam),
  async (c) => {
    const profile = await getCreatorProfileForManage(c.req.param("creatorId") ?? "");
    const user = c.get("user");
    await requireCreatorPermission(user.id, profile.id, "editProfile");

    const result = await getPressConfig(profile.id);
    if (!result.ok) throw result.error;
    return c.json(result.value);
  },
);

// PATCH /:creatorId/press-config — Update config for an editor
pressRoutes.patch(
  "/:creatorId/press-config",
  requireAuth,
  describeRoute({
    description: "Update a creator's press-page configuration (creator members only)",
    tags: ["press"],
    responses: {
      200: {
        description: "Updated press config",
        content: { "application/json": { schema: resolver(PressContentSchema) } },
      },
      400: ERROR_400,
      401: ERROR_401,
      403: ERROR_403,
      404: ERROR_404,
    },
  }),
  validator("param", CreatorIdParam),
  validator("json", PressConfigPatchSchema),
  async (c) => {
    const profile = await getCreatorProfileForManage(c.req.param("creatorId") ?? "");
    const user = c.get("user");
    await requireCreatorPermission(user.id, profile.id, "editProfile");

    const patch = c.req.valid("json" as never) as z.infer<typeof PressConfigPatchSchema>;
    const result = await upsertPressConfig(profile.id, patch);
    if (!result.ok) throw result.error;
    return c.json(result.value);
  },
);

// POST /:creatorId/press/photos — Upload a press photo
pressRoutes.post(
  "/:creatorId/press/photos",
  requireAuth,
  describeRoute({
    description: "Upload a press photo for a creator (owner/editor)",
    tags: ["press"],
    responses: {
      200: {
        description: "Press photo uploaded",
        content: { "application/json": { schema: resolver(PhotoUploadResponseSchema) } },
      },
      400: ERROR_400,
      401: ERROR_401,
      403: ERROR_403,
      404: ERROR_404,
    },
  }),
  validator("param", CreatorIdParam),
  async (c) => handlePressPhotoUpload(c),
);
