import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { makeMockCalendarEvent } from "../../../helpers/calendar-fixtures.js";

vi.mock("../../../../src/components/calendar/day-detail-popover.module.css", () => ({
  default: {
    popover: "popover",
    header: "header",
    heading: "heading",
    closeButton: "closeButton",
    eventList: "eventList",
  },
}));

vi.mock("../../../../src/components/calendar/event-card.module.css", () => ({
  default: {
    card: "card",
    header: "header",
    time: "time",
    badges: "badges",
    badge: "badge",
    projectBadge: "projectBadge",
    creatorBadge: "creatorBadge",
    titleRow: "titleRow",
    title: "title",
    taskCheckbox: "taskCheckbox",
    taskCompleted: "taskCompleted",
    location: "location",
    description: "description",
    actions: "actions",
    editButton: "editButton",
    deleteButton: "deleteButton",
  },
}));

vi.mock("../../../../src/lib/format.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../../src/lib/format.js")>();
  return {
    ...actual,
    formatLocalDate: (dateKey: string) => `Formatted: ${dateKey}`,
  };
});

import { DayDetailPopover } from "../../../../src/components/calendar/day-detail-popover.js";

// ── Tests ──

describe("DayDetailPopover", () => {
  it("renders the date heading and all events", () => {
    const events = [
      makeMockCalendarEvent({ id: "evt-1", title: "Morning Stand-Up" }),
      makeMockCalendarEvent({ id: "evt-2", title: "Studio Booking" }),
    ];

    render(
      <DayDetailPopover
        dateKey="2026-03-15"
        events={events}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByText("Formatted: 2026-03-15")).toBeInTheDocument();
    expect(screen.getByText("Morning Stand-Up")).toBeInTheDocument();
    expect(screen.getByText("Studio Booking")).toBeInTheDocument();
  });

  it("has correct dialog role and aria-label", () => {
    render(
      <DayDetailPopover
        dateKey="2026-03-15"
        events={[]}
        onClose={vi.fn()}
      />,
    );

    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveAttribute("aria-label", "Events for Formatted: 2026-03-15");
  });

  it("calls onClose when close button is clicked", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    render(
      <DayDetailPopover
        dateKey="2026-03-15"
        events={[]}
        onClose={onClose}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Close" }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("calls onClose when Escape key is pressed", () => {
    const onClose = vi.fn();

    render(
      <DayDetailPopover
        dateKey="2026-03-15"
        events={[]}
        onClose={onClose}
      />,
    );

    fireEvent.keyDown(document, { key: "Escape" });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("calls onClose when clicking outside the popover", () => {
    const onClose = vi.fn();

    render(
      <div>
        <DayDetailPopover
          dateKey="2026-03-15"
          events={[]}
          onClose={onClose}
        />
        <button type="button">Outside</button>
      </div>,
    );

    fireEvent.mouseDown(screen.getByText("Outside"));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("does not call onClose when clicking inside the popover", () => {
    const onClose = vi.fn();

    render(
      <DayDetailPopover
        dateKey="2026-03-15"
        events={[]}
        onClose={onClose}
      />,
    );

    fireEvent.mouseDown(screen.getByRole("dialog"));

    expect(onClose).not.toHaveBeenCalled();
  });

  it("calls onEventClick with event id when event Edit button is clicked", async () => {
    const user = userEvent.setup();
    const onEventClick = vi.fn();
    const event = makeMockCalendarEvent({ id: "evt-click", title: "Click Test Event" });

    render(
      <DayDetailPopover
        dateKey="2026-03-15"
        events={[event]}
        onClose={vi.fn()}
        onEventClick={onEventClick}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Edit" }));

    expect(onEventClick).toHaveBeenCalledWith("evt-click");
  });

  it("renders empty event list when no events are provided", () => {
    render(
      <DayDetailPopover
        dateKey="2026-03-15"
        events={[]}
        onClose={vi.fn()}
      />,
    );

    // Dialog renders but has no event cards
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Edit" })).not.toBeInTheDocument();
  });
});
