import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { makeMockPlan } from "../../helpers/subscription-fixtures.js";
import {
  makeLoggedInSessionResult,
  makeMockSessionResult,
} from "../../helpers/auth-fixtures.js";

// ── Hoisted Mocks ──

const { mockFetchPlans, mockCreateCheckout, mockUseSession, mockNavigateExternal } = vi.hoisted(
  () => ({
    mockFetchPlans: vi.fn(),
    mockCreateCheckout: vi.fn(),
    mockUseSession: vi.fn(),
    mockNavigateExternal: vi.fn(),
  }),
);

vi.mock("../../../src/lib/subscription.js", () => ({
  fetchPlans: mockFetchPlans,
  createCheckout: mockCreateCheckout,
}));

vi.mock("../../../src/lib/auth.js", () => ({
  useSession: mockUseSession,
}));

vi.mock("../../../src/lib/url.js", () => ({
  navigateExternal: mockNavigateExternal,
}));

vi.mock("@tanstack/react-router", async () => {
  const React = await import("react");
  return {
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

// ── Component Under Test ──

import { SubscribeCta } from "../../../src/components/content/subscribe-cta.js";

// ── Lifecycle ──

beforeEach(() => {
  mockUseSession.mockReturnValue(makeLoggedInSessionResult());
  mockFetchPlans.mockResolvedValue([]);
  mockCreateCheckout.mockResolvedValue("https://checkout.stripe.com/test");
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ── Tests ──

describe("SubscribeCta", () => {
  it('renders "Subscribe to watch" heading for video content type', async () => {
    mockFetchPlans.mockResolvedValue([makeMockPlan()]);
    render(<SubscribeCta creatorId="c1" contentType="video" />);
    await waitFor(() => {
      expect(screen.getByText("Subscribe to watch")).toBeInTheDocument();
    });
  });

  it('renders "Subscribe to listen" heading for audio content type', async () => {
    mockFetchPlans.mockResolvedValue([makeMockPlan()]);
    render(<SubscribeCta creatorId="c1" contentType="audio" />);
    await waitFor(() => {
      expect(screen.getByText("Subscribe to listen")).toBeInTheDocument();
    });
  });

  it('renders "Subscribe to read" heading for written content type', async () => {
    mockFetchPlans.mockResolvedValue([makeMockPlan()]);
    render(<SubscribeCta creatorId="c1" contentType="written" />);
    await waitFor(() => {
      expect(screen.getByText("Subscribe to read")).toBeInTheDocument();
    });
  });

  it("shows plan price and Subscribe button when plans exist", async () => {
    mockFetchPlans.mockResolvedValue([makeMockPlan({ price: 999, interval: "month" })]);
    render(<SubscribeCta creatorId="c1" contentType="video" />);
    await waitFor(() => {
      expect(screen.getByText("$9.99")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /subscribe/i })).toBeInTheDocument();
    });
  });

  it("Subscribe button calls createCheckout with plan ID", async () => {
    const user = userEvent.setup();
    const plan = makeMockPlan({ id: "plan-42" });
    mockFetchPlans.mockResolvedValue([plan]);

    render(<SubscribeCta creatorId="c1" contentType="video" />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /^subscribe$/i })).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /^subscribe$/i }));
    expect(mockCreateCheckout).toHaveBeenCalledWith("plan-42");
  });

  it("shows link to /pricing page", async () => {
    mockFetchPlans.mockResolvedValue([makeMockPlan()]);
    render(<SubscribeCta creatorId="c1" contentType="video" />);
    await waitFor(() => {
      expect(screen.getByRole("link", { name: /subscribe to the platform/i })).toHaveAttribute(
        "href",
        "/pricing",
      );
    });
  });

  it("unauthenticated user sees Subscribe link pointing to /login", async () => {
    mockUseSession.mockReturnValue(makeMockSessionResult({ data: null }));
    mockFetchPlans.mockResolvedValue([makeMockPlan()]);

    render(<SubscribeCta creatorId="c1" contentType="video" />);

    await waitFor(() => {
      const subscribeLink = screen.getByRole("link", { name: /^subscribe$/i });
      expect(subscribeLink).toHaveAttribute("href", "/login");
    });
  });

  it("shows only pricing link when creator has no plans", async () => {
    mockFetchPlans.mockResolvedValue([]);
    render(<SubscribeCta creatorId="c1" contentType="video" />);
    await waitFor(() => {
      expect(screen.queryByText("$")).toBeNull();
      expect(screen.getByRole("link", { name: /subscribe to the platform/i })).toHaveAttribute(
        "href",
        "/pricing",
      );
    });
  });

  it("shows pricing link fallback when fetch fails", async () => {
    mockFetchPlans.mockRejectedValue(new Error("Network error"));
    render(<SubscribeCta creatorId="c1" contentType="video" />);
    await waitFor(() => {
      expect(screen.getByText(/unable to load plans/i)).toBeInTheDocument();
    });
  });
});
