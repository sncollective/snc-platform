import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { makeMockPlan, makeMockUserSubscription } from "../../helpers/subscription-fixtures.js";
import { createRouterMock } from "../../helpers/router-mock.js";
import { createAuthMock } from "../../helpers/auth-mock.js";
import { extractRouteComponent } from "../../helpers/route-test-utils.js";

// ── Hoisted Mocks ──

const {
  mockUseSession,
  mockNavigate,
  mockUseLoaderData,
  mockCreateCheckout,
  mockFetchMySubscriptions,
} = vi.hoisted(() => ({
  mockUseSession: vi.fn(),
  mockNavigate: vi.fn(),
  mockUseLoaderData: vi.fn(),
  mockCreateCheckout: vi.fn(),
  mockFetchMySubscriptions: vi.fn(),
}));

vi.mock("@tanstack/react-router", () =>
  createRouterMock({
    useLoaderData: mockUseLoaderData,
    useNavigate: () => mockNavigate,
  }),
);

vi.mock("../../../src/lib/auth.js", () =>
  createAuthMock({ useSession: mockUseSession }),
);

vi.mock("../../../src/lib/api-server.js", () => ({
  fetchApiServer: vi.fn(),
}));

vi.mock("../../../src/lib/subscription.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../src/lib/subscription.js")>();
  return {
    ...actual,
    createCheckout: mockCreateCheckout,
    fetchMySubscriptions: mockFetchMySubscriptions,
  };
});

// ── Component Under Test ──

const PricingPage = extractRouteComponent(() => import("../../../src/routes/pricing.js"));

// ── Test Lifecycle ──

beforeEach(() => {
  mockUseSession.mockReturnValue({ data: null, isPending: false, error: null });
  mockUseLoaderData.mockReturnValue([
    makeMockPlan({ id: "plan-monthly", name: "Monthly", price: 999, interval: "month" }),
    makeMockPlan({ id: "plan-yearly", name: "Yearly", price: 9999, interval: "year" }),
  ]);
  mockFetchMySubscriptions.mockResolvedValue([]);
  mockCreateCheckout.mockResolvedValue("https://checkout.stripe.com/test");
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ── Tests ──

describe("PricingPage", () => {
  it("renders plan cards from loader data", () => {
    render(<PricingPage />);

    expect(screen.getByText("Monthly")).toBeInTheDocument();
    expect(screen.getByText("Yearly")).toBeInTheDocument();
  });

  it("shows empty state when loader returns no plans", () => {
    mockUseLoaderData.mockReturnValue([]);

    render(<PricingPage />);

    expect(screen.getByText("No plans available.")).toBeInTheDocument();
  });

  it("subscribe button calls createCheckout for authenticated users", async () => {
    const user = userEvent.setup();
    mockUseSession.mockReturnValue({
      data: { user: { id: "user-1" } },
      isPending: false,
      error: null,
    });
    vi.stubGlobal("location", { ...window.location, set href(_: string) {} });

    render(<PricingPage />);

    const subscribeButtons = screen.getAllByRole("button", { name: /subscribe/i });
    await user.click(subscribeButtons[0]!);

    await waitFor(() => {
      expect(mockCreateCheckout).toHaveBeenCalledWith("plan-monthly");
    });
  });

  it("subscribe button navigates to /login for unauthenticated users", async () => {
    const user = userEvent.setup();
    mockUseSession.mockReturnValue({ data: null, isPending: false, error: null });

    render(<PricingPage />);

    const subscribeButtons = screen.getAllByRole("button", { name: /subscribe/i });
    await user.click(subscribeButtons[0]!);

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith({ to: "/login" });
    });
  });

  it("shows 'You're subscribed!' banner for subscribed users", async () => {
    mockUseSession.mockReturnValue({
      data: { user: { id: "user-1" } },
      isPending: false,
      error: null,
    });
    mockFetchMySubscriptions.mockResolvedValue([
      makeMockUserSubscription({ status: "active" }),
    ]);

    render(<PricingPage />);

    await waitFor(() => {
      expect(screen.getByText("You're subscribed!")).toBeInTheDocument();
    });
  });

  it("'Manage subscriptions' link points to /settings/subscriptions", async () => {
    mockUseSession.mockReturnValue({
      data: { user: { id: "user-1" } },
      isPending: false,
      error: null,
    });
    mockFetchMySubscriptions.mockResolvedValue([
      makeMockUserSubscription({ status: "active" }),
    ]);

    render(<PricingPage />);

    await waitFor(() => {
      const link = screen.getByText("Manage subscriptions");
      expect(link).toHaveAttribute("href", "/settings/subscriptions");
    });
  });

  it("shows creator note footer text", () => {
    render(<PricingPage />);

    expect(
      screen.getByText(/Want to support a specific creator/),
    ).toBeInTheDocument();
  });

  it("does not show subscribed banner when user has no active platform subscription", async () => {
    mockUseSession.mockReturnValue({
      data: { user: { id: "user-1" } },
      isPending: false,
      error: null,
    });
    mockFetchMySubscriptions.mockResolvedValue([]);

    render(<PricingPage />);

    expect(screen.getByText("Monthly")).toBeInTheDocument();
    expect(screen.queryByText("You're subscribed!")).toBeNull();
  });
});
