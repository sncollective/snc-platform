import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";

import { makeMockUserSubscription } from "../../helpers/subscription-fixtures.js";
import { createRouterMock } from "../../helpers/router-mock.js";
import { extractRouteComponent } from "../../helpers/route-test-utils.js";

// ── Hoisted Mocks ──

const { mockFetchMySubscriptions } = vi.hoisted(() => ({
  mockFetchMySubscriptions: vi.fn(),
}));

vi.mock("@tanstack/react-router", () =>
  createRouterMock({ redirect: vi.fn() }),
);

vi.mock("../../../src/lib/api-server.js", () => ({
  fetchAuthStateServer: vi.fn().mockResolvedValue({ user: { id: "u1" }, roles: [] }),
}));

vi.mock("../../../src/lib/subscription.js", () => ({
  fetchMySubscriptions: mockFetchMySubscriptions,
}));

// ── Component Under Test ──

const CheckoutSuccessPage = extractRouteComponent(() => import("../../../src/routes/checkout/success.js"));

// ── Test Lifecycle ──

beforeEach(() => {
  mockFetchMySubscriptions.mockResolvedValue([
    makeMockUserSubscription({ status: "active" }),
  ]);
});

afterEach(() => {
  vi.useRealTimers();
});

// ── Tests ──

describe("CheckoutSuccessPage", () => {
  it("shows success message when subscription is active", async () => {
    render(<CheckoutSuccessPage />);

    await waitFor(() => {
      expect(screen.getByText("Welcome!")).toBeInTheDocument();
    });

    expect(screen.getByText(/S\/NC All Access/)).toBeInTheDocument();
  });

  it("shows 'Browse Feed' link to /feed", async () => {
    render(<CheckoutSuccessPage />);

    await waitFor(() => {
      expect(screen.getByText("Browse Feed")).toBeInTheDocument();
    });

    expect(screen.getByText("Browse Feed")).toHaveAttribute("href", "/feed");
  });

  it("shows 'Explore Creators' link to /creators", async () => {
    render(<CheckoutSuccessPage />);

    await waitFor(() => {
      expect(screen.getByText("Explore Creators")).toBeInTheDocument();
    });

    expect(screen.getByText("Explore Creators")).toHaveAttribute("href", "/creators");
  });

  it("shows processing state when subscription not yet active", async () => {
    // Mock to never resolve so we can see the initial loading state
    mockFetchMySubscriptions.mockReturnValue(new Promise(() => {}));

    render(<CheckoutSuccessPage />);

    // Component starts with isLoading=true while fetch is pending
    expect(screen.getByText("Processing your payment...")).toBeInTheDocument();
  });

  it("polls for subscription activation and shows success when found", async () => {
    vi.useFakeTimers();
    mockFetchMySubscriptions
      .mockResolvedValueOnce([])
      .mockResolvedValue([makeMockUserSubscription({ status: "active" })]);

    render(<CheckoutSuccessPage />);

    // Let initial poll run — first call returns empty → isLoading stays true
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(screen.getByText("Processing your payment...")).toBeInTheDocument();

    // Advance 2000ms to trigger the next poll
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });

    // Active subscription found during polling → Welcome! shown
    expect(screen.getByText("Welcome!")).toBeInTheDocument();
    // Verify polling happened: mock was called more than once
    expect(mockFetchMySubscriptions.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it("shows fallback message after poll exhaustion", async () => {
    vi.useFakeTimers();
    mockFetchMySubscriptions.mockResolvedValue([]);

    render(<CheckoutSuccessPage />);

    // Run all recursively-scheduled timers (exhausts all poll attempts)
    await act(async () => {
      await vi.runAllTimersAsync();
    });

    // After exhaustion: isLoading=false, no active sub → "Almost there!"
    expect(screen.getByText("Almost there!")).toBeInTheDocument();
  });
});
