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

export async function fetchCalendarEvents(
  params?: Record<string, string | number | undefined>,
): Promise<CalendarEventsResponse> {
  return apiGet<CalendarEventsResponse>("/api/calendar/events", params);
}

export async function createCalendarEvent(
  data: CreateCalendarEvent,
): Promise<CalendarEvent> {
  const result = await apiMutate<{ event: CalendarEvent }>(
    "/api/calendar/events",
    { body: data },
  );
  return result.event;
}

export async function updateCalendarEvent(
  id: string,
  data: UpdateCalendarEvent,
): Promise<CalendarEvent> {
  const result = await apiMutate<{ event: CalendarEvent }>(
    `/api/calendar/events/${id}`,
    { method: "PATCH", body: data },
  );
  return result.event;
}

export async function deleteCalendarEvent(id: string): Promise<void> {
  await apiMutate<undefined>(`/api/calendar/events/${id}`, {
    method: "DELETE",
  });
}

export async function fetchFeedToken(): Promise<FeedTokenResponse> {
  return apiGet<FeedTokenResponse>("/api/calendar/feed-token");
}

export async function generateFeedToken(): Promise<FeedTokenResponse> {
  return apiMutate<FeedTokenResponse>("/api/calendar/feed-token", {});
}

// ── Creator-Scoped Events ──

export async function fetchCreatorEvents(
  creatorId: string,
  params?: Record<string, string | number | undefined>,
): Promise<CalendarEventsResponse> {
  return apiGet<CalendarEventsResponse>(
    `/api/creators/${creatorId}/events`,
    params,
  );
}

export async function createCreatorEvent(
  creatorId: string,
  data: CreateCalendarEvent,
): Promise<CalendarEvent> {
  const result = await apiMutate<{ event: CalendarEvent }>(
    `/api/creators/${creatorId}/events`,
    { body: data },
  );
  return result.event;
}

export async function updateCreatorEvent(
  creatorId: string,
  eventId: string,
  data: UpdateCalendarEvent,
): Promise<CalendarEvent> {
  const result = await apiMutate<{ event: CalendarEvent }>(
    `/api/creators/${creatorId}/events/${eventId}`,
    { method: "PATCH", body: data },
  );
  return result.event;
}

export async function fetchEventTypes(): Promise<EventTypesResponse> {
  return apiGet<EventTypesResponse>("/api/calendar/event-types");
}

export async function createCustomEventType(label: string): Promise<CustomEventType> {
  const result = await apiMutate<{ eventType: CustomEventType }>(
    "/api/calendar/event-types",
    { body: { label } },
  );
  return result.eventType;
}

export async function deleteCreatorEvent(
  creatorId: string,
  eventId: string,
): Promise<void> {
  await apiMutate<undefined>(
    `/api/creators/${creatorId}/events/${eventId}`,
    { method: "DELETE" },
  );
}
