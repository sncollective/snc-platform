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

// ── Import component under test (after mocks) ──

import { HeroSection } from "../../../../src/components/landing/hero-section.js";

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

describe("HeroSection", () => {
  describe("static content", () => {
    it("renders heading text", () => {
      render(<HeroSection plans={DEFAULT_PLANS} />);

      expect(
        screen.getByRole("heading", { level: 1, name: "Signal to Noise Collective" }),
      ).toBeInTheDocument();
    });

    it("renders subheading paragraph", () => {
      render(<HeroSection plans={DEFAULT_PLANS} />);

      expect(
        screen.getByText(/We cut through the noise/),
      ).toBeInTheDocument();
    });

    it("renders 'Browse Free Content' link with href to /feed", () => {
      render(<HeroSection plans={DEFAULT_PLANS} />);

      const link = screen.getByRole("link", { name: "Browse Free Content" });
      expect(link).toBeInTheDocument();
      expect(link).toHaveAttribute("href", "/feed");
    });
  });

  describe("unauthenticated visitor", () => {
    it("renders 'Subscribe' button", () => {
      mockUseSession.mockReturnValue(makeMockSessionResult());

      render(<HeroSection plans={DEFAULT_PLANS} />);

      expect(screen.getByRole("button", { name: "Subscribe" })).toBeInTheDocument();
    });

    it("navigates to /login on Subscribe click", async () => {
      const user = userEvent.setup();
      mockUseSession.mockReturnValue(makeMockSessionResult());

      render(<HeroSection plans={DEFAULT_PLANS} />);

      await user.click(screen.getByRole("button", { name: "Subscribe" }));

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith({ to: "/login" });
      });
    });
  });

  describe("authenticated but unsubscribed user", () => {
    it("renders 'Subscribe' button", async () => {
      mockUseSession.mockReturnValue(makeLoggedInSessionResult());
      mockFetchMySubscriptions.mockResolvedValue([]);

      render(<HeroSection plans={DEFAULT_PLANS} />);

      await waitFor(() => {
        expect(screen.getByRole("button", { name: "Subscribe" })).toBeInTheDocument();
      });
    });

    it("calls createCheckout on Subscribe click", async () => {
      const user = userEvent.setup();
      mockUseSession.mockReturnValue(makeLoggedInSessionResult());
      mockFetchMySubscriptions.mockResolvedValue([]);

      render(<HeroSection plans={DEFAULT_PLANS} />);

      await waitFor(() => {
        expect(screen.getByRole("button", { name: "Subscribe" })).toBeInTheDocument();
      });

      await user.click(screen.getByRole("button", { name: "Subscribe" }));

      await waitFor(() => {
        expect(mockCreateCheckout).toHaveBeenCalledWith("plan-platform-monthly");
      });
    });

    it("redirects to Stripe Checkout URL", async () => {
      const user = userEvent.setup();
      mockUseSession.mockReturnValue(makeLoggedInSessionResult());
      mockFetchMySubscriptions.mockResolvedValue([]);

      render(<HeroSection plans={DEFAULT_PLANS} />);

      await waitFor(() => {
        expect(screen.getByRole("button", { name: "Subscribe" })).toBeInTheDocument();
      });

      await user.click(screen.getByRole("button", { name: "Subscribe" }));

      await waitFor(() => {
        expect(mockNavigateExternal).toHaveBeenCalledWith("https://checkout.stripe.com/test");
      });
    });

    it("navigates to /pricing when no plans loaded", async () => {
      const user = userEvent.setup();
      mockUseSession.mockReturnValue(makeLoggedInSessionResult());
      mockFetchMySubscriptions.mockResolvedValue([]);

      render(<HeroSection plans={[]} />);

      await waitFor(() => {
        expect(screen.getByRole("button", { name: "Subscribe" })).toBeInTheDocument();
      });

      await user.click(screen.getByRole("button", { name: "Subscribe" }));

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith({ to: "/pricing" });
      });
    });

    it("navigates to /pricing on checkout failure", async () => {
      const user = userEvent.setup();
      mockUseSession.mockReturnValue(makeLoggedInSessionResult());
      mockFetchMySubscriptions.mockResolvedValue([]);
      mockCreateCheckout.mockRejectedValue(new Error("Checkout failed"));

      render(<HeroSection plans={DEFAULT_PLANS} />);

      await waitFor(() => {
        expect(screen.getByRole("button", { name: "Subscribe" })).toBeInTheDocument();
      });

      await user.click(screen.getByRole("button", { name: "Subscribe" }));

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith({ to: "/pricing" });
      });
    });
  });

  describe("subscribed user", () => {
    it("renders 'Explore Content' link instead of Subscribe button", async () => {
      mockUseSession.mockReturnValue(makeLoggedInSessionResult());
      mockFetchMySubscriptions.mockResolvedValue([
        makeMockUserSubscription({ status: "active" }),
      ]);

      render(<HeroSection plans={DEFAULT_PLANS} />);

      await waitFor(() => {
        const link = screen.getByRole("link", { name: "Explore Content" });
        expect(link).toBeInTheDocument();
        expect(link).toHaveAttribute("href", "/feed");
      });

      expect(screen.queryByRole("button", { name: "Subscribe" })).toBeNull();
    });
  });
});
