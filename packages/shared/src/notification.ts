import { z } from "zod";

// ── Public Constants ──

/** Events that can trigger notifications. */
export const NOTIFICATION_EVENT_TYPES = ["go_live", "new_content"] as const;

/** Delivery channels for notifications. */
export const NOTIFICATION_CHANNELS = ["email"] as const;

/** Job processing statuses. */
export const NOTIFICATION_JOB_STATUSES = [
  "pending",
  "sent",
  "failed",
] as const;

// ── Public Types ──

export type NotificationEventType = (typeof NOTIFICATION_EVENT_TYPES)[number];
export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number];
export type NotificationJobStatus = (typeof NOTIFICATION_JOB_STATUSES)[number];

// ── Public Schemas ──

export const NotificationEventTypeSchema = z.enum(NOTIFICATION_EVENT_TYPES);
export const NotificationChannelSchema = z.enum(NOTIFICATION_CHANNELS);

export const NotificationPreferenceSchema = z.object({
  eventType: NotificationEventTypeSchema,
  channel: NotificationChannelSchema,
  enabled: z.boolean(),
});

export const NotificationPreferencesResponseSchema = z.object({
  preferences: z.array(NotificationPreferenceSchema),
});

export const UpdateNotificationPreferenceSchema = z.object({
  eventType: NotificationEventTypeSchema,
  channel: NotificationChannelSchema,
  enabled: z.boolean(),
});

// ── Public Types (derived) ──

export type NotificationPreference = z.infer<typeof NotificationPreferenceSchema>;
export type NotificationPreferencesResponse = z.infer<typeof NotificationPreferencesResponseSchema>;
export type UpdateNotificationPreference = z.infer<typeof UpdateNotificationPreferenceSchema>;
