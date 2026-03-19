import {
  pgTable,
  text,
  boolean,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import { users } from "./user.schema.js";
import { creatorProfiles } from "./creator.schema.js";
import { projects } from "./project.schema.js";

// ── Calendar Events ──

export const calendarEvents = pgTable(
  "calendar_events",
  {
    id: text("id").primaryKey(),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    startAt: timestamp("start_at", { withTimezone: true }).notNull(),
    endAt: timestamp("end_at", { withTimezone: true }),
    allDay: boolean("all_day").notNull().default(false),
    eventType: text("event_type").notNull(),
    location: text("location").notNull().default(""),
    createdBy: text("created_by")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    creatorId: text("creator_id").references(() => creatorProfiles.id, {
      onDelete: "cascade",
    }),
    projectId: text("project_id").references(() => projects.id, {
      onDelete: "set null",
    }),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("calendar_events_start_deleted_idx").on(
      table.startAt,
      table.deletedAt,
    ),
    index("calendar_events_event_type_deleted_idx").on(
      table.eventType,
      table.deletedAt,
    ),
    index("calendar_events_created_by_idx").on(table.createdBy),
    index("calendar_events_creator_deleted_idx").on(
      table.creatorId,
      table.deletedAt,
    ),
    index("calendar_events_project_deleted_idx").on(
      table.projectId,
      table.deletedAt,
    ),
  ],
);

// ── Calendar Feed Tokens ──

export const calendarFeedTokens = pgTable(
  "calendar_feed_tokens",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    token: text("token").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("calendar_feed_tokens_token_idx").on(table.token),
    index("calendar_feed_tokens_user_idx").on(table.userId),
  ],
);

// ── Custom Event Types ──

export const customEventTypes = pgTable(
  "custom_event_types",
  {
    id: text("id").primaryKey(),
    label: text("label").notNull(),
    slug: text("slug").notNull(),
    createdBy: text("created_by")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("custom_event_types_slug_idx").on(table.slug),
  ],
);
