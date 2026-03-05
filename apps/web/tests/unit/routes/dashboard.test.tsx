import {
  describe,
  it,
  expect,
  vi,
  beforeAll,
  beforeEach,
  afterEach,
} from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type React from "react";

import {
  makeMockRevenueResponse,
  makeMockSubscriberSummary,
  makeMockBookingSummary,
  makeMockPendingBookingItem,
} from "../../helpers/dashboard-fixtures.js";
import { makeMockBookingWithService } from "../../helpers/booking-fixtures.js";

// ── Helpers ──

function makePendingBookingsResponse(
  items: ReturnType<typeof makeMockPendingBookingItem>[],
  nextCursor: string | null = null,
): Response {
  return new Response(
    JSON.stringify({ items, nextCursor }),
    { status: 200 },
  );
}

// ── Hoisted Mocks ──

const {
  mockFetchRevenue,
  mockFetchSubscribers,
  mockFetchBookingSummary,
  mockReviewBooking,
  mockFetchEmissionsSummary,
} = vi.hoisted(() => ({
  mockFetchRevenue: vi.fn(),
  mockFetchSubscribers: vi.fn(),
  mockFetchBookingSummary: vi.fn(),
  mockReviewBooking: vi.fn(),
  mockFetchEmissionsSummary: vi.fn(),
}));

vi.mock("@tanstack/react-router", async () => {
  const React = await import("react");
  return {
    createFileRoute: () => (options: Record<string, unknown>) => ({
      ...options,
    }),
    redirect: vi.fn(),
    Link: ({
      to,
      children,
      className,
    }: Record<string, unknown>) =>
      React.createElement(
        "a",
        { href: to as string, className },
        children as React.ReactNode,
      ),
  };
});

vi.mock("../../../src/lib/auth.js", () => ({
  fetchAuthState: vi.fn().mockResolvedValue({
    user: { id: "u1" },
    roles: ["cooperative-member"],
  }),
}));

vi.mock("../../../src/lib/dashboard.js", () => ({
  fetchRevenue: mockFetchRevenue,
  fetchSubscribers: mockFetchSubscribers,
  fetchBookingSummary: mockFetchBookingSummary,
  reviewBooking: mockReviewBooking,
}));

vi.mock("../../../src/lib/emissions.js", () => ({
  fetchEmissionsSummary: mockFetchEmissionsSummary,
}));

// ── Component Under Test ──

let DashboardPage: () => React.ReactElement;

beforeAll(async () => {
  const mod = await import("../../../src/routes/dashboard.js");
  DashboardPage = (
    mod.Route as unknown as { component: () => React.ReactElement }
  ).component;
});

// ── Lifecycle ──

beforeEach(() => {
  mockFetchRevenue.mockResolvedValue(makeMockRevenueResponse());
  mockFetchSubscribers.mockResolvedValue(makeMockSubscriberSummary());
  mockFetchBookingSummary.mockResolvedValue(makeMockBookingSummary());
  mockReviewBooking.mockResolvedValue(makeMockBookingWithService());
  mockFetchEmissionsSummary.mockResolvedValue({
    totalCo2Kg: 0.034443,
    entryCount: 1,
    latestDate: "2026-03-31",
  });

  vi.stubGlobal(
    "fetch",
    vi.fn().mockImplementation(() =>
      Promise.resolve(
        makePendingBookingsResponse([makeMockPendingBookingItem()]),
      ),
    ),
  );
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

// ── Tests ──

describe("DashboardPage", () => {
  it("renders page heading 'Dashboard'", () => {
    render(<DashboardPage />);
    expect(
      screen.getByRole("heading", { name: "Dashboard" }),
    ).toBeInTheDocument();
  });

  it("renders four KPI cards with loading state initially", () => {
    mockFetchRevenue.mockReturnValue(new Promise(() => {}));
    mockFetchEmissionsSummary.mockReturnValue(new Promise(() => {}));
    vi.stubGlobal("fetch", vi.fn().mockReturnValue(new Promise(() => {})));
    render(<DashboardPage />);
    expect(screen.getAllByLabelText("Loading")).toHaveLength(4);
  });

  it("renders KPI cards with fetched data after load", async () => {
    render(<DashboardPage />);
    // $50.00 appears in both the KPI card value and the revenue chart tooltip
    await waitFor(() => {
      expect(screen.getAllByText("$50.00").length).toBeGreaterThanOrEqual(1);
    });
    expect(screen.getByText("42")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("renders revenue KPI with 'from subscriptions' sublabel", async () => {
    render(<DashboardPage />);
    await waitFor(() => {
      expect(screen.getByText("from subscriptions")).toBeInTheDocument();
    });
  });

  it("renders section headings for Revenue and Bookings", () => {
    render(<DashboardPage />);
    expect(
      screen.getByRole("heading", { name: "Revenue Over Time" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Pending Booking Requests" }),
    ).toBeInTheDocument();
  });

  it("renders revenue chart with 12 bars when data is loaded", async () => {
    render(<DashboardPage />);
    await waitFor(() => {
      expect(screen.getAllByRole("img")).toHaveLength(12);
    });
  });

  it("renders pending bookings table with booking data", async () => {
    render(<DashboardPage />);
    // Table renders both a desktop <table> row and mobile card, so text appears twice
    await waitFor(() => {
      expect(screen.getAllByText("Jane Doe").length).toBeGreaterThanOrEqual(1);
    });
    expect(screen.getAllByText("Recording Session").length).toBeGreaterThanOrEqual(1);
  });

  it("shows loading state for bookings when initially loading", () => {
    mockFetchRevenue.mockReturnValue(new Promise(() => {}));
    vi.stubGlobal("fetch", vi.fn().mockReturnValue(new Promise(() => {})));
    render(<DashboardPage />);
    expect(
      screen.getByText("Loading booking requests..."),
    ).toBeInTheDocument();
  });

  it("shows 'Load more' button when nextCursor is present", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(() =>
        Promise.resolve(
          makePendingBookingsResponse([makeMockPendingBookingItem()], "cursor-abc"),
        ),
      ),
    );
    render(<DashboardPage />);
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Load more" }),
      ).toBeInTheDocument();
    });
  });

  it("hides 'Load more' button when nextCursor is null", async () => {
    render(<DashboardPage />);
    await waitFor(() => {
      expect(screen.getAllByText("Jane Doe").length).toBeGreaterThanOrEqual(1);
    });
    expect(
      screen.queryByRole("button", { name: "Load more" }),
    ).not.toBeInTheDocument();
  });

  it("approve action calls reviewBooking and removes booking from list", async () => {
    const user = userEvent.setup();
    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getAllByText("Jane Doe").length).toBeGreaterThanOrEqual(1);
    });

    // Table renders two Approve buttons (desktop + mobile); click the first
    await user.click(screen.getAllByRole("button", { name: "Approve" })[0]!);

    await waitFor(() => {
      expect(mockReviewBooking).toHaveBeenCalledWith("bk_pending_001", {
        status: "approved",
      });
    });

    await waitFor(() => {
      expect(screen.queryByText("Jane Doe")).not.toBeInTheDocument();
    });
  });

  it("approve action decrements pending bookings KPI count", async () => {
    const user = userEvent.setup();
    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText("3")).toBeInTheDocument();
    });

    // Table renders two Approve buttons (desktop + mobile); click the first
    await user.click(screen.getAllByRole("button", { name: "Approve" })[0]!);

    await waitFor(() => {
      expect(screen.getByText("2")).toBeInTheDocument();
    });
  });

  it("deny action shows note input then calls reviewBooking", async () => {
    const user = userEvent.setup();
    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getAllByText("Jane Doe").length).toBeGreaterThanOrEqual(1);
    });

    // Table renders two Deny buttons (desktop + mobile); click the first
    await user.click(screen.getAllByRole("button", { name: "Deny" })[0]!);

    await waitFor(() => {
      expect(screen.getAllByLabelText("Review note").length).toBeGreaterThanOrEqual(1);
    });

    // Table renders two deny inputs (desktop + mobile); type in the first
    await user.type(screen.getAllByLabelText("Review note")[0]!, "Not available");
    await user.click(screen.getAllByRole("button", { name: "Confirm" })[0]!);

    await waitFor(() => {
      expect(mockReviewBooking).toHaveBeenCalledWith("bk_pending_001", {
        status: "denied",
        reviewNote: "Not available",
      });
    });
  });

  it("shows error when KPI fetch fails", async () => {
    mockFetchRevenue.mockRejectedValue(new Error("Stripe unavailable"));
    render(<DashboardPage />);
    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Stripe unavailable");
    });
  });

  it("shows error when review fails", async () => {
    const user = userEvent.setup();
    mockReviewBooking.mockRejectedValue(new Error("Already reviewed"));

    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getAllByText("Jane Doe").length).toBeGreaterThanOrEqual(1);
    });

    // Table renders two Approve buttons (desktop + mobile); click the first
    await user.click(screen.getAllByRole("button", { name: "Approve" })[0]!);

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Already reviewed");
    });
  });

  it("shows error when bookings fetch fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("Network error")),
    );
    render(<DashboardPage />);
    await waitFor(() => {
      const alerts = screen.getAllByRole("alert");
      const hasNetworkError = alerts.some((el) =>
        el.textContent?.includes("Network error"),
      );
      expect(hasNetworkError).toBe(true);
    });
  });

  it("shows empty bookings table when no pending bookings exist", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(() =>
        Promise.resolve(makePendingBookingsResponse([])),
      ),
    );
    render(<DashboardPage />);
    await waitFor(() => {
      expect(
        screen.getByText("No pending booking requests"),
      ).toBeInTheDocument();
    });
  });
});
