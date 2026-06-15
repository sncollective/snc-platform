import { pgTable, text, timestamp, index } from "drizzle-orm/pg-core";

import { users } from "./user.schema.js";

// ── Consent Log ──

/**
 * Append-only consent records (GDPR). One row per consent capture — never updated,
 * never deleted except by user-erasure cascade. `source` records where consent was
 * captured (e.g. `join:<creatorId>`, `notify:<channelId>`).
 */
export const consentLog = pgTable(
  "consent_log",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    consentType: text("consent_type").notNull(),
    policyVersion: text("policy_version").notNull(),
    source: text("source").notNull(),
    capturedAt: timestamp("captured_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("consent_log_user_idx").on(t.userId)],
);
