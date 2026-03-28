import { pgTable, text, timestamp, index } from "drizzle-orm/pg-core";

import { channels } from "./streaming.schema.js";
import { users } from "./user.schema.js";

// ── Chat Rooms ──

export const chatRooms = pgTable(
  "chat_rooms",
  {
    id: text("id").primaryKey(),
    type: text("type").notNull(), // "channel" | "platform"
    channelId: text("channel_id").references(() => channels.id, {
      onDelete: "set null",
    }),
    name: text("name").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    closedAt: timestamp("closed_at", { withTimezone: true }),
  },
  (table) => [
    index("chat_rooms_type_idx").on(table.type),
    index("chat_rooms_channel_idx").on(table.channelId),
  ],
);

// ── Chat Messages ──

export const chatMessages = pgTable(
  "chat_messages",
  {
    id: text("id").primaryKey(),
    roomId: text("room_id")
      .notNull()
      .references(() => chatRooms.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    userName: text("user_name").notNull(),
    avatarUrl: text("avatar_url"),
    content: text("content").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("chat_messages_room_created_idx").on(table.roomId, table.createdAt),
  ],
);
