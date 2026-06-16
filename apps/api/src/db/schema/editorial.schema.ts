import {
  pgTable,
  text,
  timestamp,
  integer,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import type { EditorialMode, EditorialTierType } from "@snc/shared";

import { channels } from "./streaming.schema.js";

// ── Channel Editorial Config ──
//
// 1:1 with channel — channelId is both PK and FK. Stores the editorial control
// mode ("manual" | "auto") and the manually-pinned tier when mode = "manual".
// manualTierId FK uses onDelete: "set null" so deleting a tier drops the pin
// without deleting the config row (the channel's config stays valid, falling
// back to "auto" behaviour until a new pin is chosen).

export const channelEditorialConfig = pgTable("channel_editorial_config", {
  channelId: text("channel_id")
    .primaryKey()
    .references(() => channels.id, { onDelete: "cascade" }),
  mode: text("mode")
    .$type<EditorialMode>()
    .notNull()
    .default("auto"),
  // onDelete: "set null" — removing a tier un-pins the manual selection
  // rather than deleting the config row. Uses the () => lazy-ref idiom to
  // resolve the forward reference to channelEditorialTiers (defined below).
  manualTierId: text("manual_tier_id").references(
    () => channelEditorialTiers.id,
    { onDelete: "set null" },
  ),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ── Channel Editorial Tiers ──
//
// Priority-ordered source tiers per channel that drive the ref-backed switch()
// in the Liquidsoap render. The switch evaluates tiers lowest-priority-number
// first (0 = highest priority).
//
// sourceChannelId: non-null IFF tierType = "channel-as-source" (app-enforced on
// write; a DB CHECK is a follow-up if drift appears). onDelete: "cascade" is
// deliberate — deleting a carried channel removes the carry tier from carriers
// (the carry is meaningless without its source; carriers keep their remaining
// tiers + mksafe tail and are still valid, but must regenerate-and-restart).
// Rejected: "restrict" (blocks carried-channel deletion on an unrelated config),
// "set null" (orphans the tier into an invalid no-source channel-as-source).
//
// Index on sourceChannelId enables the reverse-lookup query: "who carries X?"
// needed when a deletion triggers cascade-restart on all carriers.

export const channelEditorialTiers = pgTable(
  "channel_editorial_tiers",
  {
    id: text("id").primaryKey(),
    channelId: text("channel_id")
      .notNull()
      .references(() => channels.id, { onDelete: "cascade" }),
    tierType: text("tier_type").$type<EditorialTierType>().notNull(),
    priority: integer("priority").notNull(), // 0 = highest
    sourceChannelId: text("source_channel_id").references(() => channels.id, {
      onDelete: "cascade",
    }),
  },
  (t) => [
    uniqueIndex("channel_editorial_tiers_channel_priority_idx").on(
      t.channelId,
      t.priority,
    ),
    index("channel_editorial_tiers_source_idx").on(t.sourceChannelId),
  ],
);
