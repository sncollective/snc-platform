import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, act, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { makeMockCalendarEvent } from "../../../helpers/calendar-fixtures.js";

// Mock CSS modules
vi.mock("../../../../src/components/calendar/timeline-view.module.css", () => ({
  default: { timeline: "timeline" },
}));

vi.mock("../../../../src/components/calendar/event-list.module.css", () => ({
  default: { list: "list", dateGroup: "dateGroup", dateHeading: "dateHeading", dayEvents: "dayEvents", empty: "empty" },
}));

vi.mock("../../../../src/components/calendar/event-card.module.css", () => ({
  default: {
    card: "card", header: "header", time: "time", badges: "badges",
    badge: "badge", projectBadge: "projectBadge", creatorBadge: "creatorBadge",
    titleRow: "titleRow", taskCheckbox: "taskCheckbox", taskCompleted: "taskCompleted",
    title: "title", location: "location", description: "description",
    actions: "actions", editButton: "editButton", deleteButton: "deleteButton",
  },
}));

vi.mock("../../../../src/styles/listing-page.module.css", () => ({
  default: { status: "status", loadMoreWrapper: "loadMoreWrapper", loadMoreButton: "loadMoreButton" },
}));

vi.mock("../../../../src/lib/format.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../../src/lib/format.js")>();
  return {
    ...actual,
    toLocalDateKey: (iso: string) => iso.slice(0, 10),
    formatLocalDate: (dateKey: string) => {
      const d = new Date(dateKey + "T12:00:00");
      return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    },
  };
});

// ── Helpers ──

function makeResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status });
}

// ── Tests ──

describe("TimelineView", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        makeResponse({ items: [], nextCursor: null }),
      ),
    );
  });

  // Import after mocks
  let TimelineView: typeof import("../../../../src/components/calendar/timeline-view.js").TimelineView;

  beforeEach(async () => {
    const mod = await import("../../../../src/components/calendar/timeline-view.js");
    TimelineView = mod.TimelineView;
  });

  it("renders with empty state — shows 'No events found.'", async () => {
    render(
      <TimelineView
        eventTypeFilter=""
        creatorFilter=""
        projectFilter=""
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("No events found.")).toBeInTheDocument();
    });
  });

  it("renders event list with items", async () => {
    const events = [
      makeMockCalendarEvent({ id: "evt-1", title: "Studio Session", startAt: "2026-04-01T10:00:00.000Z" }),
      makeMockCalendarEvent({ id: "evt-2", title: "Album Review", startAt: "2026-04-02T14:00:00.000Z" }),
    ];

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        makeResponse({ items: events, nextCursor: null }),
      ),
    );

    render(
      <TimelineView
        eventTypeFilter=""
        creatorFilter=""
        projectFilter=""
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("Studio Session")).toBeInTheDocument();
      expect(screen.getByText("Album Review")).toBeInTheDocument();
    });
  });

  it("shows 'Load More' button when nextCursor exists", async () => {
    const event = makeMockCalendarEvent({ startAt: "2026-04-01T10:00:00.000Z" });

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        makeResponse({ items: [event], nextCursor: "cursor-abc" }),
      ),
    );

    render(
      <TimelineView
        eventTypeFilter=""
        creatorFilter=""
        projectFilter=""
      />,
    );

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Load More" })).toBeInTheDocument();
    });
  });

  it("does not show 'Load More' button when nextCursor is null", async () => {
    render(
      <TimelineView
        eventTypeFilter=""
        creatorFilter=""
        projectFilter=""
      />,
    );

    await waitFor(() => {
      expect(screen.queryByRole("button", { name: "Load More" })).not.toBeInTheDocument();
    });
  });

  it("uses relative URL for API calls", async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      makeResponse({ items: [], nextCursor: null }),
    );
    vi.stubGlobal("fetch", mockFetch);

    render(
      <TimelineView
        eventTypeFilter=""
        creatorFilter=""
        projectFilter=""
      />,
    );

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled();
    });

    const calledUrl = mockFetch.mock.calls[0]?.[0] as string;
    expect(calledUrl).toMatch(/^\/api\/calendar\/events/);
  });

  it("includes filter params in API URL when filters are set", async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      makeResponse({ items: [], nextCursor: null }),
    );
    vi.stubGlobal("fetch", mockFetch);

    render(
      <TimelineView
        eventTypeFilter="recording-session"
        creatorFilter="creator-123"
        projectFilter="proj-456"
      />,
    );

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled();
    });

    const calledUrl = mockFetch.mock.calls[0]?.[0] as string;
    expect(calledUrl).toContain("eventType=recording-session");
    expect(calledUrl).toContain("creatorId=creator-123");
    expect(calledUrl).toContain("projectId=proj-456");
  });

  it("uses creator-scoped URL when creatorId prop is provided", async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      makeResponse({ items: [], nextCursor: null }),
    );
    vi.stubGlobal("fetch", mockFetch);

    render(
      <TimelineView
        eventTypeFilter=""
        creatorFilter=""
        projectFilter=""
        creatorId="creator-abc"
      />,
    );

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled();
    });

    const calledUrl = mockFetch.mock.calls[0]?.[0] as string;
    expect(calledUrl).toMatch(/^\/api\/creators\/creator-abc\/events/);
  });

  it("calls 'Load More' to fetch next page", async () => {
    const event = makeMockCalendarEvent({ startAt: "2026-04-01T10:00:00.000Z" });
    let callCount = 0;
    const mockFetch = vi.fn().mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return Promise.resolve(makeResponse({ items: [event], nextCursor: "cur-2" }));
      }
      return Promise.resolve(makeResponse({ items: [], nextCursor: null }));
    });
    vi.stubGlobal("fetch", mockFetch);

    const user = userEvent.setup();

    render(
      <TimelineView
        eventTypeFilter=""
        creatorFilter=""
        projectFilter=""
      />,
    );

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Load More" })).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "Load More" }));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });
});
