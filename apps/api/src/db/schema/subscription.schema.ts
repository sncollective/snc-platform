import {
  pgTable,
  text,
  integer,
  boolean,
  timestamp,
  index,
} from "drizzle-orm/pg-core";

import { creatorProfiles } from "./creator.schema.js";
import { users } from "./user.schema.js";

// ── Subscription Plans ──

export const subscriptionPlans = pgTable(
  "subscription_plans",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    type: text("type").notNull(), // "platform" | "creator"
    creatorId: text("creator_id").references(() => creatorProfiles.id, {
      onDelete: "set null",
    }),
    stripePriceId: text("stripe_price_id").notNull().unique(),
    price: integer("price").notNull(), // cents
    interval: text("interval").notNull(), // "month" | "year"
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("subscription_plans_type_active_idx").on(table.type, table.active),
    index("subscription_plans_creator_active_idx").on(
      table.creatorId,
      table.active,
    ),
  ],
);

// ── User Subscriptions ──

export const userSubscriptions = pgTable(
  "user_subscriptions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    planId: text("plan_id")
      .notNull()
      .references(() => subscriptionPlans.id, { onDelete: "restrict" }),
    stripeSubscriptionId: text("stripe_subscription_id").notNull().unique(),
    stripeCustomerId: text("stripe_customer_id").notNull(),
    status: text("status").notNull(), // "active" | "canceled" | "past_due" | "incomplete"
    currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
    cancelAtPeriodEnd: boolean("cancel_at_period_end").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("user_subscriptions_user_status_idx").on(table.userId, table.status),
  ],
);

// ── Payment Events (Stripe webhook dedup) ──

export const paymentEvents = pgTable("payment_events", {
  id: text("id").primaryKey(), // Stripe event ID for idempotency
  type: text("type").notNull(), // Stripe event type string
  processedAt: timestamp("processed_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
