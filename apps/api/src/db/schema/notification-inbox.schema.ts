import { pgTable, text, timestamp, boolean, index } from "drizzle-orm/pg-core";

import type { InboxNotificationType } from "@snc/shared";

import { users } from "./user.schema.js";

// ── Inbox Notifications ──

/** In-app notifications displayed in the user's notification inbox. */
export const inboxNotifications = pgTable(
  "inbox_notifications",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").$type<InboxNotificationType>().notNull(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    actionUrl: text("action_url"),
    read: boolean("read").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("inbox_notifications_user_read_created_idx").on(
      table.userId,
      table.read,
      table.createdAt,
    ),
    index("inbox_notifications_user_created_idx").on(
      table.userId,
      table.createdAt,
    ),
  ],
);
