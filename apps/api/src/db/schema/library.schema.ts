import { sql } from "drizzle-orm";
import {
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import { creatorProfiles } from "./creator.schema.js";
import { users } from "./user.schema.js";

export const contentAssetSharingEnum = pgEnum("content_asset_sharing", [
  "private",
  "requestable",
  "open",
]);

/** Global, creator-independent inventory of content-addressed image bytes. */
export const contentBlobs = pgTable(
  "content_blobs",
  {
    sha256: text("sha256").primaryKey(),
    storageKey: text("storage_key").notNull().unique(),
    mimeType: text("mime_type").notNull(),
    size: integer("size").notNull(),
    width: integer("width"),
    height: integer("height"),
    createdAt: timestamp("created_at", { withTimezone: true, precision: 3 })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("content_blobs_created_at_idx").on(table.createdAt)],
);

/** A creator or platform-admin registration of one immutable blob. */
export const contentAssets = pgTable(
  "content_assets",
  {
    id: text("id").primaryKey(),
    blobSha256: text("blob_sha256")
      .notNull()
      .references(() => contentBlobs.sha256, { onDelete: "cascade" }),
    creatorId: text("creator_id").references(() => creatorProfiles.id, {
      onDelete: "cascade",
    }),
    sharing: contentAssetSharingEnum("sharing").notNull().default("private"),
    originalFilename: text("original_filename"),
    createdAt: timestamp("created_at", { withTimezone: true, precision: 3 })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true, precision: 3 }),
  },
  (table) => [
    uniqueIndex("content_assets_creator_blob_idx")
      .on(table.creatorId, table.blobSha256)
      .where(sql`${table.creatorId} is not null`),
    uniqueIndex("content_assets_admin_blob_idx")
      .on(table.blobSha256)
      .where(sql`${table.creatorId} is null`),
    index("content_assets_creator_idx").on(table.creatorId),
    index("content_assets_blob_idx").on(table.blobSha256),
    index("content_assets_browse_idx").on(table.deletedAt, table.sharing, table.createdAt),
  ],
);

/** Per-creator permission to use one requestable asset registration. */
export const contentAssetGrants = pgTable(
  "content_asset_grants",
  {
    assetId: text("asset_id")
      .notNull()
      .references(() => contentAssets.id, { onDelete: "cascade" }),
    granteeCreatorId: text("grantee_creator_id")
      .notNull()
      .references(() => creatorProfiles.id, { onDelete: "cascade" }),
    grantedByUserId: text("granted_by_user_id")
      .notNull()
      .references(() => users.id),
    grantedAt: timestamp("granted_at", { withTimezone: true, precision: 3 })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("content_asset_grants_asset_grantee_idx").on(
      table.assetId,
      table.granteeCreatorId,
    ),
    index("content_asset_grants_grantee_idx").on(table.granteeCreatorId),
  ],
);
