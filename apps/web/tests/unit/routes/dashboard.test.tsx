import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
} from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  makeMockRevenueResponse,
  makeMockSubscriberSummary,
  makeMockBookingSummary,
  makeMockPendingBookingItem,
} from "../../helpers/dashboard-fixtures.js";
import { makeMockBookingWithService } from "../../helpers/booking-fixtures.js";
import { createRouterMock } from "../../helpers/router-mock.js";
import { extractRoute } from "../../helpers/route-test-utils.js";

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

function makeDefaultLoaderData() {
  return {
    revenue: makeMockRevenueResponse(),
    subscribers: makeMockSubscriberSummary(),
    bookingSummary: makeMockBookingSummary(),
    emissionsSummary: {
      grossCo2Kg: 0.034443,
      offsetCo2Kg: 0,
      netCo2Kg: 0.034443,
      entryCount: 1,
      latestDate: "2026-03-31",
      projectedGrossCo2Kg: 0.034443,
      doubleOffsetTargetCo2Kg: 0.068886,
      additionalOffsetCo2Kg: 0.068886,
    },
  };
}

// ── Hoisted Mocks ──

const {
  mockReviewBooking,
  mockFetchAuthStateServer,
  mockRedirect,
  mockUseLoaderData,
} = vi.hoisted(() => ({
  mockReviewBooking: vi.fn(),
  mockFetchAuthStateServer: vi.fn(),
  mockRedirect: vi.fn((args: unknown) => args),
  mockUseLoaderData: vi.fn(),
}));

vi.mock("@tanstack/react-router", () =>
  createRouterMock({ redirect: mockRedirect, useLoaderData: mockUseLoaderData }),
);

vi.mock("../../../src/lib/api-server.js", () => ({
  fetchApiServer: vi.fn(),
  fetchAuthStateServer: mockFetchAuthStateServer,
}));

vi.mock("../../../src/lib/dashboard.js", () => ({
  reviewBooking: mockReviewBooking,
}));

// ── Component Under Test ──

const { component: DashboardPage, route: routeObject } = extractRoute(() => import("../../../src/routes/dashboard.js"));
const routeBeforeLoad = () => (routeObject.beforeLoad as () => Promise<void>)();

// ── Lifecycle ──

beforeEach(() => {
  mockFetchAuthStateServer.mockResolvedValue({
    user: { id: "u1" },
    roles: ["stakeholder"],
  });
  mockReviewBooking.mockResolvedValue(makeMockBookingWithService());
  mockUseLoaderData.mockReturnValue(makeDefaultLoaderData());

  vi.stubGlobal(
    "fetch",
    vi.fn().mockImplementation(() =>
      Promise.resolve(
        makePendingBookingsResponse([makeMockPendingBookingItem()]),
      ),
    ),
  );
});

// ── Tests ──

describe("DashboardPage", () => {
  // ── beforeLoad guard tests ──

  describe("beforeLoad", () => {
    it("redirects to /login when user is not authenticated", async () => {
      mockFetchAuthStateServer.mockResolvedValue({ user: null, roles: [] });
      await expect(routeBeforeLoad()).rejects.toEqual({ to: "/login" });
    });

    it("redirects to /feed when user lacks stakeholder role", async () => {
      mockFetchAuthStateServer.mockResolvedValue({
        user: { id: "u1" },
        roles: [],
      });
      await expect(routeBeforeLoad()).rejects.toEqual({ to: "/feed" });
    });
  });

  // ── Rendering tests ──

  it("renders page heading 'Dashboard'", () => {
    render(<DashboardPage />);
    expect(
      screen.getByRole("heading", { name: "Dashboard" }),
    ).toBeInTheDocument();
  });

  it("renders KPI cards with loader data", () => {
    render(<DashboardPage />);
    // $50.00 appears in both the KPI card value and the revenue chart tooltip
    expect(screen.getAllByText("$50.00").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("42")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("renders revenue KPI with 'from subscriptions' sublabel", () => {
    render(<DashboardPage />);
    expect(screen.getByText("from subscriptions")).toBeInTheDocument();
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

  it("renders revenue chart with 12 bars from loader data", () => {
    render(<DashboardPage />);
    expect(screen.getAllByRole("img")).toHaveLength(12);
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
