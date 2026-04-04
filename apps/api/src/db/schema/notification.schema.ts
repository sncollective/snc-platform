import {
  pgTable,
  text,
  timestamp,
  boolean,
  integer,
  index,
  primaryKey,
  jsonb,
} from "drizzle-orm/pg-core";

import type {
  NotificationEventType,
  NotificationChannel,
  NotificationJobStatus,
} from "@snc/shared";

import { users } from "./user.schema.js";
import { creatorProfiles } from "./creator.schema.js";

// ── Creator Follows ──

/** Users following creators for notifications. Deduplicated with subscribers for audience resolution. */
export const creatorFollows = pgTable(
  "creator_follows",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    creatorId: text("creator_id")
      .notNull()
      .references(() => creatorProfiles.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.creatorId] }),
    index("creator_follows_creator_idx").on(table.creatorId),
  ],
);

// ── Notification Preferences ──

/** Per-user, per-event-type, per-channel notification preferences. Defaults: all enabled. */
export const notificationPreferences = pgTable(
  "notification_preferences",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    eventType: text("event_type").$type<NotificationEventType>().notNull(),
    channel: text("channel").$type<NotificationChannel>().notNull(),
    enabled: boolean("enabled").notNull().default(true),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.eventType, table.channel] }),
  ],
);

// ── Notification Jobs ──

/** Individual notification delivery jobs. Processed by pg-boss worker. */
export const notificationJobs = pgTable(
  "notification_jobs",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    eventType: text("event_type").$type<NotificationEventType>().notNull(),
    channel: text("channel").$type<NotificationChannel>().notNull(),
    payload: jsonb("payload").notNull(),
    status: text("status").$type<NotificationJobStatus>().notNull().default("pending"),
    attempts: integer("attempts").notNull().default(0),
    lastError: text("last_error"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    sentAt: timestamp("sent_at", { withTimezone: true }),
  },
  (table) => [
    index("notification_jobs_status_idx").on(table.status),
    index("notification_jobs_user_idx").on(table.userId),
  ],
);
