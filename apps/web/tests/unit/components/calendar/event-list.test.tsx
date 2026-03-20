import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

import { makeMockCalendarEvent } from "../../../helpers/calendar-fixtures.js";

// Mock CSS modules
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

// Mock format so toLocalDateKey uses UTC slice for determinism in tests
vi.mock("../../../../src/lib/format.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../../src/lib/format.js")>();
  return {
    ...actual,
    toLocalDateKey: (iso: string) => iso.slice(0, 10),
    formatLocalDate: (dateKey: string) => {
      // Simple format: "Mar 20, 2026"
      const d = new Date(dateKey + "T12:00:00");
      return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    },
  };
});

import { EventList } from "../../../../src/components/calendar/event-list.js";

// ── Tests ──

describe("EventList", () => {
  it("renders 'No events found.' when events list is empty", () => {
    render(<EventList events={[]} />);
    expect(screen.getByText("No events found.")).toBeInTheDocument();
  });

  it("groups events by local date key", () => {
    const events = [
      makeMockCalendarEvent({ id: "evt-1", title: "Morning Session", startAt: "2026-03-20T08:00:00.000Z" }),
      makeMockCalendarEvent({ id: "evt-2", title: "Afternoon Session", startAt: "2026-03-20T14:00:00.000Z" }),
      makeMockCalendarEvent({ id: "evt-3", title: "Next Day", startAt: "2026-03-21T10:00:00.000Z" }),
    ];

    render(<EventList events={events} />);

    expect(screen.getByText("Morning Session")).toBeInTheDocument();
    expect(screen.getByText("Afternoon Session")).toBeInTheDocument();
    expect(screen.getByText("Next Day")).toBeInTheDocument();
  });

  it("renders a date heading for each unique date group", () => {
    const events = [
      makeMockCalendarEvent({ id: "evt-a", title: "Event A", startAt: "2026-03-20T08:00:00.000Z" }),
      makeMockCalendarEvent({ id: "evt-b", title: "Event B", startAt: "2026-03-22T12:00:00.000Z" }),
    ];

    const { container } = render(<EventList events={events} />);

    // Date headings have class "dateHeading"
    const dateHeadings = container.querySelectorAll(".dateHeading");
    expect(dateHeadings.length).toBe(2);
  });

  it("renders all events when multiple events exist", () => {
    const events = [
      makeMockCalendarEvent({ id: "1", title: "First Event", startAt: "2026-03-01T09:00:00.000Z" }),
      makeMockCalendarEvent({ id: "2", title: "Second Event", startAt: "2026-03-15T10:00:00.000Z" }),
    ];

    render(<EventList events={events} />);

    expect(screen.getByText("First Event")).toBeInTheDocument();
    expect(screen.getByText("Second Event")).toBeInTheDocument();
  });
});
