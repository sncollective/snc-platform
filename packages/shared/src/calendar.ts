import { z } from "zod";

// ── Public Constants ──

export const EVENT_CATEGORIES = [
  "recording-session",
  "album-milestone",
  "show",
  "meeting",
] as const;

export const MAX_EVENT_TITLE_LENGTH = 200;
export const MAX_EVENT_DESCRIPTION_LENGTH = 5000;
export const MAX_EVENT_LOCATION_LENGTH = 500;

// ── Public Schemas ──

export const EventCategorySchema = z.enum(EVENT_CATEGORIES);

export const CalendarEventSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  startAt: z.iso.datetime(),
  endAt: z.iso.datetime().nullable(),
  allDay: z.boolean(),
  category: EventCategorySchema,
  location: z.string(),
  createdBy: z.string(),
  creatorId: z.string().nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export const CreateCalendarEventSchema = z.object({
  title: z.string().min(1).max(MAX_EVENT_TITLE_LENGTH),
  description: z.string().max(MAX_EVENT_DESCRIPTION_LENGTH).default(""),
  startAt: z.iso.datetime(),
  endAt: z.iso.datetime().nullable().default(null),
  allDay: z.boolean().default(false),
  category: EventCategorySchema,
  location: z.string().max(MAX_EVENT_LOCATION_LENGTH).default(""),
});

export const UpdateCalendarEventSchema = z.object({
  title: z.string().min(1).max(MAX_EVENT_TITLE_LENGTH).optional(),
  description: z.string().max(MAX_EVENT_DESCRIPTION_LENGTH).optional(),
  startAt: z.iso.datetime().optional(),
  endAt: z.iso.datetime().nullable().optional(),
  allDay: z.boolean().optional(),
  category: EventCategorySchema.optional(),
  location: z.string().max(MAX_EVENT_LOCATION_LENGTH).optional(),
});

export const CalendarEventsQuerySchema = z.object({
  from: z.iso.datetime().optional(),
  to: z.iso.datetime().optional(),
  category: EventCategorySchema.optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
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

export type EventCategory = z.infer<typeof EventCategorySchema>;
export type CalendarEvent = z.infer<typeof CalendarEventSchema>;
export type CreateCalendarEvent = z.infer<typeof CreateCalendarEventSchema>;
export type UpdateCalendarEvent = z.infer<typeof UpdateCalendarEventSchema>;
export type CalendarEventsQuery = z.infer<typeof CalendarEventsQuerySchema>;
export type CalendarEventResponse = z.infer<typeof CalendarEventResponseSchema>;
export type CalendarEventsResponse = z.infer<typeof CalendarEventsResponseSchema>;
export type FeedTokenResponse = z.infer<typeof FeedTokenResponseSchema>;
