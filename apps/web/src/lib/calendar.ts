import type {
  CalendarEvent,
  CalendarEventsResponse,
  CreateCalendarEvent,
  UpdateCalendarEvent,
  FeedTokenResponse,
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
