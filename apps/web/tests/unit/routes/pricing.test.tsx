import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { makeMockPlan } from "../../helpers/subscription-fixtures.js";
import { createRouterMock } from "../../helpers/router-mock.js";
import { extractRouteComponent } from "../../helpers/route-test-utils.js";

// ── Hoisted Mocks ──

const {
  mockNavigate,
  mockUseLoaderData,
  mockUsePlatformAuth,
  mockHandleCheckout,
  mockIsFeatureEnabled,
} = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
  mockUseLoaderData: vi.fn(),
  mockUsePlatformAuth: vi.fn(),
  mockHandleCheckout: vi.fn(),
  mockIsFeatureEnabled: vi.fn(),
}));

vi.mock("@tanstack/react-router", () =>
  createRouterMock({
    useLoaderData: mockUseLoaderData,
    useNavigate: () => mockNavigate,
  }),
);

vi.mock("../../../src/lib/api-server.js", () => ({
  fetchApiServer: vi.fn(),
}));

vi.mock("../../../src/hooks/use-platform-auth.js", () => ({
  usePlatformAuth: mockUsePlatformAuth,
}));

vi.mock("../../../src/hooks/use-checkout.js", () => ({
  useCheckout: (options?: { onError?: (message: string) => void }) => ({
    checkoutLoading: false,
    handleCheckout: (planId: string) => mockHandleCheckout(planId, options?.onError),
  }),
}));

vi.mock("../../../src/lib/config.js", () => ({
  DEMO_MODE: false,
  features: {},
  isFeatureEnabled: mockIsFeatureEnabled,
}));

// ── Component Under Test ──

const PricingPage = extractRouteComponent(() => import("../../../src/routes/pricing.js"));

// ── Test Lifecycle ──

beforeEach(() => {
  mockIsFeatureEnabled.mockReturnValue(true);
  mockUsePlatformAuth.mockReturnValue({ isAuthenticated: false, isSubscribed: false });
  mockUseLoaderData.mockReturnValue([
    makeMockPlan({ id: "plan-monthly", name: "Monthly", price: 999, interval: "month" }),
    makeMockPlan({ id: "plan-yearly", name: "Yearly", price: 9999, interval: "year" }),
  ]);
  mockHandleCheckout.mockResolvedValue(undefined);
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

  it("subscribe button calls handleCheckout for authenticated users", async () => {
    const user = userEvent.setup();
    mockUsePlatformAuth.mockReturnValue({ isAuthenticated: true, isSubscribed: false });

    render(<PricingPage />);

    const subscribeButtons = screen.getAllByRole("button", { name: /subscribe/i });
    await user.click(subscribeButtons[0]!);

    await waitFor(() => {
      expect(mockHandleCheckout).toHaveBeenCalledWith("plan-monthly", expect.any(Function));
    });
  });

  it("subscribe button navigates to /login for unauthenticated users", async () => {
    const user = userEvent.setup();
    mockUsePlatformAuth.mockReturnValue({ isAuthenticated: false, isSubscribed: false });

    render(<PricingPage />);

    const subscribeButtons = screen.getAllByRole("button", { name: /subscribe/i });
    await user.click(subscribeButtons[0]!);

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith({ to: "/login" });
    });
  });

  it("shows 'You're subscribed!' banner for subscribed users", () => {
    mockUsePlatformAuth.mockReturnValue({ isAuthenticated: true, isSubscribed: true });

    render(<PricingPage />);

    expect(screen.getByText("You're subscribed!")).toBeInTheDocument();
  });

  it("'Manage subscriptions' link points to /settings/subscriptions", () => {
    mockUsePlatformAuth.mockReturnValue({ isAuthenticated: true, isSubscribed: true });

    render(<PricingPage />);

    const link = screen.getByText("Manage subscriptions");
    expect(link).toHaveAttribute("href", "/settings/subscriptions");
  });

  it("shows creator note footer text", () => {
    render(<PricingPage />);

    expect(
      screen.getByText(/Want to support a specific creator/),
    ).toBeInTheDocument();
  });

  it("does not show subscribed banner when user has no active platform subscription", () => {
    mockUsePlatformAuth.mockReturnValue({ isAuthenticated: true, isSubscribed: false });

    render(<PricingPage />);

    expect(screen.getByText("Monthly")).toBeInTheDocument();
    expect(screen.queryByText("You're subscribed!")).toBeNull();
  });

  it("passes onError callback that sets error state", async () => {
    const user = userEvent.setup();
    mockUsePlatformAuth.mockReturnValue({ isAuthenticated: true, isSubscribed: false });
    mockHandleCheckout.mockImplementation(
      (_planId: string, onError?: (message: string) => void) => {
        onError?.("Checkout failed");
        return Promise.resolve();
      },
    );

    render(<PricingPage />);

    const subscribeButtons = screen.getAllByRole("button", { name: /subscribe/i });
    await user.click(subscribeButtons[0]!);

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Checkout failed");
    });
  });

  it("renders Coming Soon when subscription feature is disabled", () => {
    mockIsFeatureEnabled.mockImplementation((flag: string) => flag !== "subscription");

    render(<PricingPage />);

    expect(
      screen.getByRole("heading", { level: 1, name: "Subscriptions — Coming Soon" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to Home" })).toHaveAttribute("href", "/");
  });
});
