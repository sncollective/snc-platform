import { z } from "zod";

// ── Public Constants ──

/** Notification types for the in-app inbox. */
export const INBOX_NOTIFICATION_TYPES = [
  "go_live",
  "subscription_welcome",
  "new_content",
  "system",
  "event_reminder",
] as const;

// ── Public Types ──

export type InboxNotificationType = (typeof INBOX_NOTIFICATION_TYPES)[number];

// ── Public Schemas ──

export const InboxNotificationSchema = z.object({
  id: z.string(),
  type: z.enum(INBOX_NOTIFICATION_TYPES),
  title: z.string(),
  body: z.string(),
  // Relative-path only — the inbox client assigns this to `window.location.href`,
  // so permitting absolute URLs would open a redirect / `javascript:`-URI vector.
  actionUrl: z.string().refine((v) => v.startsWith("/"), {
    message: "actionUrl must be a relative path starting with '/'",
  }).nullable(),
  read: z.boolean(),
  createdAt: z.string().datetime(),
});

export const InboxNotificationsResponseSchema = z.object({
  notifications: z.array(InboxNotificationSchema),
  hasMore: z.boolean(),
});

export const InboxNotificationsQuerySchema = z.object({
  before: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export const UnreadCountResponseSchema = z.object({
  count: z.number().int().min(0),
});

// ── Public Types (derived) ──

export type InboxNotification = z.infer<typeof InboxNotificationSchema>;
export type InboxNotificationsResponse = z.infer<typeof InboxNotificationsResponseSchema>;
export type InboxNotificationsQuery = z.infer<typeof InboxNotificationsQuerySchema>;
export type UnreadCountResponse = z.infer<typeof UnreadCountResponseSchema>;
