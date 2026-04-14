import { describe, it, expect } from "vitest";

import {
  DEFAULT_EVENT_TYPES,
  DEFAULT_EVENT_TYPE_LABELS,
  EVENT_VISIBILITY,
  EventVisibilitySchema,
  EventTypeSchema,
  CalendarEventSchema,
  CreateCalendarEventSchema,
  UpdateCalendarEventSchema,
  CalendarEventsQuerySchema,
  CalendarEventResponseSchema,
  CalendarEventsResponseSchema,
  FeedTokenResponseSchema,
  UpcomingEventSchema,
  UpcomingEventsResponseSchema,
  type CalendarEvent,
  type CreateCalendarEvent,
  type UpdateCalendarEvent,
  type CalendarEventsQuery,
  type CalendarEventResponse,
  type CalendarEventsResponse,
  type FeedTokenResponse,
  type UpcomingEvent,
  type UpcomingEventsResponse,
} from "../src/index.js";

const VALID_EVENT = {
  id: "evt_test123",
  title: "Recording Session",
  description: "Tracking drums for new album",
  startAt: "2026-03-20T14:00:00.000Z",
  endAt: "2026-03-20T18:00:00.000Z",
  allDay: false,
  eventType: "recording-session",
  location: "Studio A",
  visibility: "internal" as const,
  createdBy: "user_abc",
  creatorId: null,
  creatorName: null,
  projectId: null,
  projectName: null,
  completedAt: null,
  createdAt: "2026-03-15T10:00:00.000Z",
  updatedAt: "2026-03-15T10:00:00.000Z",
};

describe("DEFAULT_EVENT_TYPES", () => {
  it("contains expected types", () => {
    expect(DEFAULT_EVENT_TYPES).toStrictEqual([
      "recording-session",
      "show",
      "meeting",
      "task",
      "other",
    ]);
  });

  it("has length 5", () => {
    expect(DEFAULT_EVENT_TYPES).toHaveLength(5);
  });

  it("includes task type", () => {
    expect(DEFAULT_EVENT_TYPES).toContain("task");
  });
});

describe("DEFAULT_EVENT_TYPE_LABELS", () => {
  it("has label for each default type", () => {
    for (const slug of DEFAULT_EVENT_TYPES) {
      expect(DEFAULT_EVENT_TYPE_LABELS[slug]).toBeTruthy();
    }
  });

  it("has correct labels", () => {
    expect(DEFAULT_EVENT_TYPE_LABELS["recording-session"]).toBe("Recording Session");
    expect(DEFAULT_EVENT_TYPE_LABELS["show"]).toBe("Show");
    expect(DEFAULT_EVENT_TYPE_LABELS["meeting"]).toBe("Meeting");
    expect(DEFAULT_EVENT_TYPE_LABELS["task"]).toBe("Task");
    expect(DEFAULT_EVENT_TYPE_LABELS["other"]).toBe("Other");
  });
});

describe("EventTypeSchema", () => {
  it.each(["recording-session", "show", "meeting", "my-custom-type"])(
    'accepts "%s"',
    (eventType) => {
      expect(EventTypeSchema.parse(eventType)).toBe(eventType);
    },
  );

  it("rejects empty string", () => {
    expect(() => EventTypeSchema.parse("")).toThrow();
  });

  it("rejects string exceeding 100 characters", () => {
    expect(() => EventTypeSchema.parse("x".repeat(101))).toThrow();
  });
});

describe("CalendarEventSchema", () => {
  it("validates a complete event object", () => {
    const result = CalendarEventSchema.parse(VALID_EVENT);
    expect(result.id).toBe("evt_test123");
    expect(result.title).toBe("Recording Session");
    expect(result.eventType).toBe("recording-session");
    expect(result.allDay).toBe(false);
    expect(result.location).toBe("Studio A");
    expect(result.projectId).toBeNull();
    expect(result.projectName).toBeNull();
  });

  it("accepts null endAt", () => {
    const result = CalendarEventSchema.parse({ ...VALID_EVENT, endAt: null });
    expect(result.endAt).toBeNull();
  });

  it("accepts projectId and projectName", () => {
    const result = CalendarEventSchema.parse({
      ...VALID_EVENT,
      projectId: "proj_123",
      projectName: "New Album",
    });
    expect(result.projectId).toBe("proj_123");
    expect(result.projectName).toBe("New Album");
  });

  it("accepts null completedAt", () => {
    const result = CalendarEventSchema.parse({ ...VALID_EVENT, completedAt: null });
    expect(result.completedAt).toBeNull();
  });

  it("accepts completedAt as ISO datetime string", () => {
    const result = CalendarEventSchema.parse({
      ...VALID_EVENT,
      completedAt: "2026-03-19T00:00:00.000Z",
    });
    expect(result.completedAt).toBe("2026-03-19T00:00:00.000Z");
  });

  it("rejects invalid datetime for startAt", () => {
    expect(() =>
      CalendarEventSchema.parse({ ...VALID_EVENT, startAt: "not-a-date" }),
    ).toThrow();
  });

  it("rejects missing required fields", () => {
    expect(() => CalendarEventSchema.parse({})).toThrow();
  });

  it("rejects missing eventType", () => {
    const { eventType: _, ...withoutEventType } = VALID_EVENT;
    expect(() => CalendarEventSchema.parse(withoutEventType)).toThrow();
  });
});

describe("CreateCalendarEventSchema", () => {
  const VALID_CREATE = {
    title: "New Event",
    startAt: "2026-04-01T10:00:00.000Z",
    eventType: "meeting",
  };

  it("validates with required fields only", () => {
    const result = CreateCalendarEventSchema.parse(VALID_CREATE);
    expect(result.title).toBe("New Event");
    expect(result.description).toBe("");
    expect(result.endAt).toBeNull();
    expect(result.allDay).toBe(false);
    expect(result.location).toBe("");
    expect(result.projectId).toBeNull();
  });

  it("validates with all fields", () => {
    const result = CreateCalendarEventSchema.parse({
      ...VALID_CREATE,
      description: "Team standup",
      endAt: "2026-04-01T11:00:00.000Z",
      allDay: false,
      location: "Conference Room",
      projectId: "proj_123",
    });
    expect(result.description).toBe("Team standup");
    expect(result.endAt).toBe("2026-04-01T11:00:00.000Z");
    expect(result.location).toBe("Conference Room");
    expect(result.projectId).toBe("proj_123");
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
        eventType: "meeting",
      }),
    ).toThrow();
  });

  it("rejects missing startAt", () => {
    expect(() =>
      CreateCalendarEventSchema.parse({ title: "Event", eventType: "meeting" }),
    ).toThrow();
  });

  it("rejects missing eventType", () => {
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

  it("accepts any string eventType", () => {
    const result = UpdateCalendarEventSchema.parse({ eventType: "my-custom-type" });
    expect(result.eventType).toBe("my-custom-type");
  });

  it("accepts null endAt", () => {
    const result = UpdateCalendarEventSchema.parse({ endAt: null });
    expect(result.endAt).toBeNull();
  });

  it("accepts projectId update", () => {
    const result = UpdateCalendarEventSchema.parse({ projectId: "proj_123" });
    expect(result.projectId).toBe("proj_123");
  });

  it("accepts null projectId to unlink", () => {
    const result = UpdateCalendarEventSchema.parse({ projectId: null });
    expect(result.projectId).toBeNull();
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

  it("accepts optional eventType filter", () => {
    const result = CalendarEventsQuerySchema.parse({
      eventType: "recording-session",
    });
    expect(result.eventType).toBe("recording-session");
  });

  it("accepts optional projectId filter", () => {
    const result = CalendarEventsQuerySchema.parse({
      projectId: "proj_123",
    });
    expect(result.projectId).toBe("proj_123");
  });

  it("accepts optional creatorId filter", () => {
    const result = CalendarEventsQuerySchema.parse({
      creatorId: "creator_abc",
    });
    expect(result.creatorId).toBe("creator_abc");
  });

  it("accepts optional cursor", () => {
    const result = CalendarEventsQuerySchema.parse({ cursor: "abc123" });
    expect(result.cursor).toBe("abc123");
  });

  it("accepts all params combined", () => {
    const result = CalendarEventsQuerySchema.parse({
      from: "2026-03-01T00:00:00.000Z",
      to: "2026-03-31T23:59:59.000Z",
      eventType: "show",
      cursor: "abc",
      limit: 25,
    });
    expect(result.from).toBe("2026-03-01T00:00:00.000Z");
    expect(result.to).toBe("2026-03-31T23:59:59.000Z");
    expect(result.eventType).toBe("show");
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

describe("EVENT_VISIBILITY / EventVisibilitySchema", () => {
  it("contains exactly public and internal", () => {
    expect(EVENT_VISIBILITY).toStrictEqual(["public", "internal"]);
  });

  it("accepts public", () => {
    expect(EventVisibilitySchema.parse("public")).toBe("public");
  });

  it("accepts internal", () => {
    expect(EventVisibilitySchema.parse("internal")).toBe("internal");
  });

  it("rejects unknown values", () => {
    expect(() => EventVisibilitySchema.parse("private")).toThrow();
  });
});

describe("CalendarEventSchema visibility", () => {
  it("accepts public visibility", () => {
    const result = CalendarEventSchema.parse({ ...VALID_EVENT, visibility: "public" });
    expect(result.visibility).toBe("public");
  });

  it("accepts internal visibility", () => {
    const result = CalendarEventSchema.parse({ ...VALID_EVENT, visibility: "internal" });
    expect(result.visibility).toBe("internal");
  });

  it("rejects invalid visibility", () => {
    expect(() =>
      CalendarEventSchema.parse({ ...VALID_EVENT, visibility: "private" }),
    ).toThrow();
  });
});

describe("CreateCalendarEventSchema visibility", () => {
  const VALID_CREATE = {
    title: "New Event",
    startAt: "2026-04-01T10:00:00.000Z",
    eventType: "meeting",
  };

  it("defaults to internal when omitted", () => {
    const result = CreateCalendarEventSchema.parse(VALID_CREATE);
    expect(result.visibility).toBe("internal");
  });

  it("accepts public", () => {
    const result = CreateCalendarEventSchema.parse({ ...VALID_CREATE, visibility: "public" });
    expect(result.visibility).toBe("public");
  });

  it("rejects invalid visibility", () => {
    expect(() =>
      CreateCalendarEventSchema.parse({ ...VALID_CREATE, visibility: "private" }),
    ).toThrow();
  });
});

describe("UpdateCalendarEventSchema visibility", () => {
  it("accepts optional visibility update", () => {
    const result = UpdateCalendarEventSchema.parse({ visibility: "public" });
    expect(result.visibility).toBe("public");
  });

  it("omits visibility when not provided", () => {
    const result = UpdateCalendarEventSchema.parse({});
    expect(result.visibility).toBeUndefined();
  });
});

const VALID_UPCOMING: UpcomingEvent = {
  id: "evt_upcoming1",
  title: "Live Show",
  description: "Evening performance",
  startAt: "2026-05-01T19:00:00.000Z",
  endAt: "2026-05-01T22:00:00.000Z",
  allDay: false,
  eventType: "show",
  location: "Main Stage",
  creatorId: "creator_abc",
  creatorName: "The Noisy Band",
  reminded: false,
};

describe("UpcomingEventSchema", () => {
  it("validates a complete upcoming event", () => {
    const result = UpcomingEventSchema.parse(VALID_UPCOMING);
    expect(result.id).toBe("evt_upcoming1");
    expect(result.creatorName).toBe("The Noisy Band");
  });

  it("accepts null endAt", () => {
    const result = UpcomingEventSchema.parse({ ...VALID_UPCOMING, endAt: null });
    expect(result.endAt).toBeNull();
  });

  it("accepts null creatorId and creatorName", () => {
    const result = UpcomingEventSchema.parse({
      ...VALID_UPCOMING,
      creatorId: null,
      creatorName: null,
    });
    expect(result.creatorId).toBeNull();
    expect(result.creatorName).toBeNull();
  });

  it("rejects missing required fields", () => {
    expect(() => UpcomingEventSchema.parse({})).toThrow();
  });
});

describe("UpcomingEventsResponseSchema", () => {
  it("validates items array", () => {
    const result: UpcomingEventsResponse = UpcomingEventsResponseSchema.parse({
      items: [VALID_UPCOMING],
    });
    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.id).toBe("evt_upcoming1");
  });

  it("validates empty items array", () => {
    const result = UpcomingEventsResponseSchema.parse({ items: [] });
    expect(result.items).toHaveLength(0);
  });

  it("rejects missing items field", () => {
    expect(() => UpcomingEventsResponseSchema.parse({})).toThrow();
  });
});

// ── Type-level assertions (compile-time only) ──

const _eventCheck: CalendarEvent = { ...VALID_EVENT, completedAt: null };
const _createCheck: CreateCalendarEvent = {
  title: "Event",
  startAt: "2026-04-01T10:00:00.000Z",
  eventType: "meeting",
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
