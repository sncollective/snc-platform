import { randomUUID } from "node:crypto";

import { and, eq, lt, desc, sql } from "drizzle-orm";

import { ok } from "@snc/shared";
import type { Result, AppError, InboxNotification, InboxNotificationType } from "@snc/shared";

import { db } from "../db/connection.js";
import { inboxNotifications } from "../db/schema/notification-inbox.schema.js";
import { sendToUser } from "./chat-rooms.js";

// ── Private Helpers ──

const toNotificationResponse = (
  row: typeof inboxNotifications.$inferSelect,
): InboxNotification => ({
  id: row.id,
  type: row.type as InboxNotificationType,
  title: row.title,
  body: row.body,
  actionUrl: row.actionUrl,
  read: row.read,
  createdAt: row.createdAt.toISOString(),
});

/** Push current unread count to the user's connected WebSocket clients. */
const pushUnreadCount = async (userId: string): Promise<void> => {
  const [result] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(inboxNotifications)
    .where(
      and(
        eq(inboxNotifications.userId, userId),
        eq(inboxNotifications.read, false),
      ),
    );

  sendToUser(userId, {
    type: "notification_count",
    count: result?.count ?? 0,
  });
};

// ── Public API ──

/**
 * Create an in-app notification for a user. Pushes an updated unread count
 * via WebSocket if the user is currently connected.
 *
 * Called by other services (e.g., streaming, subscription) when events occur.
 */
export const createNotification = async (opts: {
  userId: string;
  type: InboxNotificationType;
  title: string;
  body: string;
  actionUrl?: string;
}): Promise<Result<InboxNotification, AppError>> => {
  const [row] = await db
    .insert(inboxNotifications)
    .values({
      id: randomUUID(),
      userId: opts.userId,
      type: opts.type,
      title: opts.title,
      body: opts.body,
      actionUrl: opts.actionUrl ?? null,
    })
    .returning();

  // Fire-and-forget WebSocket nudge
  void pushUnreadCount(opts.userId);

  return ok(toNotificationResponse(row!));
};

/**
 * Get paginated notifications for a user, newest first.
 * Uses cursor-based pagination (before timestamp).
 */
export const getNotifications = async (opts: {
  userId: string;
  before?: string;
  limit: number;
}): Promise<Result<{ notifications: InboxNotification[]; hasMore: boolean }, AppError>> => {
  const conditions = [eq(inboxNotifications.userId, opts.userId)];
  if (opts.before) {
    conditions.push(lt(inboxNotifications.createdAt, new Date(opts.before)));
  }

  const rows = await db
    .select()
    .from(inboxNotifications)
    .where(and(...conditions))
    .orderBy(desc(inboxNotifications.createdAt))
    .limit(opts.limit + 1);

  const hasMore = rows.length > opts.limit;
  const notifications = rows.slice(0, opts.limit).map(toNotificationResponse);

  return ok({ notifications, hasMore });
};

/** Get the unread notification count for a user. */
export const getUnreadCount = async (
  userId: string,
): Promise<Result<number, AppError>> => {
  const [result] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(inboxNotifications)
    .where(
      and(
        eq(inboxNotifications.userId, userId),
        eq(inboxNotifications.read, false),
      ),
    );

  return ok(result?.count ?? 0);
};

/**
 * Mark a single notification as read. Returns ok(undefined) whether or not
 * the notification exists — idempotent and prevents information leakage.
 */
export const markRead = async (
  userId: string,
  notificationId: string,
): Promise<Result<void, AppError>> => {
  const [updated] = await db
    .update(inboxNotifications)
    .set({ read: true })
    .where(
      and(
        eq(inboxNotifications.id, notificationId),
        eq(inboxNotifications.userId, userId),
      ),
    )
    .returning({ id: inboxNotifications.id });

  if (!updated) {
    return ok(undefined); // Idempotent — already read or doesn't exist for this user
  }

  void pushUnreadCount(userId);
  return ok(undefined);
};

/** Mark all notifications as read for a user. */
export const markAllRead = async (
  userId: string,
): Promise<Result<void, AppError>> => {
  await db
    .update(inboxNotifications)
    .set({ read: true })
    .where(
      and(
        eq(inboxNotifications.userId, userId),
        eq(inboxNotifications.read, false),
      ),
    );

  void pushUnreadCount(userId);
  return ok(undefined);
};
