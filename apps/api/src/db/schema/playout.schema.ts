import {
  pgTable,
  text,
  timestamp,
  index,
  integer,
  boolean,
  real,
} from "drizzle-orm/pg-core";

export const playoutItems = pgTable(
  "playout_items",
  {
    id: text("id").primaryKey(),
    title: text("title").notNull(),
    year: integer("year"),
    director: text("director"),
    s3KeyPrefix: text("s3_key_prefix").notNull(),
    sourceKey: text("source_key"),
    sourceWidth: integer("source_width"),
    sourceHeight: integer("source_height"),
    duration: real("duration"),
    rendition1080pKey: text("rendition_1080p_key"),
    rendition720pKey: text("rendition_720p_key"),
    rendition480pKey: text("rendition_480p_key"),
    renditionAudioKey: text("rendition_audio_key"),
    subtitleKey: text("subtitle_key"),
    processingStatus: text("processing_status").notNull().default("pending"),
    position: integer("position").notNull(),
    enabled: boolean("enabled").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("playout_items_position_idx").on(table.position),
    index("playout_items_status_idx").on(table.processingStatus),
    index("playout_items_enabled_idx").on(table.enabled, table.position),
  ],
);
