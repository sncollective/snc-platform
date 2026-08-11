import { z } from "zod";

/** Canonical storage key for a content-addressed asset: library/{ab}/{hash}.{ext}. */
export const LIBRARY_KEY_RE = /^library\/[0-9a-f]{2}\/[0-9a-f]{64}\.(jpg|png|webp)$/;

/** Structural classifier only — does not authorize use. */
export const isLibraryAssetKey = (key: string): boolean => LIBRARY_KEY_RE.test(key);

/** Strip the library prefix to produce the raw-route path segment. */
export const libraryRawPath = (key: string): string =>
  isLibraryAssetKey(key) ? key.slice("library/".length) : "";

/** Accepted image formats, as detected from the file's allowlisted magic bytes. */
export const PressImageMimeSchema = z.enum(["image/jpeg", "image/png", "image/webp"]);

/** Discovery and use posture chosen by the asset registrant. */
export const ContentAssetSharingSchema = z.enum(["private", "requestable", "open"]);
export type ContentAssetSharing = z.infer<typeof ContentAssetSharingSchema>;

/** Why the browsing actor can, or cannot yet, use an asset. */
export const ContentAssetUseStatusSchema = z.enum([
  "own",
  "admin",
  "open",
  "granted",
  "requestable-needs-grant",
]);
export type ContentAssetUseStatus = z.infer<typeof ContentAssetUseStatusSchema>;

/** A live asset registration joined to its immutable blob metadata. */
export const ContentAssetSchema = z.object({
  id: z.string().uuid(),
  creatorId: z.string().nullable(),
  blobSha256: z.string().regex(/^[0-9a-f]{64}$/),
  sharing: ContentAssetSharingSchema,
  originalFilename: z.string().nullable(),
  createdAt: z.string().datetime(),
  storageKey: z.string().regex(LIBRARY_KEY_RE),
  mimeType: PressImageMimeSchema,
  size: z.number().int().nonnegative(),
  width: z.number().int().positive().nullable(),
  height: z.number().int().positive().nullable(),
  canUse: z.boolean(),
  useStatus: ContentAssetUseStatusSchema,
});
export type ContentAsset = z.infer<typeof ContentAssetSchema>;

/** Upload response; deduped means existing bytes or a registration satisfied it. */
export const ContentAssetUploadResponseSchema = ContentAssetSchema.extend({
  deduped: z.boolean(),
});
export type ContentAssetUploadResponse = z.infer<typeof ContentAssetUploadResponseSchema>;

/** Paginated, newest-first library response. */
export const ContentAssetListSchema = z.object({
  items: z.array(ContentAssetSchema),
  nextCursor: z.string().nullable(),
});
export type ContentAssetList = z.infer<typeof ContentAssetListSchema>;

/** Grant one creator use of a requestable asset. */
export const ContentAssetGrantRequestSchema = z.object({
  granteeCreatorId: z.string().min(1),
});
export type ContentAssetGrantRequest = z.infer<typeof ContentAssetGrantRequestSchema>;
