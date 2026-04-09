import { pgTable, text, timestamp, primaryKey } from "drizzle-orm/pg-core";

import { users } from "./user.schema.js";
import { calendarEvents } from "./calendar.schema.js";

/** User opt-in reminders for calendar events. */
export const eventReminders = pgTable(
  "event_reminders",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    eventId: text("event_id")
      .notNull()
      .references(() => calendarEvents.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.eventId] })],
);
