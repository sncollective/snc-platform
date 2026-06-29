import { randomUUID } from "node:crypto";

import { and, eq, inArray, sql } from "drizzle-orm";
import { ForbiddenError, err, ok } from "@snc/shared";
import type {
  AppError,
  ChannelContent,
  PlayoutProcessingStatus,
  PoolCandidate,
  Result,
} from "@snc/shared";

import { db } from "../../db/connection.js";
import { content } from "../../db/schema/content.schema.js";
import { channelContent } from "../../db/schema/playout-queue.schema.js";
import { resolvePoolScope } from "./pool-scope.js";

export type ContentPoolLogger = {
  warn: (bindings: Record<string, unknown>, message: string) => void;
};

/** Assign items to a channel's content pool. */
export const assignContent = async (
  channelId: string,
  playoutItemIds: string[],
  contentIds: string[] | undefined,
  logger: ContentPoolLogger,
): Promise<Result<void, AppError>> => {
  const requestedContentIds = contentIds ?? [];
  const scopeResult = await resolvePoolScope(channelId);
  if (!scopeResult.ok) return scopeResult;
  const scope = scopeResult.value;

  if ("creatorId" in scope) {
    if (playoutItemIds.length > 0) {
      return err(
        new ForbiddenError(
          "Creator channels may not assign platform playout items to their content pool",
        ),
      );
    }

    if (requestedContentIds.length > 0) {
      const ownedRows = await db
        .select({ id: content.id })
        .from(content)
        .where(
          and(
            inArray(content.id, requestedContentIds),
            eq(content.creatorId, scope.creatorId),
            sql`${content.deletedAt} IS NULL`,
          ),
        );

      const ownedIds = new Set(ownedRows.map((r) => r.id));
      const disallowed = requestedContentIds.filter((id) => !ownedIds.has(id));
      if (disallowed.length > 0) {
        logger.warn(
          { channelId, creatorId: scope.creatorId, disallowed },
          "Rejected creator content assignment — ids not owned by channel creator",
        );
        return err(
          new ForbiddenError(
            "One or more content items do not belong to this creator",
          ),
        );
      }
    }
  }

  const playoutValues = playoutItemIds.map((playoutItemId) => ({
    id: randomUUID(),
    channelId,
    playoutItemId,
    contentId: null,
  }));

  const contentValues = requestedContentIds.map((contentId) => ({
    id: randomUUID(),
    channelId,
    playoutItemId: null,
    contentId,
  }));

  const values = [...playoutValues, ...contentValues];
  if (values.length === 0) return ok(undefined);

  await db
    .insert(channelContent)
    .values(values)
    .onConflictDoNothing();

  return ok(undefined);
};

/** Remove items from a channel's content pool without touching queued items. */
export const removeContent = async (
  channelId: string,
  playoutItemIds: string[],
  contentIds?: string[],
): Promise<Result<void, AppError>> => {
  if (playoutItemIds.length > 0) {
    await db
      .delete(channelContent)
      .where(
        and(
          eq(channelContent.channelId, channelId),
          inArray(channelContent.playoutItemId, playoutItemIds),
        ),
      );
  }

  if ((contentIds ?? []).length > 0) {
    await db
      .delete(channelContent)
      .where(
        and(
          eq(channelContent.channelId, channelId),
          inArray(channelContent.contentId, contentIds!),
        ),
      );
  }

  return ok(undefined);
};

/** List content pool items for a channel, enriched with title, duration, and source type. */
export const listContent = async (
  channelId: string,
): Promise<Result<ChannelContent[], AppError>> => {
  const scopeResult = await resolvePoolScope(channelId);
  if (!scopeResult.ok) return scopeResult;
  const scope = scopeResult.value;
  const creatorScoped = "creatorId" in scope;

  const playoutBranch = creatorScoped
    ? sql``
    : sql`
    SELECT
      cc.id,
      cc.channel_id AS "channelId",
      cc.playout_item_id AS "playoutItemId",
      cc.content_id AS "contentId",
      'playout' AS "sourceType",
      pi.processing_status AS "processingStatus",
      pi.title,
      pi.duration,
      cc.last_played_at AS "lastPlayedAt",
      cc.play_count AS "playCount",
      cc.created_at AS "createdAt"
    FROM channel_content cc
    JOIN playout_items pi ON pi.id = cc.playout_item_id
    WHERE cc.channel_id = ${channelId}
      AND cc.playout_item_id IS NOT NULL

    UNION ALL
`;

  const contentOwnershipFilter = creatorScoped
    ? sql`AND c.creator_id = ${scope.creatorId}
      AND c.deleted_at IS NULL`
    : sql``;

  const rows = (await db.execute(sql`${playoutBranch}
    SELECT
      cc.id,
      cc.channel_id AS "channelId",
      cc.playout_item_id AS "playoutItemId",
      cc.content_id AS "contentId",
      'content' AS "sourceType",
      NULL AS "processingStatus",
      c.title,
      c.duration,
      cc.last_played_at AS "lastPlayedAt",
      cc.play_count AS "playCount",
      cc.created_at AS "createdAt"
    FROM channel_content cc
    JOIN content c ON c.id = cc.content_id
    WHERE cc.channel_id = ${channelId}
      AND cc.content_id IS NOT NULL
      ${contentOwnershipFilter}

    ORDER BY "createdAt" ASC
  `)) as Array<{
    id: string;
    channelId: string;
    playoutItemId: string | null;
    contentId: string | null;
    sourceType: "playout" | "content";
    processingStatus: string | null;
    title: string | null;
    duration: number | null;
    lastPlayedAt: Date | null;
    playCount: number;
    createdAt: Date;
  }>;

  return ok(
    rows.map((row) => ({
      id: row.id,
      channelId: row.channelId,
      playoutItemId: row.playoutItemId ?? null,
      contentId: row.contentId ?? null,
      sourceType: row.sourceType,
      processingStatus: (row.processingStatus as PlayoutProcessingStatus | null) ?? null,
      title: row.title,
      duration: row.duration ?? null,
      lastPlayedAt: row.lastPlayedAt?.toISOString() ?? null,
      playCount: row.playCount,
      createdAt: row.createdAt instanceof Date
        ? row.createdAt.toISOString()
        : String(row.createdAt),
    })),
  );
};

/** Search for items available to add to a channel's content pool. */
export const searchAvailableContent = async (
  channelId: string,
  query: string,
): Promise<Result<PoolCandidate[], AppError>> => {
  const searchPattern = `%${query}%`;
  const scopeResult = await resolvePoolScope(channelId);
  if (!scopeResult.ok) return scopeResult;
  const scope = scopeResult.value;
  const creatorScoped = "creatorId" in scope;

  const playoutBranch = creatorScoped
    ? sql``
    : sql`
    SELECT
      pi.id,
      'playout' AS "sourceType",
      pi.title,
      pi.duration,
      NULL AS creator
    FROM playout_items pi
    WHERE pi.title ILIKE ${searchPattern}
      AND pi.processing_status = 'ready'
      AND pi.id NOT IN (
        SELECT playout_item_id FROM channel_content
        WHERE channel_id = ${channelId}
          AND playout_item_id IS NOT NULL
      )

    UNION ALL
`;

  const contentOwnershipFilter = creatorScoped
    ? sql`AND c.creator_id = ${scope.creatorId}
      AND c.deleted_at IS NULL`
    : sql``;

  const rows = (await db.execute(sql`${playoutBranch}
    SELECT
      c.id,
      'content' AS "sourceType",
      c.title,
      c.duration,
      cp.display_name AS creator
    FROM content c
    LEFT JOIN creator_profiles cp ON cp.id = c.creator_id
    WHERE c.title ILIKE ${searchPattern}
      AND c.type = 'video'
      AND (c.processing_status = 'ready' OR c.processing_status IS NULL)
      ${contentOwnershipFilter}
      AND c.id NOT IN (
        SELECT content_id FROM channel_content
        WHERE channel_id = ${channelId}
          AND content_id IS NOT NULL
      )

    ORDER BY title ASC
    LIMIT 20
  `)) as Array<{
    id: string;
    sourceType: "playout" | "content";
    title: string;
    duration: number | null;
    creator: string | null;
  }>;

  return ok(
    rows.map((row) => ({
      id: row.id,
      sourceType: row.sourceType,
      title: row.title,
      duration: row.duration ?? null,
      creator: row.creator ?? null,
    })),
  );
};
