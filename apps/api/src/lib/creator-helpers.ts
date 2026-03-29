import { eq, or, and, isNull, isNotNull, count } from "drizzle-orm";

import { db } from "../db/connection.js";
import { creatorProfiles } from "../db/schema/creator.schema.js";
import { content } from "../db/schema/content.schema.js";
import { toISO } from "./response-helpers.js";
import { resolveCreatorUrls } from "./creator-url.js";
import type { CreatorProfileResponse } from "@snc/shared";

// ── Public Types ──

export type CreatorProfileRow = typeof creatorProfiles.$inferSelect;

// ── Public API ──

/** Find a creator profile by UUID or handle, returning undefined when not found. */
export const findCreatorProfile = async (
  identifier: string,
): Promise<CreatorProfileRow | undefined> => {
  const rows = await db
    .select()
    .from(creatorProfiles)
    .where(
      or(
        eq(creatorProfiles.id, identifier),
        eq(creatorProfiles.handle, identifier),
      ),
    );
  return rows[0];
};

/** Return the number of published, non-deleted content items for a creator. */
export const getContentCount = async (creatorId: string): Promise<number> => {
  const rows = await db
    .select({ count: count() })
    .from(content)
    .where(
      and(
        eq(content.creatorId, creatorId),
        isNull(content.deletedAt),
        isNotNull(content.publishedAt),
      ),
    );
  return rows[0]?.count ?? 0;
};

/** Map a creator profile DB row and content count to the API response shape. */
export const toProfileResponse = (
  profile: CreatorProfileRow,
  contentCount: number,
): CreatorProfileResponse => {
  const urls = resolveCreatorUrls(profile);
  return {
    id: profile.id,
    displayName: profile.displayName,
    bio: profile.bio ?? null,
    handle: profile.handle ?? null,
    avatarUrl: urls.avatarUrl,
    bannerUrl: urls.bannerUrl,
    socialLinks: profile.socialLinks ?? [],
    contentCount,
    createdAt: toISO(profile.createdAt),
    updatedAt: toISO(profile.updatedAt),
  };
};
