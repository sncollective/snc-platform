import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { makeMockCalendarEvent } from "../../helpers/calendar-fixtures.js";

vi.mock("../../../src/components/calendar/event-card.module.css", () => ({
  default: {
    card: "card",
    header: "header",
    time: "time",
    badges: "badges",
    badge: "badge",
    projectBadge: "projectBadge",
    creatorBadge: "creatorBadge",
    titleRow: "titleRow",
    taskCheckbox: "taskCheckbox",
    taskCompleted: "taskCompleted",
    title: "title",
    location: "location",
    description: "description",
    actions: "actions",
    editButton: "editButton",
    deleteButton: "deleteButton",
  },
}));

// ── Import component under test (after mocks) ──

import { EventCard } from "../../../src/components/calendar/event-card.js";

// ── Tests ──

describe("EventCard", () => {
  it("renders event title", () => {
    const event = makeMockCalendarEvent({ title: "Album Release Party" });
    render(<EventCard event={event} />);
    expect(screen.getByText("Album Release Party")).toBeInTheDocument();
  });

  it("displays event type label from DEFAULT_EVENT_TYPE_LABELS", () => {
    // Give the event a distinct title so "Recording Session" only appears as the badge
    const event = makeMockCalendarEvent({ eventType: "recording-session", title: "My Session" });
    render(<EventCard event={event} />);
    expect(screen.getByText("Recording Session")).toBeInTheDocument();
  });

  it("title-cases unknown event type slugs", () => {
    const event = makeMockCalendarEvent({ eventType: "album-release" });
    render(<EventCard event={event} />);
    expect(screen.getByText("Album Release")).toBeInTheDocument();
  });

  it("shows project badge when projectName is present", () => {
    const event = makeMockCalendarEvent({ projectName: "Animal Future LP" });
    render(<EventCard event={event} />);
    expect(screen.getByText("Animal Future LP")).toBeInTheDocument();
  });

  it("does not show project badge when projectName is null", () => {
    const event = makeMockCalendarEvent({ projectName: null });
    render(<EventCard event={event} />);
    // No project badge element with the CSS class
    expect(screen.queryByText(/Animal Future/i)).not.toBeInTheDocument();
  });

  it("shows creator badge when creatorName is present", () => {
    const event = makeMockCalendarEvent({ creatorName: "Jane Smith" });
    render(<EventCard event={event} />);
    expect(screen.getByText("Jane Smith")).toBeInTheDocument();
  });

  it("does not show creator badge when creatorName is null", () => {
    const event = makeMockCalendarEvent({ creatorName: null });
    render(<EventCard event={event} />);
    // Ensure no creator badge renders for common creator name patterns
    expect(screen.queryByText(/Jane Smith/i)).not.toBeInTheDocument();
  });

  it("shows location when present", () => {
    const event = makeMockCalendarEvent({ location: "Studio A" });
    render(<EventCard event={event} />);
    expect(screen.getByText("Studio A")).toBeInTheDocument();
  });

  it("renders all-day label for all-day events", () => {
    const event = makeMockCalendarEvent({ allDay: true });
    render(<EventCard event={event} />);
    expect(screen.getByText("All day")).toBeInTheDocument();
  });

  it("calls onEdit with event id when Edit is clicked", async () => {
    const user = userEvent.setup();
    const onEdit = vi.fn();
    const event = makeMockCalendarEvent({ id: "evt-abc" });
    render(<EventCard event={event} onEdit={onEdit} />);

    await user.click(screen.getByRole("button", { name: /edit/i }));

    expect(onEdit).toHaveBeenCalledWith("evt-abc");
  });

  it("calls onDelete with event id when Delete is clicked", async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn();
    const event = makeMockCalendarEvent({ id: "evt-abc" });
    render(<EventCard event={event} onDelete={onDelete} />);

    await user.click(screen.getByRole("button", { name: /delete/i }));

    expect(onDelete).toHaveBeenCalledWith("evt-abc");
  });

  it("does not render action buttons when neither onEdit nor onDelete is provided", () => {
    const event = makeMockCalendarEvent();
    render(<EventCard event={event} />);
    expect(screen.queryByRole("button", { name: /edit/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /delete/i })).not.toBeInTheDocument();
  });

  it("renders checkbox for task events", () => {
    const event = makeMockCalendarEvent({ eventType: "task", completedAt: null });
    render(<EventCard event={event} />);
    expect(screen.getByRole("checkbox")).toBeInTheDocument();
  });

  it("does not render checkbox for non-task events", () => {
    const event = makeMockCalendarEvent({ eventType: "show", completedAt: null });
    render(<EventCard event={event} />);
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
  });

  it("checkbox is checked when task is completed", () => {
    const event = makeMockCalendarEvent({
      eventType: "task",
      completedAt: "2026-03-19T00:00:00.000Z",
    });
    render(<EventCard event={event} />);
    expect(screen.getByRole("checkbox")).toBeChecked();
  });

  it("checkbox is unchecked when task is incomplete", () => {
    const event = makeMockCalendarEvent({ eventType: "task", completedAt: null });
    render(<EventCard event={event} />);
    expect(screen.getByRole("checkbox")).not.toBeChecked();
  });

  it("calls onToggleComplete with event id when checkbox is clicked", async () => {
    const user = userEvent.setup();
    const onToggleComplete = vi.fn();
    const event = makeMockCalendarEvent({ id: "evt-task-1", eventType: "task", completedAt: null });
    render(<EventCard event={event} onToggleComplete={onToggleComplete} />);

    await user.click(screen.getByRole("checkbox"));

    expect(onToggleComplete).toHaveBeenCalledWith("evt-task-1");
  });

  it("completed task card has taskCompleted class", () => {
    const event = makeMockCalendarEvent({
      eventType: "task",
      completedAt: "2026-03-19T00:00:00.000Z",
    });
    const { container } = render(<EventCard event={event} />);
    expect(container.firstChild).toHaveClass("taskCompleted");
  });

  it("incomplete task card does not have taskCompleted class", () => {
    const event = makeMockCalendarEvent({ eventType: "task", completedAt: null });
    const { container } = render(<EventCard event={event} />);
    expect(container.firstChild).not.toHaveClass("taskCompleted");
  });
});
