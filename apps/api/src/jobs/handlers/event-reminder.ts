import { and, eq, gt, lte, isNull } from "drizzle-orm";

import { db } from "../../db/connection.js";
import { eventReminders } from "../../db/schema/event-reminder.schema.js";
import { calendarEvents } from "../../db/schema/calendar.schema.js";
import { inboxNotifications } from "../../db/schema/notification-inbox.schema.js";
import { createNotification } from "../../services/notification-inbox.js";
import { rootLogger } from "../../logging/logger.js";

// ── Public API ──

/**
 * Dispatch inbox notifications for event reminders due within the next 15 minutes.
 * Skips users who already received an event_reminder notification for the same event.
 * Intended to run as a periodic job (every 5 minutes).
 */
export const handleEventReminderDispatch = async (): Promise<void> => {
  const now = new Date();
  const fifteenMinutesFromNow = new Date(now.getTime() + 15 * 60 * 1000);

  // Find reminders for events starting in the next 15 minutes,
  // excluding those that already have an inbox notification of type event_reminder.
  const dueReminders = await db
    .select({
      userId: eventReminders.userId,
      eventId: eventReminders.eventId,
      eventTitle: calendarEvents.title,
    })
    .from(eventReminders)
    .innerJoin(calendarEvents, eq(eventReminders.eventId, calendarEvents.id))
    .where(
      and(
        gt(calendarEvents.startAt, now),
        lte(calendarEvents.startAt, fifteenMinutesFromNow),
        isNull(calendarEvents.deletedAt),
      ),
    );

  if (dueReminders.length === 0) return;

  // Filter out users who already received an event_reminder notification for this event.
  // We check inbox_notifications for matching (userId, type, actionUrl) since
  // actionUrl contains the eventId.
  const pending: typeof dueReminders = [];

  for (const reminder of dueReminders) {
    const [existing] = await db
      .select({ id: inboxNotifications.id })
      .from(inboxNotifications)
      .where(
        and(
          eq(inboxNotifications.userId, reminder.userId),
          eq(inboxNotifications.type, "event_reminder"),
          eq(
            inboxNotifications.actionUrl,
            `/calendar?event=${reminder.eventId}`,
          ),
        ),
      )
      .limit(1);

    if (!existing) {
      pending.push(reminder);
    }
  }

  if (pending.length === 0) return;

  let sent = 0;
  for (const reminder of pending) {
    try {
      await createNotification({
        userId: reminder.userId,
        type: "event_reminder",
        title: `Reminder: ${reminder.eventTitle}`,
        body: "Starting in 15 minutes",
        actionUrl: `/calendar?event=${reminder.eventId}`,
      });
      sent++;
    } catch (err) {
      rootLogger.error(
        {
          userId: reminder.userId,
          eventId: reminder.eventId,
          error: err instanceof Error ? err.message : String(err),
        },
        "Failed to create event reminder notification",
      );
    }
  }

  if (sent > 0) {
    rootLogger.info({ sent, total: pending.length }, "Event reminder notifications dispatched");
  }
};
