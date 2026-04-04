import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const mastodonApps = pgTable("mastodon_apps", {
  instanceDomain: text("instance_domain").primaryKey(),
  clientId: text("client_id").notNull(),
  clientSecret: text("client_secret").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
