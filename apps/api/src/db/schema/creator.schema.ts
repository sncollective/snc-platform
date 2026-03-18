import { pgTable, text, timestamp, jsonb, index, primaryKey } from "drizzle-orm/pg-core";

import type { SocialLink } from "@snc/shared";

import { users } from "./user.schema.js";

// ── Creator Profiles ──

export const creatorProfiles = pgTable("creator_profiles", {
  id: text("id").primaryKey(),
  displayName: text("display_name").notNull(),
  bio: text("bio"),
  avatarKey: text("avatar_key"),
  bannerKey: text("banner_key"),
  socialLinks: jsonb("social_links")
    .$type<SocialLink[]>()
    .notNull()
    .default([]),
  handle: text("handle").unique(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ── Creator Members ──

export const creatorMembers = pgTable(
  "creator_members",
  {
    creatorId: text("creator_id")
      .notNull()
      .references(() => creatorProfiles.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: text("role").notNull(), // "owner" | "editor" | "viewer"
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.creatorId, table.userId] }),
    index("creator_members_user_role_idx").on(table.userId, table.role),
    index("creator_members_creator_role_idx").on(table.creatorId, table.role),
  ],
);
