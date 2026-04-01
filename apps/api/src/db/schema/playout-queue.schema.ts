import {
  pgTable,
  text,
  timestamp,
  integer,
  boolean,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import { channels } from "./streaming.schema.js";
import { playoutItems } from "./playout.schema.js";
import { content } from "./content.schema.js";

// ── Channel Content (pool) ──

export const channelContent = pgTable(
  "channel_content",
  {
    id: text("id").primaryKey(),
    channelId: text("channel_id")
      .notNull()
      .references(() => channels.id, { onDelete: "cascade" }),
    playoutItemId: text("playout_item_id")
      .references(() => playoutItems.id, { onDelete: "cascade" }),
    contentId: text("content_id")
      .references(() => content.id, { onDelete: "cascade" }),
    lastPlayedAt: timestamp("last_played_at", { withTimezone: true }),
    playCount: integer("play_count").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("channel_content_channel_item_idx").on(
      table.channelId,
      table.playoutItemId,
    ),
    uniqueIndex("channel_content_channel_content_idx").on(
      table.channelId,
      table.contentId,
    ),
    index("channel_content_channel_idx").on(table.channelId),
    index("channel_content_last_played_idx").on(
      table.channelId,
      table.lastPlayedAt,
    ),
  ],
);

// ── Playout Queue ──

export const playoutQueue = pgTable(
  "playout_queue",
  {
    id: text("id").primaryKey(),
    channelId: text("channel_id")
      .notNull()
      .references(() => channels.id, { onDelete: "cascade" }),
    playoutItemId: text("playout_item_id")
      .notNull()
      .references(() => playoutItems.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    status: text("status").notNull().default("queued"),
    pushedToLiquidsoap: boolean("pushed_to_liquidsoap")
      .notNull()
      .default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("playout_queue_channel_position_idx").on(
      table.channelId,
      table.position,
    ),
    index("playout_queue_channel_status_idx").on(
      table.channelId,
      table.status,
    ),
  ],
);
