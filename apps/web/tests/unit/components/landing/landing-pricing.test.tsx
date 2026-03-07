import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import {
  makeMockSessionResult,
  makeLoggedInSessionResult,
} from "../../../helpers/auth-fixtures.js";
import { makeMockPlan, makeMockUserSubscription } from "../../../helpers/subscription-fixtures.js";
import { createRouterMock } from "../../../helpers/router-mock.js";
import { createAuthMock } from "../../../helpers/auth-mock.js";

// ── Hoisted Mocks ──

const {
  mockUseSession,
  mockNavigate,
  mockCreateCheckout,
  mockFetchMySubscriptions,
  mockNavigateExternal,
} = vi.hoisted(() => ({
  mockUseSession: vi.fn(),
  mockNavigate: vi.fn(),
  mockCreateCheckout: vi.fn(),
  mockFetchMySubscriptions: vi.fn(),
  mockNavigateExternal: vi.fn(),
}));

vi.mock("@tanstack/react-router", () =>
  createRouterMock({ useNavigate: () => mockNavigate }),
);

vi.mock("../../../../src/lib/auth.js", () =>
  createAuthMock({ useSession: mockUseSession }),
);

vi.mock("../../../../src/lib/subscription.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../../src/lib/subscription.js")>();
  return {
    ...actual,
    createCheckout: mockCreateCheckout,
    fetchMySubscriptions: mockFetchMySubscriptions,
  };
});

vi.mock("../../../../src/lib/url.js", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return { ...actual, navigateExternal: mockNavigateExternal };
});

vi.mock("../../../../src/components/subscription/plan-card.js", async () => {
  const React = await import("react");
  return {
    PlanCard: ({
      plan,
      onSubscribe,
    }: {
      plan: { id: string; name: string };
      onSubscribe: (id: string) => void;
    }) =>
      React.createElement(
        "div",
        { "data-testid": `plan-card-${plan.id}` },
        React.createElement("span", null, plan.name),
        React.createElement(
          "button",
          { onClick: () => onSubscribe(plan.id) },
          "Subscribe",
        ),
      ),
  };
});

// ── Import component under test (after mocks) ──

import { LandingPricing } from "../../../../src/components/landing/landing-pricing.js";

// ── Shared fixtures ──

const DEFAULT_PLANS = [makeMockPlan({ id: "plan-platform-monthly" })];

// ── Test Lifecycle ──

beforeEach(() => {
  mockUseSession.mockReturnValue(makeMockSessionResult());
  mockFetchMySubscriptions.mockResolvedValue([]);
  mockCreateCheckout.mockResolvedValue("https://checkout.stripe.com/test");
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ── Tests ──

describe("LandingPricing", () => {
  describe("success state", () => {
    it("renders section heading 'Get Access to Everything'", () => {
      render(<LandingPricing plans={DEFAULT_PLANS} />);

      expect(
        screen.getByRole("heading", { level: 2, name: "Get Access to Everything" }),
      ).toBeInTheDocument();
    });

    it("renders subheading text", () => {
      render(<LandingPricing plans={DEFAULT_PLANS} />);

      expect(
        screen.getByText(/Subscribe to the platform and access all content/),
      ).toBeInTheDocument();
    });

    it("renders PlanCard for each platform plan", () => {
      const plans = [
        makeMockPlan({ id: "plan-platform-monthly", name: "S/NC All Access" }),
      ];

      render(<LandingPricing plans={plans} />);

      expect(screen.getByTestId("plan-card-plan-platform-monthly")).toBeInTheDocument();
      expect(screen.getByText("S/NC All Access")).toBeInTheDocument();
    });

    it("renders 'Learn more about pricing' link with href to /pricing", () => {
      render(<LandingPricing plans={DEFAULT_PLANS} />);

      const link = screen.getByRole("link", { name: /learn more about pricing/i });
      expect(link).toBeInTheDocument();
      expect(link).toHaveAttribute("href", "/pricing");
    });
  });

  describe("subscribed state", () => {
    it("shows 'You're subscribed!' message when user has active platform subscription", async () => {
      mockUseSession.mockReturnValue(makeLoggedInSessionResult());
      mockFetchMySubscriptions.mockResolvedValue([
        makeMockUserSubscription({ status: "active" }),
      ]);

      render(<LandingPricing plans={DEFAULT_PLANS} />);

      await waitFor(() => {
        expect(screen.getByText("You're subscribed!")).toBeInTheDocument();
      });
    });

    it("shows link to /feed in subscribed state", async () => {
      mockUseSession.mockReturnValue(makeLoggedInSessionResult());
      mockFetchMySubscriptions.mockResolvedValue([
        makeMockUserSubscription({ status: "active" }),
      ]);

      render(<LandingPricing plans={DEFAULT_PLANS} />);

      await waitFor(() => {
        const link = screen.getByRole("link", { name: "Explore content" });
        expect(link).toBeInTheDocument();
        expect(link).toHaveAttribute("href", "/feed");
      });
    });

    it("fetches subscriptions when session data exists", async () => {
      mockUseSession.mockReturnValue(makeLoggedInSessionResult());

      render(<LandingPricing plans={DEFAULT_PLANS} />);

      await waitFor(() => {
        expect(mockFetchMySubscriptions).toHaveBeenCalled();
      });
    });
  });

  describe("subscribe flow", () => {
    it("calls handleSubscribe → navigate to /login when unauthenticated", async () => {
      const user = userEvent.setup();
      mockUseSession.mockReturnValue(makeMockSessionResult());

      render(<LandingPricing plans={DEFAULT_PLANS} />);

      await waitFor(() => {
        expect(screen.getByRole("button", { name: "Subscribe" })).toBeInTheDocument();
      });

      await user.click(screen.getByRole("button", { name: "Subscribe" }));

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith({ to: "/login" });
      });
    });

    it("calls createCheckout with plan ID when authenticated", async () => {
      const user = userEvent.setup();
      mockUseSession.mockReturnValue(makeLoggedInSessionResult());
      mockFetchMySubscriptions.mockResolvedValue([]);

      render(<LandingPricing plans={DEFAULT_PLANS} />);

      await waitFor(() => {
        expect(screen.getByRole("button", { name: "Subscribe" })).toBeInTheDocument();
      });

      await user.click(screen.getByRole("button", { name: "Subscribe" }));

      await waitFor(() => {
        expect(mockCreateCheckout).toHaveBeenCalledWith("plan-platform-monthly");
      });
    });
  });

  describe("empty state", () => {
    it("shows empty message when no plans available (empty array)", () => {
      render(<LandingPricing plans={[]} />);

      expect(screen.getByText(/Plans coming soon/)).toBeInTheDocument();
    });
  });
});
