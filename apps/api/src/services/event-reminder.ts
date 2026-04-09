import { and, eq, inArray } from "drizzle-orm";

import type { Result, AppError } from "@snc/shared";
import { ok, err, NotFoundError } from "@snc/shared";

import { db } from "../db/connection.js";
import { eventReminders } from "../db/schema/event-reminder.schema.js";
import { calendarEvents } from "../db/schema/calendar.schema.js";

// ── Public API ──

/**
 * Toggle a reminder for a calendar event. Inserts if absent, deletes if present.
 *
 * @returns The new reminder state — `reminded: true` after insert, `false` after delete.
 */
export const toggleReminder = async (
  userId: string,
  eventId: string,
): Promise<Result<{ reminded: boolean }, AppError>> => {
  // Check if the reminder already exists
  const [existing] = await db
    .select()
    .from(eventReminders)
    .where(
      and(
        eq(eventReminders.userId, userId),
        eq(eventReminders.eventId, eventId),
      ),
    );

  if (existing) {
    await db
      .delete(eventReminders)
      .where(
        and(
          eq(eventReminders.userId, userId),
          eq(eventReminders.eventId, eventId),
        ),
      );
    return ok({ reminded: false });
  }

  // Verify the event exists before inserting
  const [event] = await db
    .select({ id: calendarEvents.id })
    .from(calendarEvents)
    .where(eq(calendarEvents.id, eventId));

  if (!event) {
    return err(new NotFoundError("Calendar event not found"));
  }

  await db.insert(eventReminders).values({ userId, eventId });
  return ok({ reminded: true });
};

/**
 * Get the set of event IDs that the user has reminders for,
 * filtered to a given list of event IDs.
 */
export const getUserReminders = async (
  userId: string,
  eventIds: string[],
): Promise<Set<string>> => {
  if (eventIds.length === 0) return new Set();

  const rows = await db
    .select({ eventId: eventReminders.eventId })
    .from(eventReminders)
    .where(
      and(
        eq(eventReminders.userId, userId),
        inArray(eventReminders.eventId, eventIds),
      ),
    );

  return new Set(rows.map((r) => r.eventId));
};
