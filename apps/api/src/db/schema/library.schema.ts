import { index, integer, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

import { creatorProfiles } from "./creator.schema.js";

/** Content-addressable media asset registration. One row per (owner, sha256). */
export const contentAssets = pgTable(
  "content_assets",
  {
    id: text("id").primaryKey(),
    ownerCreatorId: text("owner_creator_id")
      .notNull()
      .references(() => creatorProfiles.id, { onDelete: "cascade" }),
    sha256: text("sha256").notNull(),
    storageKey: text("storage_key").notNull(),
    mimeType: text("mime_type").notNull(),
    size: integer("size").notNull(),
    width: integer("width"),
    height: integer("height"),
    originalFilename: text("original_filename"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("content_assets_owner_sha256_idx").on(table.ownerCreatorId, table.sha256),
    index("content_assets_owner_idx").on(table.ownerCreatorId),
  ],
);
