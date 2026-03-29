import { eq, or } from "drizzle-orm";

import { db } from "../db/connection.js";
import { creatorProfiles } from "../db/schema/creator.schema.js";

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
