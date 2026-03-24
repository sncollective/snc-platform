import {
  pgTable,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
  index,
} from "drizzle-orm/pg-core";

import type { BookingStatus } from "@snc/shared";

import { users } from "./user.schema.js";

// ── Services ──

export const services = pgTable(
  "services",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    description: text("description").notNull(),
    pricingInfo: text("pricing_info").notNull(),
    active: boolean("active").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("services_active_sort_idx").on(table.active, table.sortOrder),
  ],
);

// ── Booking Requests ──

export const bookingRequests = pgTable(
  "booking_requests",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    serviceId: text("service_id")
      .notNull()
      .references(() => services.id, { onDelete: "restrict" }),
    preferredDates: jsonb("preferred_dates").$type<string[]>().notNull(),
    notes: text("notes").notNull().default(""),
    status: text("status").$type<BookingStatus>().notNull().default("pending"),
    reviewedBy: text("reviewed_by").references(() => users.id, {
      onDelete: "set null",
    }),
    reviewNote: text("review_note"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("booking_requests_user_status_idx").on(table.userId, table.status),
    index("booking_requests_status_created_idx").on(
      table.status,
      table.createdAt,
    ),
  ],
);
