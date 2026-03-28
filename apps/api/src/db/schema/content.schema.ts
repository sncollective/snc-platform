import { pgTable, text, timestamp, index, uniqueIndex, integer, real } from "drizzle-orm/pg-core";

import type { ContentType, Visibility, SourceType, ProcessingStatus } from "@snc/shared";

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
    videoCodec: text("video_codec"),
    audioCodec: text("audio_codec"),
    width: integer("width"),
    height: integer("height"),
    duration: real("duration"),
    bitrate: integer("bitrate"),
    processingStatus: text("processing_status").$type<ProcessingStatus>(),
    transcodedMediaKey: text("transcoded_media_key"),
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
    index("content_processing_status_idx").on(table.processingStatus),
  ],
);
