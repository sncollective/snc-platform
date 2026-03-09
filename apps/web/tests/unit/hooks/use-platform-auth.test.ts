import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";

import { createAuthMock } from "../../helpers/auth-mock.js";

// ── Hoisted Mocks ──

const { mockUseSession, mockFetchMySubscriptions } = vi.hoisted(() => ({
  mockUseSession: vi.fn(),
  mockFetchMySubscriptions: vi.fn(),
}));

vi.mock("../../../src/lib/auth.js", () =>
  createAuthMock({ useSession: mockUseSession }),
);

vi.mock("../../../src/lib/subscription.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../src/lib/subscription.js")>();
  return {
    ...actual,
    fetchMySubscriptions: mockFetchMySubscriptions,
  };
});

// ── Import hook under test (after mocks) ──

import { usePlatformAuth } from "../../../src/hooks/use-platform-auth.js";
import {
  makeMockSessionResult,
  makeLoggedInSessionResult,
} from "../../helpers/auth-fixtures.js";
import { makeMockUserSubscription } from "../../helpers/subscription-fixtures.js";

// ── Tests ──

describe("usePlatformAuth", () => {
  beforeEach(() => {
    mockUseSession.mockReturnValue(makeMockSessionResult());
    mockFetchMySubscriptions.mockResolvedValue([]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns isAuthenticated false and isSubscribed false when no session", () => {
    const { result } = renderHook(() => usePlatformAuth());

    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.isSubscribed).toBe(false);
  });

  it("returns isAuthenticated true when session data is present", () => {
    mockUseSession.mockReturnValue(makeLoggedInSessionResult());

    const { result } = renderHook(() => usePlatformAuth());

    expect(result.current.isAuthenticated).toBe(true);
  });

  it("returns isSubscribed true when user has active platform subscription", async () => {
    mockUseSession.mockReturnValue(makeLoggedInSessionResult());
    mockFetchMySubscriptions.mockResolvedValue([
      makeMockUserSubscription({ status: "active" }),
    ]);

    const { result } = renderHook(() => usePlatformAuth());

    await waitFor(() => {
      expect(result.current.isSubscribed).toBe(true);
    });
  });

  it("returns isSubscribed false when user has no subscriptions", async () => {
    mockUseSession.mockReturnValue(makeLoggedInSessionResult());
    mockFetchMySubscriptions.mockResolvedValue([]);

    const { result } = renderHook(() => usePlatformAuth());

    await waitFor(() => {
      expect(result.current.isSubscribed).toBe(false);
    });
  });

  it("returns isSubscribed false when subscription is not active", async () => {
    mockUseSession.mockReturnValue(makeLoggedInSessionResult());
    mockFetchMySubscriptions.mockResolvedValue([
      makeMockUserSubscription({ status: "canceled" }),
    ]);

    const { result } = renderHook(() => usePlatformAuth());

    await waitFor(() => {
      expect(result.current.isSubscribed).toBe(false);
    });
  });
});
