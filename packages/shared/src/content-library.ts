import { z } from "zod";

/** Canonical storage key for a content-addressed asset: library/{ab}/{hash}.{ext}. */
export const LIBRARY_KEY_RE = /^library\/[0-9a-f]{2}\/[0-9a-f]{64}\.(jpg|png|webp)$/;

/** Structural classifier only — does not authorize ownership. */
export const isLibraryAssetKey = (key: string): boolean => LIBRARY_KEY_RE.test(key);

/** Strip the library prefix to produce the raw-route path segment. */
export const libraryRawPath = (key: string): string =>
  isLibraryAssetKey(key) ? key.slice("library/".length) : "";

/** Accepted image formats, as detected from magic bytes by image-size. */
export const PressImageMimeSchema = z.enum(["image/jpeg", "image/png", "image/webp"]);

/** A registered media asset in a creator's library. */
export const ContentAssetSchema = z.object({
  id: z.string().uuid(),
  ownerCreatorId: z.string(),
  sha256: z.string().regex(/^[0-9a-f]{64}$/),
  storageKey: z.string().regex(LIBRARY_KEY_RE),
  mimeType: PressImageMimeSchema,
  size: z.number().int().nonnegative(),
  width: z.number().int().positive().nullable(),
  height: z.number().int().positive().nullable(),
  originalFilename: z.string().nullable(),
  createdAt: z.string().datetime(),
});
export type ContentAsset = z.infer<typeof ContentAssetSchema>;

/** Upload response; deduped means an existing registration or blob satisfied it. */
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
