import { pgTable, text, timestamp, jsonb, index } from "drizzle-orm/pg-core";

import type { InviteType } from "@snc/shared";

import { users } from "./user.schema.js";

/**
 * Invite tokens for creator onboarding and team member additions.
 * Tokens are hashed (SHA-256) before storage. Raw token sent via email only.
 */
export const inviteTokens = pgTable(
  "invite_tokens",
  {
    id: text("id").primaryKey(),
    type: text("type").$type<InviteType>().notNull(),
    email: text("email").notNull(),
    payload: jsonb("payload").notNull(),
    tokenHash: text("token_hash").notNull().unique(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    createdBy: text("created_by")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("invite_tokens_email_idx").on(table.email),
    index("invite_tokens_hash_idx").on(table.tokenHash),
  ],
);
