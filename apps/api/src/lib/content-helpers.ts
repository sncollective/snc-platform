import { and, eq, isNull } from "drizzle-orm";

import type { ContentResponse, ResponsiveImage } from "@snc/shared";
import { NotFoundError } from "@snc/shared";

import { db } from "../db/connection.js";
import { content } from "../db/schema/content.schema.js";
import { requireCreatorPermission } from "../services/creator-team.js";
import { config } from "../config.js";
import { buildImgproxyUrl, buildSrcSet, THUMBNAIL_WIDTHS } from "./imgproxy.js";
import { toISO, toISOOrNull } from "./response-helpers.js";

type ContentRow = typeof content.$inferSelect;

const THUMBNAIL_SIZES = "(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw";

/**
 * Cache-bust token for the stable `/api/content/:id/{media,thumbnail}` serving
 * paths. The path doesn't change when the underlying storage key is replaced, so
 * without this the browser (and `<video>` media cache) can serve the prior
 * response for the route's full max-age after a replace. `updatedAt` is bumped on
 * every media upload/replace, so keying on it refreshes the cache key exactly when
 * the bytes change. (The imgproxy `thumbnail` srcSet is keyed on `thumbnailKey`,
 * which already changes on replace, so it needs no bust.)
 */
const cacheBust = (updatedAt: Date): string => `?v=${updatedAt.getTime()}`;

/** Build a ResponsiveImage object for a content thumbnail, or null if no key. */
const buildThumbnail = (
  id: string,
  thumbnailKey: string | null,
  updatedAt: Date,
): { thumbnailUrl: string | null; thumbnail: ResponsiveImage | null } => {
  const fallbackUrl = thumbnailKey
    ? `/api/content/${id}/thumbnail${cacheBust(updatedAt)}`
    : null;

  if (!thumbnailKey || !config.IMGPROXY_URL) {
    return { thumbnailUrl: fallbackUrl, thumbnail: null };
  }

  const src = buildImgproxyUrl(thumbnailKey, 640);
  const srcSet = buildSrcSet(thumbnailKey, THUMBNAIL_WIDTHS);
  return {
    thumbnailUrl: fallbackUrl,
    thumbnail: { src, srcSet, sizes: THUMBNAIL_SIZES },
  };
};

export type { ContentRow };

/** Map a content DB row to an API response, converting storage keys to serving URLs. */
export const resolveContentUrls = (row: ContentRow): ContentResponse => {
  const { thumbnailUrl, thumbnail } = buildThumbnail(
    row.id,
    row.thumbnailKey,
    row.updatedAt,
  );
  return {
    id: row.id,
    creatorId: row.creatorId,
    slug: row.slug ?? null,
    type: row.type,
    title: row.title,
    body: row.body ?? null,
    description: row.description ?? null,
    visibility: row.visibility,
    sourceType: row.sourceType,
    thumbnailUrl,
    thumbnail,
    mediaUrl: row.mediaKey
      ? `/api/content/${row.id}/media${cacheBust(row.updatedAt)}`
      : null,
    publishedAt: toISOOrNull(row.publishedAt),
    createdAt: toISO(row.createdAt),
    updatedAt: toISO(row.updatedAt),
    processingStatus: row.processingStatus ?? null,
    videoCodec: row.videoCodec ?? null,
    audioCodec: row.audioCodec ?? null,
    width: row.width ?? null,
    height: row.height ?? null,
    duration: row.duration ?? null,
    bitrate: row.bitrate ?? null,
  };
};

/** Find a content row by ID, excluding soft-deleted records. */
export const findActiveContent = async (
  id: string,
): Promise<ContentRow | undefined> => {
  const rows = await db
    .select()
    .from(content)
    .where(and(eq(content.id, id), isNull(content.deletedAt)));
  return rows[0];
};

/**
 * Assert content exists and the user has ownership permission.
 *
 * @throws {NotFoundError} When the content does not exist.
 * @throws {ForbiddenError} When the user lacks the `manageContent` permission.
 */
export const requireContentOwnership = async (
  id: string,
  userId: string,
): Promise<ContentRow> => {
  const existing = await findActiveContent(id);
  if (!existing) {
    throw new NotFoundError("Content not found");
  }
  await requireCreatorPermission(userId, existing.creatorId, "manageContent");
  return existing;
};
