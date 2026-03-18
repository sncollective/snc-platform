import { describe, it, expect } from "vitest";

import {
  EVENT_CATEGORIES,
  EventCategorySchema,
  CalendarEventSchema,
  CreateCalendarEventSchema,
  UpdateCalendarEventSchema,
  CalendarEventsQuerySchema,
  CalendarEventResponseSchema,
  CalendarEventsResponseSchema,
  FeedTokenResponseSchema,
  type EventCategory,
  type CalendarEvent,
  type CreateCalendarEvent,
  type UpdateCalendarEvent,
  type CalendarEventsQuery,
  type CalendarEventResponse,
  type CalendarEventsResponse,
  type FeedTokenResponse,
} from "../src/index.js";

const VALID_EVENT = {
  id: "evt_test123",
  title: "Recording Session",
  description: "Tracking drums for new album",
  startAt: "2026-03-20T14:00:00.000Z",
  endAt: "2026-03-20T18:00:00.000Z",
  allDay: false,
  category: "recording-session" as const,
  location: "Studio A",
  createdBy: "user_abc",
  creatorId: null,
  createdAt: "2026-03-15T10:00:00.000Z",
  updatedAt: "2026-03-15T10:00:00.000Z",
};

describe("EVENT_CATEGORIES", () => {
  it("contains expected categories", () => {
    expect(EVENT_CATEGORIES).toStrictEqual([
      "recording-session",
      "album-milestone",
      "show",
      "meeting",
    ]);
  });

  it("has length 4", () => {
    expect(EVENT_CATEGORIES).toHaveLength(4);
  });
});

describe("EventCategorySchema", () => {
  it.each(["recording-session", "album-milestone", "show", "meeting"])(
    'accepts "%s"',
    (category) => {
      expect(EventCategorySchema.parse(category)).toBe(category);
    },
  );

  it("rejects invalid category", () => {
    expect(() => EventCategorySchema.parse("invalid")).toThrow();
  });
});

describe("CalendarEventSchema", () => {
  it("validates a complete event object", () => {
    const result = CalendarEventSchema.parse(VALID_EVENT);
    expect(result.id).toBe("evt_test123");
    expect(result.title).toBe("Recording Session");
    expect(result.category).toBe("recording-session");
    expect(result.allDay).toBe(false);
    expect(result.location).toBe("Studio A");
  });

  it("accepts null endAt", () => {
    const result = CalendarEventSchema.parse({ ...VALID_EVENT, endAt: null });
    expect(result.endAt).toBeNull();
  });

  it("rejects invalid datetime for startAt", () => {
    expect(() =>
      CalendarEventSchema.parse({ ...VALID_EVENT, startAt: "not-a-date" }),
    ).toThrow();
  });

  it("rejects missing required fields", () => {
    expect(() => CalendarEventSchema.parse({})).toThrow();
  });

  it("rejects invalid category", () => {
    expect(() =>
      CalendarEventSchema.parse({ ...VALID_EVENT, category: "invalid" }),
    ).toThrow();
  });
});

describe("CreateCalendarEventSchema", () => {
  const VALID_CREATE = {
    title: "New Event",
    startAt: "2026-04-01T10:00:00.000Z",
    category: "meeting" as const,
  };

  it("validates with required fields only", () => {
    const result = CreateCalendarEventSchema.parse(VALID_CREATE);
    expect(result.title).toBe("New Event");
    expect(result.description).toBe("");
    expect(result.endAt).toBeNull();
    expect(result.allDay).toBe(false);
    expect(result.location).toBe("");
  });

  it("validates with all fields", () => {
    const result = CreateCalendarEventSchema.parse({
      ...VALID_CREATE,
      description: "Team standup",
      endAt: "2026-04-01T11:00:00.000Z",
      allDay: false,
      location: "Conference Room",
    });
    expect(result.description).toBe("Team standup");
    expect(result.endAt).toBe("2026-04-01T11:00:00.000Z");
    expect(result.location).toBe("Conference Room");
  });

  it("rejects empty title", () => {
    expect(() =>
      CreateCalendarEventSchema.parse({ ...VALID_CREATE, title: "" }),
    ).toThrow();
  });

  it("rejects title exceeding 200 characters", () => {
    expect(() =>
      CreateCalendarEventSchema.parse({
        ...VALID_CREATE,
        title: "x".repeat(201),
      }),
    ).toThrow();
  });

  it("accepts title at exactly 200 characters", () => {
    const result = CreateCalendarEventSchema.parse({
      ...VALID_CREATE,
      title: "x".repeat(200),
    });
    expect(result.title).toHaveLength(200);
  });

  it("rejects invalid category", () => {
    expect(() =>
      CreateCalendarEventSchema.parse({ ...VALID_CREATE, category: "invalid" }),
    ).toThrow();
  });

  it("rejects invalid startAt", () => {
    expect(() =>
      CreateCalendarEventSchema.parse({ ...VALID_CREATE, startAt: "bad" }),
    ).toThrow();
  });

  it("rejects description exceeding 5000 characters", () => {
    expect(() =>
      CreateCalendarEventSchema.parse({
        ...VALID_CREATE,
        description: "x".repeat(5001),
      }),
    ).toThrow();
  });

  it("rejects location exceeding 500 characters", () => {
    expect(() =>
      CreateCalendarEventSchema.parse({
        ...VALID_CREATE,
        location: "x".repeat(501),
      }),
    ).toThrow();
  });

  it("rejects missing title", () => {
    expect(() =>
      CreateCalendarEventSchema.parse({
        startAt: "2026-04-01T10:00:00.000Z",
        category: "meeting",
      }),
    ).toThrow();
  });

  it("rejects missing startAt", () => {
    expect(() =>
      CreateCalendarEventSchema.parse({ title: "Event", category: "meeting" }),
    ).toThrow();
  });

  it("rejects missing category", () => {
    expect(() =>
      CreateCalendarEventSchema.parse({
        title: "Event",
        startAt: "2026-04-01T10:00:00.000Z",
      }),
    ).toThrow();
  });
});

describe("UpdateCalendarEventSchema", () => {
  it("validates empty update (all optional)", () => {
    const result = UpdateCalendarEventSchema.parse({});
    expect(result).toStrictEqual({});
  });

  it("validates partial update", () => {
    const result = UpdateCalendarEventSchema.parse({
      title: "Updated Title",
      location: "New Location",
    });
    expect(result.title).toBe("Updated Title");
    expect(result.location).toBe("New Location");
  });

  it("rejects empty title", () => {
    expect(() =>
      UpdateCalendarEventSchema.parse({ title: "" }),
    ).toThrow();
  });

  it("rejects invalid category", () => {
    expect(() =>
      UpdateCalendarEventSchema.parse({ category: "invalid" }),
    ).toThrow();
  });

  it("accepts null endAt", () => {
    const result = UpdateCalendarEventSchema.parse({ endAt: null });
    expect(result.endAt).toBeNull();
  });
});

describe("CalendarEventsQuerySchema", () => {
  it("defaults limit to 50 when omitted", () => {
    const result = CalendarEventsQuerySchema.parse({});
    expect(result.limit).toBe(50);
  });

  it("coerces string limit to number", () => {
    const result = CalendarEventsQuerySchema.parse({ limit: "30" });
    expect(result.limit).toBe(30);
  });

  it("accepts limit at minimum boundary (1)", () => {
    const result = CalendarEventsQuerySchema.parse({ limit: 1 });
    expect(result.limit).toBe(1);
  });

  it("accepts limit at maximum boundary (100)", () => {
    const result = CalendarEventsQuerySchema.parse({ limit: 100 });
    expect(result.limit).toBe(100);
  });

  it("rejects limit below minimum (0)", () => {
    expect(() => CalendarEventsQuerySchema.parse({ limit: 0 })).toThrow();
  });

  it("rejects limit above maximum (101)", () => {
    expect(() => CalendarEventsQuerySchema.parse({ limit: 101 })).toThrow();
  });

  it("accepts optional from date", () => {
    const result = CalendarEventsQuerySchema.parse({
      from: "2026-03-01T00:00:00.000Z",
    });
    expect(result.from).toBe("2026-03-01T00:00:00.000Z");
  });

  it("accepts optional to date", () => {
    const result = CalendarEventsQuerySchema.parse({
      to: "2026-03-31T23:59:59.000Z",
    });
    expect(result.to).toBe("2026-03-31T23:59:59.000Z");
  });

  it("accepts optional category", () => {
    const result = CalendarEventsQuerySchema.parse({
      category: "recording-session",
    });
    expect(result.category).toBe("recording-session");
  });

  it("rejects invalid category", () => {
    expect(() =>
      CalendarEventsQuerySchema.parse({ category: "invalid" }),
    ).toThrow();
  });

  it("accepts optional cursor", () => {
    const result = CalendarEventsQuerySchema.parse({ cursor: "abc123" });
    expect(result.cursor).toBe("abc123");
  });

  it("accepts all params combined", () => {
    const result = CalendarEventsQuerySchema.parse({
      from: "2026-03-01T00:00:00.000Z",
      to: "2026-03-31T23:59:59.000Z",
      category: "show",
      cursor: "abc",
      limit: 25,
    });
    expect(result.from).toBe("2026-03-01T00:00:00.000Z");
    expect(result.to).toBe("2026-03-31T23:59:59.000Z");
    expect(result.category).toBe("show");
    expect(result.cursor).toBe("abc");
    expect(result.limit).toBe(25);
  });
});

describe("CalendarEventResponseSchema", () => {
  it("validates event wrapper", () => {
    const result = CalendarEventResponseSchema.parse({ event: VALID_EVENT });
    expect(result.event.id).toBe("evt_test123");
  });

  it("rejects missing event field", () => {
    expect(() => CalendarEventResponseSchema.parse({})).toThrow();
  });
});

describe("CalendarEventsResponseSchema", () => {
  it("validates items array with nextCursor", () => {
    const result = CalendarEventsResponseSchema.parse({
      items: [VALID_EVENT],
      nextCursor: "cursor_abc",
    });
    expect(result.items).toHaveLength(1);
    expect(result.nextCursor).toBe("cursor_abc");
  });

  it("validates empty items with null nextCursor", () => {
    const result = CalendarEventsResponseSchema.parse({
      items: [],
      nextCursor: null,
    });
    expect(result.items).toHaveLength(0);
    expect(result.nextCursor).toBeNull();
  });

  it("rejects missing items field", () => {
    expect(() =>
      CalendarEventsResponseSchema.parse({ nextCursor: null }),
    ).toThrow();
  });

  it("rejects invalid items in array", () => {
    expect(() =>
      CalendarEventsResponseSchema.parse({
        items: [{ invalid: true }],
        nextCursor: null,
      }),
    ).toThrow();
  });
});

describe("FeedTokenResponseSchema", () => {
  it("validates token and url", () => {
    const result = FeedTokenResponseSchema.parse({
      token: "abc-123",
      url: "https://example.com/api/calendar/feed.ics?token=abc-123",
    });
    expect(result.token).toBe("abc-123");
    expect(result.url).toContain("abc-123");
  });

  it("rejects missing token", () => {
    expect(() =>
      FeedTokenResponseSchema.parse({ url: "https://example.com" }),
    ).toThrow();
  });

  it("rejects missing url", () => {
    expect(() =>
      FeedTokenResponseSchema.parse({ token: "abc" }),
    ).toThrow();
  });
});

// ── Type-level assertions (compile-time only) ──

const _categoryCheck: EventCategory = "recording-session";
const _eventCheck: CalendarEvent = VALID_EVENT;
const _createCheck: CreateCalendarEvent = {
  title: "Event",
  startAt: "2026-04-01T10:00:00.000Z",
  category: "meeting",
};
const _updateCheck: UpdateCalendarEvent = { title: "Updated" };
const _queryCheck: CalendarEventsQuery = { limit: 50 };
const _eventResponseCheck: CalendarEventResponse = { event: VALID_EVENT };
const _eventsResponseCheck: CalendarEventsResponse = {
  items: [],
  nextCursor: null,
};
const _feedTokenCheck: FeedTokenResponse = {
  token: "abc",
  url: "https://example.com",
};
