import { pgTable, text, timestamp, jsonb } from "drizzle-orm/pg-core";

import type { SocialLink } from "@snc/shared";

import { users } from "./user.schema.js";

// ── Creator Profiles ──

export const creatorProfiles = pgTable("creator_profiles", {
  userId: text("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
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
