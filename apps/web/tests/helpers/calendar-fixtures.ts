import type { CalendarEvent, FeedTokenResponse } from "@snc/shared";

// ── Web-level Fixtures (API response shapes consumed by frontend components) ──

export const makeMockCalendarEvent = (
  overrides?: Partial<CalendarEvent>,
): CalendarEvent => ({
  id: "evt_test001",
  title: "Recording Session",
  description: "Tracking drums for new album",
  startAt: "2026-03-20T14:00:00.000Z",
  endAt: "2026-03-20T18:00:00.000Z",
  allDay: false,
  category: "recording-session",
  location: "Studio A",
  createdBy: "user_test123",
  createdAt: "2026-03-15T10:00:00.000Z",
  updatedAt: "2026-03-15T10:00:00.000Z",
  ...overrides,
});

export const makeMockFeedToken = (
  overrides?: Partial<FeedTokenResponse>,
): FeedTokenResponse => ({
  token: "test-feed-token-uuid",
  url: "http://localhost:3080/api/calendar/feed.ics?token=test-feed-token-uuid",
  ...overrides,
});
