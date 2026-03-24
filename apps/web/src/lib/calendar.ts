import type {
  CalendarEvent,
  CalendarEventsResponse,
  CreateCalendarEvent,
  UpdateCalendarEvent,
  FeedTokenResponse,
  EventTypesResponse,
  CustomEventType,
} from "@snc/shared";

import { apiGet, apiMutate } from "./fetch-utils.js";

// ── Public API ──

/** Fetch calendar events with optional query filters. */
export async function fetchCalendarEvents(
  params?: Record<string, string | number | undefined>,
): Promise<CalendarEventsResponse> {
  return apiGet<CalendarEventsResponse>("/api/calendar/events", params);
}

/** Create a new calendar event. */
export async function createCalendarEvent(
  data: CreateCalendarEvent,
): Promise<CalendarEvent> {
  const result = await apiMutate<{ event: CalendarEvent }>(
    "/api/calendar/events",
    { body: data },
  );
  return result.event;
}

/** Update an existing calendar event by ID. */
export async function updateCalendarEvent(
  id: string,
  data: UpdateCalendarEvent,
): Promise<CalendarEvent> {
  const result = await apiMutate<{ event: CalendarEvent }>(
    `/api/calendar/events/${encodeURIComponent(id)}`,
    { method: "PATCH", body: data },
  );
  return result.event;
}

/** Toggle the completion status of a calendar event. */
export async function toggleEventComplete(
  id: string,
): Promise<CalendarEvent> {
  const result = await apiMutate<{ event: CalendarEvent }>(
    `/api/calendar/events/${encodeURIComponent(id)}/complete`,
    { method: "PATCH" },
  );
  return result.event;
}

/** Delete a calendar event by ID. */
export async function deleteCalendarEvent(id: string): Promise<void> {
  await apiMutate<undefined>(`/api/calendar/events/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

/** Fetch the current user's iCal feed token. */
export async function fetchFeedToken(): Promise<FeedTokenResponse> {
  return apiGet<FeedTokenResponse>("/api/calendar/feed-token");
}

/** Generate a new iCal feed token, replacing any existing one. */
export async function generateFeedToken(): Promise<FeedTokenResponse> {
  return apiMutate<FeedTokenResponse>("/api/calendar/feed-token", {});
}

// ── Creator-Scoped Events ──

/** Fetch calendar events scoped to a specific creator. */
export async function fetchCreatorEvents(
  creatorId: string,
  params?: Record<string, string | number | undefined>,
): Promise<CalendarEventsResponse> {
  return apiGet<CalendarEventsResponse>(
    `/api/creators/${encodeURIComponent(creatorId)}/events`,
    params,
  );
}

/** Create a calendar event scoped to a specific creator. */
export async function createCreatorEvent(
  creatorId: string,
  data: CreateCalendarEvent,
): Promise<CalendarEvent> {
  const result = await apiMutate<{ event: CalendarEvent }>(
    `/api/creators/${encodeURIComponent(creatorId)}/events`,
    { body: data },
  );
  return result.event;
}

/** Update a creator-scoped calendar event. */
export async function updateCreatorEvent(
  creatorId: string,
  eventId: string,
  data: UpdateCalendarEvent,
): Promise<CalendarEvent> {
  const result = await apiMutate<{ event: CalendarEvent }>(
    `/api/creators/${encodeURIComponent(creatorId)}/events/${encodeURIComponent(eventId)}`,
    { method: "PATCH", body: data },
  );
  return result.event;
}

/** Fetch all available calendar event types. */
export async function fetchEventTypes(): Promise<EventTypesResponse> {
  return apiGet<EventTypesResponse>("/api/calendar/event-types");
}

/** Create a custom calendar event type with the given label. */
export async function createCustomEventType(label: string): Promise<CustomEventType> {
  const result = await apiMutate<{ eventType: CustomEventType }>(
    "/api/calendar/event-types",
    { body: { label } },
  );
  return result.eventType;
}

/** Delete a creator-scoped calendar event. */
export async function deleteCreatorEvent(
  creatorId: string,
  eventId: string,
): Promise<void> {
  await apiMutate<undefined>(
    `/api/creators/${encodeURIComponent(creatorId)}/events/${encodeURIComponent(eventId)}`,
    { method: "DELETE" },
  );
}
