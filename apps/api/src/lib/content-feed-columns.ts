import type { FeedItem } from "@snc/shared";

import { content } from "../db/schema/content.schema.js";
import { creatorProfiles } from "../db/schema/creator.schema.js";
import { resolveContentUrls } from "./content-helpers.js";
import type { ContentRow } from "./content-helpers.js";

/**
 * A content row joined with its creator's public profile fields.
 *
 * The shape produced by selecting {@link CONTENT_FEED_COLUMNS} — a base
 * {@link ContentRow} plus the creator name/handle/status pulled from the join.
 */
export type FeedRow = ContentRow & {
  creatorName: string | null;
  creatorHandle: string | null;
  creatorStatus: string | null;
};

/**
 * Column selection for content-feed queries.
 *
 * Pairs the full content row with the joined creator profile's display name,
 * handle, and status. Shared by the published feed, draft listing, and
 * single-item metadata routes so all three return the same {@link FeedRow}
 * shape from their JOIN against `creatorProfiles`.
 */
export const CONTENT_FEED_COLUMNS = {
  id: content.id,
  creatorId: content.creatorId,
  type: content.type,
  title: content.title,
  slug: content.slug,
  body: content.body,
  description: content.description,
  visibility: content.visibility,
  sourceType: content.sourceType,
  thumbnailKey: content.thumbnailKey,
  mediaKey: content.mediaKey,
  publishedAt: content.publishedAt,
  deletedAt: content.deletedAt,
  createdAt: content.createdAt,
  updatedAt: content.updatedAt,
  processingStatus: content.processingStatus,
  transcodedMediaKey: content.transcodedMediaKey,
  videoCodec: content.videoCodec,
  audioCodec: content.audioCodec,
  width: content.width,
  height: content.height,
  duration: content.duration,
  bitrate: content.bitrate,
  creatorName: creatorProfiles.displayName,
  creatorHandle: creatorProfiles.handle,
  creatorStatus: creatorProfiles.status,
} as const;

/** Map a joined {@link FeedRow} to the public {@link FeedItem} response shape. */
export const resolveFeedItem = (row: FeedRow): FeedItem => ({
  ...resolveContentUrls(row),
  creatorName: row.creatorName ?? "",
  creatorHandle: row.creatorHandle ?? null,
});
