import { randomUUID } from "node:crypto";

import { eq, and } from "drizzle-orm";
import type { NotificationEventType, InboxNotificationType } from "@snc/shared";

import { db } from "../db/connection.js";
import { notificationPreferences, notificationJobs } from "../db/schema/notification.schema.js";
import { getBoss } from "../jobs/boss.js";
import { JOB_QUEUES } from "../jobs/queue-names.js";
import { resolveAudience } from "./follows.js";
import { rootLogger } from "../logging/logger.js";
import { createNotification } from "./notification-inbox.js";

// ── Public Types ──

export interface NotificationEvent {
  eventType: NotificationEventType;
  creatorId: string;
  payload: Record<string, unknown>;
}

// ── Private Helpers ──

/** Derive inbox notification title from event type and payload. */
const deriveNotificationTitle = (
  eventType: NotificationEventType,
  _payload: Record<string, unknown>,
): string => {
  if (eventType === "go_live") return "Stream is live!";
  return eventType
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
};

/** Derive inbox notification body from event type and payload. */
const deriveNotificationBody = (
  eventType: NotificationEventType,
  payload: Record<string, unknown>,
): string => {
  if (eventType === "go_live") {
    const creatorName = typeof payload.creatorName === "string" ? payload.creatorName : "";
    const streamTitle = typeof payload.streamTitle === "string" ? payload.streamTitle : "";
    if (creatorName && streamTitle) return `${creatorName} is streaming: ${streamTitle}`;
    if (creatorName) return `${creatorName} is streaming`;
    if (streamTitle) return streamTitle;
  }
  const body = JSON.stringify(payload);
  return body.length > 200 ? body.slice(0, 197) + "..." : body;
};

/** Derive action URL from payload if present. */
const deriveNotificationActionUrl = (
  payload: Record<string, unknown>,
): string | undefined => {
  if (typeof payload.actionUrl === "string") return payload.actionUrl;
  if (typeof payload.channelSlug === "string") return `/creators/${payload.channelSlug}`;
  return undefined;
};

/** Check if a user has opted out of a specific notification. Default is opted-in. */
const isPreferenceEnabled = async (
  userId: string,
  eventType: NotificationEventType,
  channel: "email",
): Promise<boolean> => {
  const [pref] = await db
    .select()
    .from(notificationPreferences)
    .where(
      and(
        eq(notificationPreferences.userId, userId),
        eq(notificationPreferences.eventType, eventType),
        eq(notificationPreferences.channel, channel),
      ),
    );

  // No row = default enabled
  return pref?.enabled ?? true;
};

// ── Public API ──

/**
 * Dispatch a notification event. Resolves audience, checks preferences,
 * enqueues pg-boss jobs for each recipient.
 */
export const dispatchNotification = async (
  event: NotificationEvent,
): Promise<void> => {
  const boss = getBoss();
  if (!boss) {
    rootLogger.warn("pg-boss not started, skipping notification dispatch");
    return;
  }

  const audience = await resolveAudience(event.creatorId);

  rootLogger.info(
    { eventType: event.eventType, creatorId: event.creatorId, audienceSize: audience.length },
    "Dispatching notifications",
  );

  let enqueued = 0;

  for (const member of audience) {
    const enabled = await isPreferenceEnabled(member.userId, event.eventType, "email");
    if (!enabled) continue;

    const jobId = randomUUID();

    // Record in notification_jobs for audit
    await db.insert(notificationJobs).values({
      id: jobId,
      userId: member.userId,
      eventType: event.eventType,
      channel: "email",
      payload: event.payload,
    });

    // Enqueue pg-boss job
    await boss.send(JOB_QUEUES.NOTIFICATION_SEND, {
      jobId,
      userId: member.userId,
      email: member.email,
      name: member.name,
      eventType: event.eventType,
      payload: event.payload,
    });

    // Also create an inbox notification for the user
    const actionUrl = deriveNotificationActionUrl(event.payload);
    void createNotification({
      userId: member.userId,
      type: event.eventType as InboxNotificationType,
      title: deriveNotificationTitle(event.eventType, event.payload),
      body: deriveNotificationBody(event.eventType, event.payload),
      ...(actionUrl !== undefined && { actionUrl }),
    }).catch(() => {
      // Inbox creation failure should not block email dispatch
    });

    enqueued++;
  }

  rootLogger.info(
    { eventType: event.eventType, creatorId: event.creatorId, enqueued },
    "Notification jobs enqueued",
  );
};
