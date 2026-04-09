import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import type { UpcomingEvent } from "@snc/shared";

// ── Import component under test ──

import { ComingUp } from "../../../../src/components/landing/coming-up.js";

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

describe("ComingUp", () => {
  it("renders event cards when events provided", () => {
    const events = [
      makeMockUpcomingEvent({ id: "ev-1", title: "First Event" }),
      makeMockUpcomingEvent({ id: "ev-2", title: "Second Event" }),
    ];

    render(<ComingUp events={events} />);

    expect(screen.getByText("First Event")).toBeInTheDocument();
    expect(screen.getByText("Second Event")).toBeInTheDocument();
  });

  it("shows empty state when events array is empty", () => {
    render(<ComingUp events={[]} />);

    expect(screen.getByText(/No upcoming events/)).toBeInTheDocument();
  });
});
