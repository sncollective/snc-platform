import { eq, inArray } from "drizzle-orm";

import { db } from "../db/connection.js";
import { content } from "../db/schema/content.schema.js";
import { channelContent } from "../db/schema/playout-queue.schema.js";
import { rootLogger } from "../logging/logger.js";

/**
 * Remove a creator's content from all channel content pools.
 *
 * Deletes `channel_content` rows where `contentId` belongs to the given creator.
 * Content rows themselves are preserved — only pool associations are removed.
 * Playout items (which have no creator FK) are not affected.
 */
export async function archiveCreator(creatorId: string): Promise<void> {
  // Find all content IDs owned by this creator
  const contentRows = await db
    .select({ id: content.id })
    .from(content)
    .where(eq(content.creatorId, creatorId));

  const contentIds = contentRows.map((r) => r.id);

  if (contentIds.length === 0) return;

  // Remove from channel pools
  await db
    .delete(channelContent)
    .where(inArray(channelContent.contentId, contentIds));

  rootLogger.info(
    { event: "creator_archived_pool_cleanup", creatorId, contentCount: contentIds.length },
    "Removed creator content from channel pools",
  );
}
