import { Hono } from "hono";
import type { Context } from "hono";
import { describeRoute, resolver, validator } from "hono-openapi";
import { z } from "zod";

import {
  DraftPressConfigPatchSchema,
  DraftPressContentSchema,
  PressContentSchema,
  PressImageCropSchema,
  PressImageSlotSchema,
  PressPagePayloadSchema,
  ReleaseOneSheetSchema,
  NotFoundError,
  ValidationError,
  isLibraryAssetKey,
  isOwnedPressKey,
} from "@snc/shared";

import type { AuthEnv } from "../middleware/auth-env.js";
import { optionalAuth } from "../middleware/optional-auth.js";
import { rateLimiter } from "../middleware/rate-limit.js";
import { requireAuth } from "../middleware/require-auth.js";
import { ERROR_400, ERROR_401, ERROR_403, ERROR_404 } from "../lib/openapi-errors.js";
import { findCreatorProfile } from "../lib/creator-helpers.js";
import { streamFile } from "../lib/file-utils.js";
import { getFrontendBaseUrl } from "../lib/route-utils.js";
import { buildPressImageUrl } from "../lib/imgproxy.js";
import {
  DeliveredPressContentSchema,
  resolvePressPageContent,
} from "../lib/press-url.js";
import { requireCreatorPermission } from "../services/creator-team.js";
import { BrowserPdfSinglePageFitError } from "../services/browser-pdf.js";
import type { LibraryActor } from "../services/library.js";
import { validateOwnedPressKeys } from "../services/press-images.js";
import {
  ONE_SHEET_ORIENTATIONS,
  renderCreatorOneSheetPdf,
  renderOnePagerPdf,
  renderReleaseOneSheetPdf,
} from "../services/press-pdf.js";
import {
  discardPressDraft,
  getPressConfig,
  getPressDraftConfig,
  publishPressConfig,
  unpublishPressConfig,
  upsertPressConfig,
} from "../services/press.js";
import { storage } from "../storage/index.js";
import { CreatorIdParam } from "./route-params.js";

const PressImagePreviewRequestSchema = z.object({
  key: z.string().min(1),
  crop: PressImageCropSchema.optional(),
  slot: PressImageSlotSchema,
  width: z.number().int().min(160).max(3840),
});
const PressImageDescriptorSchema = z.object({
  src: z.string(),
  srcSet: z.string(),
  sizes: z.string(),
});
const DeliveredPressPagePayloadSchema = PressPagePayloadSchema.extend({
  content: DeliveredPressContentSchema,
});
const PressOneSheetQuerySchema = z.object({
  orientation: z.enum(ONE_SHEET_ORIENTATIONS).default("auto"),
  url: z.string().url().max(512).refine(
    (value) => ["http:", "https:"].includes(new URL(value).protocol),
    "QR destination must use HTTP or HTTPS",
  ).optional(),
});
const pressPdfRateLimiter = rateLimiter({ windowMs: 60_000, max: 6 });

// ── Private Helpers ──

const pressPageUrl = (creatorPath: string): string =>
  `${process.env.PRESS_RENDER_BASE_URL ?? getFrontendBaseUrl()}/creators/${creatorPath}/press`;

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
  const { profile, content } = await getEnabledPressContent(
    c.req.param("creatorId") ?? "",
  );
  const key = content.photos[Number(c.req.param("index"))];
  if (!key) throw new NotFoundError("Press photo not found");
  if (!isOwnedPressKey(key, profile.id) && !isLibraryAssetKey(key)) {
    throw new NotFoundError("Press photo not found");
  }
  // Persisted library references are passively grandfathered after grant
  // revocation, but the v1 endpoint continues to stream bytes with its original
  // 200 response contract. New references still pass PATCH authorization.
  return streamFile(c, storage, key, "press photo not found");
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
  pressPdfRateLimiter,
  optionalAuth,
  validator("param", CreatorIdParam),
  async (c) => {
    const { profile } = await getEnabledPressContent(c.req.param("creatorId") ?? "");
    const creatorPath = encodeURIComponent(profile.handle ?? profile.id);
    const buffer = await renderOnePagerPdf({
      pageUrl: pressPageUrl(creatorPath),
      exportIdentity: {
        producingUnit: "records",
        federationHandle: profile.handle,
        creatorBrandColor: profile.brandColor ?? null,
      },
    });
    return c.body(new Uint8Array(buffer), 200, {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${profile.handle ?? profile.id}-press-kit.pdf"`,
    });
  },
);

// GET /:creatorId/press/one-sheet.pdf — Public curated creator one-sheet PDF
pressRoutes.get(
  "/:creatorId/press/one-sheet.pdf",
  describeRoute({
    description: "Download a creator's curated single-page press sheet as a PDF",
    tags: ["press"],
    responses: {
      200: {
        description: "Creator press one-sheet PDF",
        content: {
          "application/pdf": { schema: { type: "string", format: "binary" } },
        },
      },
      400: ERROR_400,
      404: ERROR_404,
    },
  }),
  pressPdfRateLimiter,
  optionalAuth,
  validator("param", CreatorIdParam),
  validator("query", PressOneSheetQuerySchema),
  async (c) => {
    const { profile, content } = await getEnabledPressContent(c.req.param("creatorId") ?? "");
    const creatorPath = encodeURIComponent(profile.handle ?? profile.id);
    const query = c.req.valid("query");
    let buffer: Buffer;
    try {
      buffer = await renderCreatorOneSheetPdf({
        creator: {
          id: profile.id,
          displayName: profile.displayName,
          handle: profile.handle,
          socialLinks: profile.socialLinks,
        },
        content,
        pressPageUrl: pressPageUrl(creatorPath),
        exportIdentity: {
          producingUnit: "records",
          federationHandle: profile.handle,
          creatorBrandColor: profile.brandColor ?? null,
        },
        ...(query.url ? { destinationUrl: query.url } : {}),
        orientation: query.orientation,
      });
    } catch (error) {
      if (error instanceof BrowserPdfSinglePageFitError) {
        throw new ValidationError(
          `Creator one-sheet does not fit one page even at compressed density (${error.message.replace(/^Press one-sheet does not fit one page: /, "")}). Shorten the bio or reduce members/highlights, then retry.`,
        );
      }
      throw error;
    }
    return c.body(new Uint8Array(buffer), 200, {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${profile.handle ?? profile.id}-one-sheet.pdf"`,
    });
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
  pressPdfRateLimiter,
  optionalAuth,
  validator(
    "param",
    z.object({ creatorId: CreatorIdParam.shape.creatorId, releaseSlug: z.string().min(1) }),
  ),
  async (c) => {
    const { profile, content } = await getEnabledPressContent(c.req.param("creatorId") ?? "");
    const release = content.releases.find(
      (candidate) => candidate.slug === c.req.param("releaseSlug"),
    );
    if (!release) throw new NotFoundError("Release not found");
    const creatorPath = encodeURIComponent(profile.handle ?? profile.id);
    const buffer = await renderReleaseOneSheetPdf({
      release,
      creatorId: profile.id,
      pressPageUrl: pressPageUrl(creatorPath),
      exportIdentity: {
        producingUnit: "records",
        federationHandle: profile.handle,
        creatorBrandColor: profile.brandColor ?? null,
      },
    });
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
        content: { "application/json": { schema: resolver(DeliveredPressPagePayloadSchema) } },
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
      content: resolvePressPageContent(content),
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
        content: { "application/json": { schema: resolver(DraftPressContentSchema) } },
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

    const result = await getPressDraftConfig(profile.id);
    if (!result.ok) throw result.error;
    return c.json(result.value);
  },
);

// PATCH /:creatorId/press-config — Save a draft config for an editor
pressRoutes.patch(
  "/:creatorId/press-config",
  requireAuth,
  describeRoute({
    description: "Update a creator's press-page configuration (creator members only)",
    tags: ["press"],
    responses: {
      200: {
        description: "Updated press config",
        content: { "application/json": { schema: resolver(DraftPressContentSchema) } },
      },
      400: ERROR_400,
      401: ERROR_401,
      403: ERROR_403,
      404: ERROR_404,
    },
  }),
  validator("param", CreatorIdParam),
  validator("json", DraftPressConfigPatchSchema),
  async (c) => {
    const profile = await getCreatorProfileForManage(c.req.param("creatorId") ?? "");
    const user = c.get("user");
    const roles = c.get("roles") ?? [];
    await requireCreatorPermission(user.id, profile.id, "editProfile", roles);

    const patch = c.req.valid("json" as never) as z.infer<typeof DraftPressConfigPatchSchema>;
    await validateOwnedPressKeys(patch, {
      creatorId: profile.id,
      isAdmin: roles.includes("admin"),
    });

    const result = await upsertPressConfig(profile.id, patch);
    if (!result.ok) throw result.error;
    return c.json(result.value);
  },
);

// POST /:creatorId/press-config/publish — Publish the pending draft
pressRoutes.post(
  "/:creatorId/press-config/publish",
  requireAuth,
  describeRoute({
    description: "Publish a creator's pending press-page draft",
    tags: ["press"],
    responses: {
      200: {
        description: "Published press config",
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
    const roles = c.get("roles") ?? [];
    await requireCreatorPermission(user.id, profile.id, "editProfile", roles);

    const result = await publishPressConfig(profile.id);
    if (!result.ok) throw result.error;
    return c.json(result.value);
  },
);

// POST /:creatorId/press-config/unpublish — Hide the live page and retain its draft
pressRoutes.post(
  "/:creatorId/press-config/unpublish",
  requireAuth,
  describeRoute({
    description: "Unpublish a creator's press page while retaining its draft",
    tags: ["press"],
    responses: {
      200: {
        description: "Unpublished press config",
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
    const roles = c.get("roles") ?? [];
    await requireCreatorPermission(user.id, profile.id, "editProfile", roles);

    const result = await unpublishPressConfig(profile.id);
    if (!result.ok) throw result.error;
    return c.json(result.value);
  },
);

// POST /:creatorId/press-config/discard-draft — Discard a pending draft
pressRoutes.post(
  "/:creatorId/press-config/discard-draft",
  requireAuth,
  describeRoute({
    description: "Discard a creator's pending press-page draft",
    tags: ["press"],
    responses: {
      200: {
        description: "Published press config",
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
    const roles = c.get("roles") ?? [];
    await requireCreatorPermission(user.id, profile.id, "editProfile", roles);

    const result = await discardPressDraft(profile.id);
    if (!result.ok) throw result.error;
    return c.json(result.value);
  },
);

// GET /:creatorId/press/image-source — Stream an owned legacy image to the manage editor
pressRoutes.get(
  "/:creatorId/press/image-source",
  requireAuth,
  describeRoute({
    description: "Stream an owned legacy press image for editing",
    tags: ["press"],
    responses: {
      200: {
        description: "Legacy press image stream",
        content: {
          "application/octet-stream": {
            schema: { type: "string", format: "binary" },
          },
        },
      },
      401: ERROR_401,
      403: ERROR_403,
      404: ERROR_404,
    },
  }),
  validator("param", CreatorIdParam),
  validator("query", z.object({ key: z.string().min(1) })),
  async (c) => {
    const profile = await getCreatorProfileForManage(c.req.param("creatorId") ?? "");
    const user = c.get("user");
    const roles = c.get("roles") ?? [];
    await requireCreatorPermission(user.id, profile.id, "editProfile", roles);

    const { key } = c.req.valid("query");
    if (!isOwnedPressKey(key, profile.id)) throw new NotFoundError("Press image not found");
    return streamFile(c, storage, key, "press image not found");
  },
);

// POST /:creatorId/press/image-preview — Sign the eventual press image render
pressRoutes.post(
  "/:creatorId/press/image-preview",
  requireAuth,
  describeRoute({
    description: "Preview a creator-authorized press image crop",
    tags: ["press"],
    responses: {
      200: {
        description: "Signed press image descriptor",
        content: { "application/json": { schema: resolver(PressImageDescriptorSchema) } },
      },
      400: ERROR_400,
      401: ERROR_401,
      403: ERROR_403,
      404: ERROR_404,
    },
  }),
  validator("param", CreatorIdParam),
  validator("json", PressImagePreviewRequestSchema),
  async (c) => {
    const profile = await getCreatorProfileForManage(c.req.param("creatorId") ?? "");
    const user = c.get("user");
    const roles = c.get("roles") ?? [];
    await requireCreatorPermission(user.id, profile.id, "editProfile", roles);

    const body = c.req.valid("json");
    const actor = {
      creatorId: profile.id,
      isAdmin: roles.includes("admin"),
    } satisfies LibraryActor;
    const image = {
      key: body.key,
      alt: "",
      ...(body.crop ? { crop: body.crop } : {}),
    };
    await validateOwnedPressKeys({ gallery: [image] }, actor);

    return c.json(buildPressImageUrl(image, body.slot, body.width));
  },
);
