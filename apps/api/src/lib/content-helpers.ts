import { and, eq, isNull } from "drizzle-orm";

import type { ContentResponse } from "@snc/shared";
import { NotFoundError } from "@snc/shared";

import { db } from "../db/connection.js";
import { content } from "../db/schema/content.schema.js";
import { requireCreatorPermission } from "../services/creator-team.js";
import { toISO, toISOOrNull } from "./response-helpers.js";

type ContentRow = typeof content.$inferSelect;

export type { ContentRow };

/** Map a content DB row to an API response, converting storage keys to serving URLs. */
export const resolveContentUrls = (row: ContentRow): ContentResponse => ({
  id: row.id,
  creatorId: row.creatorId,
  slug: row.slug ?? null,
  type: row.type,
  title: row.title,
  body: row.body ?? null,
  description: row.description ?? null,
  visibility: row.visibility,
  sourceType: row.sourceType,
  thumbnailUrl: row.thumbnailKey
    ? `/api/content/${row.id}/thumbnail`
    : null,
  mediaUrl: row.mediaKey
    ? `/api/content/${row.id}/media`
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
});

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
