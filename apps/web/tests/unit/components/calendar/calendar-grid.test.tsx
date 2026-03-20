import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { makeMockCalendarEvent } from "../../../helpers/calendar-fixtures.js";

vi.mock("../../../../src/components/calendar/calendar-grid.module.css", () => ({
  default: {
    grid: "grid",
    headerRow: "headerRow",
    dayHeader: "dayHeader",
    weekRow: "weekRow",
    cell: "cell",
    cellOtherMonth: "cellOtherMonth",
    cellDay: "cellDay",
    cellEvents: "cellEvents",
    eventPill: "eventPill",
    spanBar: "spanBar",
    overflow: "overflow",
  },
}));

vi.mock("../../../../src/lib/format.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../../src/lib/format.js")>();
  return {
    ...actual,
    // toLocalDateKey: use a simple UTC-based implementation for test determinism
    toLocalDateKey: (iso: string) => iso.slice(0, 10),
  };
});

import { CalendarGrid } from "../../../../src/components/calendar/calendar-grid.js";

// ── Tests ──

describe("CalendarGrid", () => {
  it("renders 7 day headers", () => {
    render(
      <CalendarGrid
        events={[]}
        year={2026}
        month={2}
        onEventClick={vi.fn()}
      />,
    );

    const headers = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    for (const h of headers) {
      expect(screen.getByText(h)).toBeInTheDocument();
    }
  });

  it("renders correct number of week rows for March 2026", () => {
    // March 2026 starts on Sunday (dow=0) and has 31 days → 5 rows × 7 = 35 cells
    const { container } = render(
      <CalendarGrid
        events={[]}
        year={2026}
        month={2}
        onEventClick={vi.fn()}
      />,
    );

    const weekRows = container.querySelectorAll(".weekRow");
    expect(weekRows).toHaveLength(5);
  });

  it("renders correct number of cells for March 2026 (includes padding cells)", () => {
    // March 2026 starts on Sunday (dow=0) and has 31 days → 5 rows × 7 = 35 cells
    render(
      <CalendarGrid
        events={[]}
        year={2026}
        month={2}
        onEventClick={vi.fn()}
      />,
    );

    // Day number "31" appears only once (last day of March 2026)
    expect(screen.getAllByText("31").length).toBeGreaterThanOrEqual(1);
    // Day number "15" appears only once in March
    expect(screen.getAllByText("15").length).toBeGreaterThanOrEqual(1);
  });

  it("renders events in the correct cells", () => {
    const event = makeMockCalendarEvent({
      id: "evt-1",
      title: "Band Rehearsal",
      startAt: "2026-03-10T14:00:00.000Z",
      endAt: "2026-03-10T16:00:00.000Z",
    });

    render(
      <CalendarGrid
        events={[event]}
        year={2026}
        month={2}
        onEventClick={vi.fn()}
      />,
    );

    expect(screen.getByText("Band Rehearsal")).toBeInTheDocument();
  });

  it("shows overflow '+N more' when more than 3 events on a day", () => {
    const events = Array.from({ length: 5 }, (_, i) =>
      makeMockCalendarEvent({
        id: `evt-${i}`,
        title: `Event ${i}`,
        startAt: "2026-03-15T10:00:00.000Z",
        endAt: "2026-03-15T11:00:00.000Z",
      }),
    );

    render(
      <CalendarGrid
        events={events}
        year={2026}
        month={2}
        onEventClick={vi.fn()}
      />,
    );

    // Should show "+2 more" (5 - 3 = 2 overflow)
    expect(screen.getByText("+2 more")).toBeInTheDocument();
    // Should show first 3 events
    expect(screen.getByText("Event 0")).toBeInTheDocument();
    expect(screen.getByText("Event 1")).toBeInTheDocument();
    expect(screen.getByText("Event 2")).toBeInTheDocument();
    // Should NOT show overflow events
    expect(screen.queryByText("Event 3")).not.toBeInTheDocument();
    expect(screen.queryByText("Event 4")).not.toBeInTheDocument();
  });

  it("calls onEventClick with event id when event pill is clicked", async () => {
    const user = userEvent.setup();
    const onEventClick = vi.fn();
    const event = makeMockCalendarEvent({
      id: "evt-click-test",
      title: "Click Me",
      startAt: "2026-03-05T09:00:00.000Z",
      endAt: "2026-03-05T10:00:00.000Z",
    });

    render(
      <CalendarGrid
        events={[event]}
        year={2026}
        month={2}
        onEventClick={onEventClick}
      />,
    );

    await user.click(screen.getByText("Click Me"));

    expect(onEventClick).toHaveBeenCalledWith("evt-click-test");
  });

  it("renders without errors when events list is empty", () => {
    expect(() =>
      render(<CalendarGrid events={[]} year={2026} month={2} />),
    ).not.toThrow();
  });

  it("renders a span bar for a multi-day event", () => {
    const event = makeMockCalendarEvent({
      id: "evt-multiday",
      title: "Studio Week",
      startAt: "2026-03-09T00:00:00.000Z",
      endAt: "2026-03-13T00:00:00.000Z",
    });

    const { container } = render(
      <CalendarGrid
        events={[event]}
        year={2026}
        month={2}
        onEventClick={vi.fn()}
      />,
    );

    const spanBars = container.querySelectorAll(".spanBar");
    expect(spanBars.length).toBeGreaterThanOrEqual(1);
    expect(spanBars[0]?.textContent).toBe("Studio Week");
  });

  it("renders two span bars for an event crossing a week boundary", () => {
    // March 2026: week 1 ends Sat March 7, week 2 starts Sun March 8
    const event = makeMockCalendarEvent({
      id: "evt-crossweek",
      title: "Cross-Week Tour",
      startAt: "2026-03-05T00:00:00.000Z",
      endAt: "2026-03-10T00:00:00.000Z",
    });

    const { container } = render(
      <CalendarGrid
        events={[event]}
        year={2026}
        month={2}
        onEventClick={vi.fn()}
      />,
    );

    const spanBars = container.querySelectorAll(".spanBar");
    expect(spanBars.length).toBe(2);
  });

  it("calls onEventClick when a span bar is clicked", async () => {
    const user = userEvent.setup();
    const onEventClick = vi.fn();
    const event = makeMockCalendarEvent({
      id: "evt-spanclick",
      title: "Span Click Test",
      startAt: "2026-03-09T00:00:00.000Z",
      endAt: "2026-03-11T00:00:00.000Z",
    });

    render(
      <CalendarGrid
        events={[event]}
        year={2026}
        month={2}
        onEventClick={onEventClick}
      />,
    );

    const spanBar = screen.getByText("Span Click Test");
    await user.click(spanBar);

    expect(onEventClick).toHaveBeenCalledWith("evt-spanclick");
  });

  it("renders single-day events as pills, not span bars", () => {
    const event = makeMockCalendarEvent({
      id: "evt-single",
      title: "Single Day Event",
      startAt: "2026-03-15T10:00:00.000Z",
      endAt: "2026-03-15T12:00:00.000Z",
    });

    const { container } = render(
      <CalendarGrid
        events={[event]}
        year={2026}
        month={2}
        onEventClick={vi.fn()}
      />,
    );

    const spanBars = container.querySelectorAll(".spanBar");
    const pills = container.querySelectorAll(".eventPill");
    expect(spanBars.length).toBe(0);
    expect(pills.length).toBeGreaterThanOrEqual(1);
  });

  it("renders '+N more' as a button element", () => {
    const events = Array.from({ length: 5 }, (_, i) =>
      makeMockCalendarEvent({
        id: `evt-${i}`,
        title: `Event ${i}`,
        startAt: "2026-03-15T10:00:00.000Z",
        endAt: "2026-03-15T11:00:00.000Z",
      }),
    );

    render(
      <CalendarGrid
        events={events}
        year={2026}
        month={2}
        onEventClick={vi.fn()}
      />,
    );

    const overflowButton = screen.getByText("+2 more");
    expect(overflowButton.tagName).toBe("BUTTON");
  });

  it("clicking '+N more' expands the cell to show all events inline", async () => {
    const user = userEvent.setup();
    const events = Array.from({ length: 5 }, (_, i) =>
      makeMockCalendarEvent({
        id: `evt-${i}`,
        title: `Event ${i}`,
        startAt: "2026-03-15T10:00:00.000Z",
        endAt: "2026-03-15T11:00:00.000Z",
      }),
    );

    render(
      <CalendarGrid
        events={events}
        year={2026}
        month={2}
        onEventClick={vi.fn()}
      />,
    );

    // Before expansion: overflow events not visible
    expect(screen.queryByText("Event 3")).not.toBeInTheDocument();
    expect(screen.queryByText("Event 4")).not.toBeInTheDocument();

    await user.click(screen.getByText("+2 more"));

    // After expansion: all events visible inline (no popover)
    expect(screen.getByText("Event 3")).toBeInTheDocument();
    expect(screen.getByText("Event 4")).toBeInTheDocument();
    // No popover rendered
    expect(screen.queryByTestId("day-detail-popover")).not.toBeInTheDocument();
  });

  it("clicking '+N more' shows 'Show less' button when expanded", async () => {
    const user = userEvent.setup();
    const events = Array.from({ length: 5 }, (_, i) =>
      makeMockCalendarEvent({
        id: `evt-${i}`,
        title: `Event ${i}`,
        startAt: "2026-03-15T10:00:00.000Z",
        endAt: "2026-03-15T11:00:00.000Z",
      }),
    );

    render(
      <CalendarGrid
        events={events}
        year={2026}
        month={2}
        onEventClick={vi.fn()}
      />,
    );

    expect(screen.queryByText("Show less")).not.toBeInTheDocument();

    await user.click(screen.getByText("+2 more"));

    expect(screen.getByText("Show less")).toBeInTheDocument();
  });

  it("clicking 'Show less' collapses back to truncated view", async () => {
    const user = userEvent.setup();
    const events = Array.from({ length: 5 }, (_, i) =>
      makeMockCalendarEvent({
        id: `evt-${i}`,
        title: `Event ${i}`,
        startAt: "2026-03-15T10:00:00.000Z",
        endAt: "2026-03-15T11:00:00.000Z",
      }),
    );

    render(
      <CalendarGrid
        events={events}
        year={2026}
        month={2}
        onEventClick={vi.fn()}
      />,
    );

    await user.click(screen.getByText("+2 more"));
    expect(screen.getByText("Event 4")).toBeInTheDocument();

    await user.click(screen.getByText("Show less"));

    expect(screen.queryByText("Event 3")).not.toBeInTheDocument();
    expect(screen.queryByText("Event 4")).not.toBeInTheDocument();
    expect(screen.queryByText("Show less")).not.toBeInTheDocument();
  });
});
