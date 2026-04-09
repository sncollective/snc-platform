import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { UpcomingEvent } from "@snc/shared";

// ── Import component under test ──

import { EventCard } from "../../../../src/components/landing/event-card.js";

// ── Fixtures ──

function makeMockUpcomingEvent(overrides?: Partial<UpcomingEvent>): UpcomingEvent {
  return {
    id: "event-1",
    title: "Test Show",
    description: "A test event",
    startAt: "2026-06-15T18:00:00.000Z",
    endAt: "2026-06-15T20:00:00.000Z",
    allDay: false,
    eventType: "show",
    location: "Studio A",
    creatorId: "user-1",
    creatorName: "Test Creator",
    reminded: false,
    ...overrides,
  };
}

// ── Tests ──

describe("EventCard", () => {
  it("renders date badge, title, type tag, location, and creator", () => {
    render(<EventCard event={makeMockUpcomingEvent()} reminded={false} />);

    expect(screen.getByText("Test Show")).toBeInTheDocument();
    expect(screen.getByText("Show")).toBeInTheDocument();
    expect(screen.getByText("Studio A")).toBeInTheDocument();
    expect(screen.getByText("Test Creator")).toBeInTheDocument();
    // Date badge — June 15
    expect(screen.getByText("JUN")).toBeInTheDocument();
    expect(screen.getByText("15")).toBeInTheDocument();
  });

  it("hides location element when location is empty", () => {
    render(<EventCard event={makeMockUpcomingEvent({ location: "" })} reminded={false} />);

    // MapPin icon container should not be visible when location is empty
    expect(screen.queryByText("Studio A")).not.toBeInTheDocument();
  });

  it("shows raw string for custom event type not in DEFAULT_EVENT_TYPE_LABELS", () => {
    render(<EventCard event={makeMockUpcomingEvent({ eventType: "custom-type" })} reminded={false} />);

    expect(screen.getByText("custom-type")).toBeInTheDocument();
  });

  it("remind button calls onToggleRemind when clicked", async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn();
    render(<EventCard event={makeMockUpcomingEvent()} reminded={false} onToggleRemind={onToggle} />);

    await user.click(screen.getByRole("button", { name: /remind me about/i }));
    expect(onToggle).toHaveBeenCalledOnce();
  });

  it("remind button is disabled when isToggling is true", () => {
    render(<EventCard event={makeMockUpcomingEvent()} reminded={false} isToggling />);

    const remindButton = screen.getByRole("button", { name: /remind me about/i });
    expect(remindButton).toBeDisabled();
  });

  it("shows 'Remove reminder' aria-label when reminded is true", () => {
    render(<EventCard event={makeMockUpcomingEvent()} reminded />);

    expect(screen.getByRole("button", { name: /remove reminder for test show/i })).toBeInTheDocument();
  });

  it("shows 'Remind me about' aria-label when reminded is false", () => {
    render(<EventCard event={makeMockUpcomingEvent()} reminded={false} />);

    expect(screen.getByRole("button", { name: /remind me about test show/i })).toBeInTheDocument();
  });
});
