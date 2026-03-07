import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";

import { makeMockBookingWithService } from "../../helpers/booking-fixtures.js";

// ── Hoisted Mocks ──

import { createFormatMock } from "../../helpers/format-mock.js";

const { mockFormatRelativeDate } = vi.hoisted(() => ({
  mockFormatRelativeDate: vi.fn(),
}));

vi.mock("../../../src/lib/format.js", async (importOriginal) => {
  const actual = await importOriginal<
    typeof import("../../../src/lib/format.js")
  >();
  return createFormatMock({ formatRelativeDate: mockFormatRelativeDate }, actual);
});

// ── Component Import ──

import { BookingList } from "../../../src/components/booking/booking-list.js";

// ── Lifecycle ──

beforeEach(() => {
  mockFormatRelativeDate.mockReturnValue("2d ago");
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ── Tests ──

describe("BookingList", () => {
  it("renders empty state message when no bookings", () => {
    render(<BookingList bookings={[]} />);
    expect(
      screen.getByText("You haven't submitted any booking requests yet."),
    ).toBeInTheDocument();
  });

  it("renders booking service name", () => {
    const booking = makeMockBookingWithService({
      service: {
        ...makeMockBookingWithService().service,
        name: "Mixing Session",
      },
    });
    render(<BookingList bookings={[booking]} />);
    expect(screen.getByText("Mixing Session")).toBeInTheDocument();
  });

  it("renders preferred dates joined with commas", () => {
    const booking = makeMockBookingWithService({
      preferredDates: ["March 15-17, 2026", "March 20, 2026"],
    });
    render(<BookingList bookings={[booking]} />);
    expect(
      screen.getByText("March 15-17, 2026, March 20, 2026"),
    ).toBeInTheDocument();
  });

  it("renders status badge with 'pending' text", () => {
    const booking = makeMockBookingWithService({ status: "pending" });
    render(<BookingList bookings={[booking]} />);
    expect(screen.getByText("pending")).toBeInTheDocument();
  });

  it("renders status badge with 'approved' text", () => {
    const booking = makeMockBookingWithService({ status: "approved" });
    render(<BookingList bookings={[booking]} />);
    expect(screen.getByText("approved")).toBeInTheDocument();
  });

  it("renders status badge with 'denied' text", () => {
    const booking = makeMockBookingWithService({ status: "denied" });
    render(<BookingList bookings={[booking]} />);
    expect(screen.getByText("denied")).toBeInTheDocument();
  });

  it("renders submission date via formatRelativeDate", () => {
    const booking = makeMockBookingWithService({
      createdAt: "2026-02-25T10:00:00.000Z",
    });
    render(<BookingList bookings={[booking]} />);
    expect(mockFormatRelativeDate).toHaveBeenCalledWith(
      "2026-02-25T10:00:00.000Z",
    );
    expect(screen.getByText("Submitted 2d ago")).toBeInTheDocument();
  });

  it("renders notes when non-empty", () => {
    const booking = makeMockBookingWithService({ notes: "Afternoon preferred" });
    render(<BookingList bookings={[booking]} />);
    expect(screen.getByText("Afternoon preferred")).toBeInTheDocument();
  });

  it("hides notes when empty", () => {
    const booking = makeMockBookingWithService({ notes: "" });
    render(<BookingList bookings={[booking]} />);
    expect(screen.queryByText("Afternoon preferred")).not.toBeInTheDocument();
  });

  it("renders multiple bookings", () => {
    const bookings = [
      makeMockBookingWithService({
        id: "bk-1",
        service: {
          ...makeMockBookingWithService().service,
          name: "Recording Session",
        },
      }),
      makeMockBookingWithService({
        id: "bk-2",
        service: {
          ...makeMockBookingWithService().service,
          name: "Mastering Session",
        },
      }),
    ];
    render(<BookingList bookings={bookings} />);
    expect(screen.getByText("Recording Session")).toBeInTheDocument();
    expect(screen.getByText("Mastering Session")).toBeInTheDocument();
  });
});
