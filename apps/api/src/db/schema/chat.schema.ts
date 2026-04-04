import { pgTable, text, timestamp, integer, boolean, index, unique } from "drizzle-orm/pg-core";

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
    slowModeSeconds: integer("slow_mode_seconds").notNull().default(0),
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
    badges: text("badges").array().notNull().default([]),
    content: text("content").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("chat_messages_room_created_idx").on(table.roomId, table.createdAt),
  ],
);

// ── Moderation Actions ──

export const chatModerationActions = pgTable(
  "chat_moderation_actions",
  {
    id: text("id").primaryKey(),
    roomId: text("room_id")
      .notNull()
      .references(() => chatRooms.id, { onDelete: "cascade" }),
    targetUserId: text("target_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    targetUserName: text("target_user_name").notNull(),
    moderatorUserId: text("moderator_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    moderatorUserName: text("moderator_user_name").notNull(),
    action: text("action").notNull(), // "timeout" | "ban" | "unban"
    durationSeconds: integer("duration_seconds"),
    reason: text("reason"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
  },
  (table) => [
    index("chat_mod_actions_room_created_idx").on(table.roomId, table.createdAt),
    index("chat_mod_actions_target_idx").on(table.targetUserId, table.roomId),
  ],
);

// ── Word Filters ──

export const chatWordFilters = pgTable(
  "chat_word_filters",
  {
    id: text("id").primaryKey(),
    roomId: text("room_id")
      .notNull()
      .references(() => chatRooms.id, { onDelete: "cascade" }),
    pattern: text("pattern").notNull(),
    isRegex: boolean("is_regex").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("chat_word_filters_room_idx").on(table.roomId),
  ],
);

// ── Chat Message Reactions ──

export const chatMessageReactions = pgTable(
  "chat_message_reactions",
  {
    id: text("id").primaryKey(),
    messageId: text("message_id")
      .notNull()
      .references(() => chatMessages.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    roomId: text("room_id")
      .notNull()
      .references(() => chatRooms.id, { onDelete: "cascade" }),
    emoji: text("emoji").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique("chat_reactions_message_user_emoji_uniq").on(
      table.messageId,
      table.userId,
      table.emoji,
    ),
    index("chat_reactions_message_idx").on(table.messageId),
    index("chat_reactions_room_idx").on(table.roomId),
  ],
);
