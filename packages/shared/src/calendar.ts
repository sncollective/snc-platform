import { z } from "zod";

import { createPaginationQuery } from "./pagination.js";

// ── Public Constants ──

export const DEFAULT_EVENT_TYPES = [
  "recording-session",
  "show",
  "meeting",
  "task",
  "other",
] as const;

export const DEFAULT_EVENT_TYPE_LABELS: Readonly<Record<(typeof DEFAULT_EVENT_TYPES)[number], string>> = {
  "recording-session": "Recording Session",
  "show": "Show",
  "meeting": "Meeting",
  "task": "Task",
  "other": "Other",
};

export const MAX_EVENT_TITLE_LENGTH = 200;
export const MAX_EVENT_DESCRIPTION_LENGTH = 5000;
export const MAX_EVENT_LOCATION_LENGTH = 500;

// ── Public Schemas ──

export const EventTypeSchema = z.string().min(1).max(100);

export const CalendarEventSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  startAt: z.iso.datetime(),
  endAt: z.iso.datetime().nullable(),
  allDay: z.boolean(),
  eventType: EventTypeSchema,
  location: z.string(),
  createdBy: z.string(),
  creatorId: z.string().nullable(),
  creatorName: z.string().nullable(),
  projectId: z.string().nullable(),
  projectName: z.string().nullable(),
  completedAt: z.iso.datetime().nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export const CreateCalendarEventSchema = z.object({
  title: z.string().min(1).max(MAX_EVENT_TITLE_LENGTH),
  description: z.string().max(MAX_EVENT_DESCRIPTION_LENGTH).default(""),
  startAt: z.iso.datetime(),
  endAt: z.iso.datetime().nullable().default(null),
  allDay: z.boolean().default(false),
  eventType: EventTypeSchema,
  location: z.string().max(MAX_EVENT_LOCATION_LENGTH).default(""),
  projectId: z.string().nullable().default(null),
});

export const UpdateCalendarEventSchema = z.object({
  title: z.string().min(1).max(MAX_EVENT_TITLE_LENGTH).optional(),
  description: z.string().max(MAX_EVENT_DESCRIPTION_LENGTH).optional(),
  startAt: z.iso.datetime().optional(),
  endAt: z.iso.datetime().nullable().optional(),
  allDay: z.boolean().optional(),
  eventType: EventTypeSchema.optional(),
  location: z.string().max(MAX_EVENT_LOCATION_LENGTH).optional(),
  projectId: z.string().nullable().optional(),
});

export const CalendarEventsQuerySchema = createPaginationQuery({ max: 100, default: 50 }).extend({
  from: z.iso.datetime().optional(),
  to: z.iso.datetime().optional(),
  eventType: z.string().optional(),
  projectId: z.string().optional(),
  creatorId: z.string().optional(),
});

export const CalendarEventResponseSchema = z.object({
  event: CalendarEventSchema,
});

export const CalendarEventsResponseSchema = z.object({
  items: z.array(CalendarEventSchema),
  nextCursor: z.string().nullable(),
});

export const FeedTokenResponseSchema = z.object({
  token: z.string(),
  url: z.string(),
});

// ── Public Types ──

export type CalendarEvent = z.infer<typeof CalendarEventSchema>;
export type CreateCalendarEvent = z.infer<typeof CreateCalendarEventSchema>;
export type UpdateCalendarEvent = z.infer<typeof UpdateCalendarEventSchema>;
export type CalendarEventsQuery = z.infer<typeof CalendarEventsQuerySchema>;
export type CalendarEventResponse = z.infer<typeof CalendarEventResponseSchema>;
export type CalendarEventsResponse = z.infer<typeof CalendarEventsResponseSchema>;
export type FeedTokenResponse = z.infer<typeof FeedTokenResponseSchema>;
