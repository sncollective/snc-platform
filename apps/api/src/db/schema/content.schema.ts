import { pgTable, text, timestamp, index, uniqueIndex } from "drizzle-orm/pg-core";

import type { ContentType, Visibility, SourceType } from "@snc/shared";

import { creatorProfiles } from "./creator.schema.js";

// ── Content ──

export const content = pgTable(
  "content",
  {
    id: text("id").primaryKey(),
    creatorId: text("creator_id")
      .notNull()
      .references(() => creatorProfiles.id, { onDelete: "cascade" }),
    type: text("type").$type<ContentType>().notNull(),
    title: text("title").notNull(),
    slug: text("slug"),
    body: text("body"),
    description: text("description"),
    visibility: text("visibility").$type<Visibility>().notNull().default("public"),
    sourceType: text("source_type").$type<SourceType>().notNull().default("upload"),
    thumbnailKey: text("thumbnail_key"),
    mediaKey: text("media_key"),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("content_creator_active_idx").on(table.creatorId, table.deletedAt),
    index("content_type_active_idx").on(table.type, table.deletedAt),
    index("content_feed_idx").on(
      table.visibility,
      table.deletedAt,
      table.publishedAt,
    ),
    uniqueIndex("content_creator_slug_idx").on(table.creatorId, table.slug),
  ],
);
