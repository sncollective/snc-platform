import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";

import { createAuthMock } from "../../helpers/auth-mock.js";

// ── Hoisted Mocks ──

const { mockUseSession, mockFetchMySubscriptions } = vi.hoisted(() => ({
  mockUseSession: vi.fn(),
  mockFetchMySubscriptions: vi.fn(),
}));

vi.mock("../../../src/lib/auth.js", () =>
  createAuthMock({ useSession: mockUseSession }),
);

vi.mock("../../../src/lib/subscription.js", () => ({
  fetchMySubscriptions: mockFetchMySubscriptions,
}));

// ── Import hook under test (after mocks) ──

import { useSubscriptions } from "../../../src/hooks/use-subscriptions.js";
import {
  makeMockSessionResult,
  makeLoggedInSessionResult,
} from "../../helpers/auth-fixtures.js";
import { makeMockUserSubscription } from "../../helpers/subscription-fixtures.js";

// ── Tests ──

describe("useSubscriptions", () => {
  beforeEach(() => {
    mockUseSession.mockReturnValue(makeMockSessionResult());
    mockFetchMySubscriptions.mockReset();
  });

  it("returns [] when session.data is null", () => {
    mockUseSession.mockReturnValue(
      makeMockSessionResult({ data: null, isPending: false }),
    );

    const { result } = renderHook(() => useSubscriptions());

    expect(result.current).toEqual([]);
    expect(mockFetchMySubscriptions).not.toHaveBeenCalled();
  });

  it("fetches subscriptions when session.data is set and returns result", async () => {
    const sub = makeMockUserSubscription();
    mockFetchMySubscriptions.mockResolvedValue([sub]);
    mockUseSession.mockReturnValue(makeLoggedInSessionResult());

    const { result } = renderHook(() => useSubscriptions());

    await waitFor(() => {
      expect(result.current).toEqual([sub]);
    });

    expect(mockFetchMySubscriptions).toHaveBeenCalledTimes(1);
  });

  it("clears to [] when session changes from authenticated to null", async () => {
    const sub = makeMockUserSubscription();
    mockFetchMySubscriptions.mockResolvedValue([sub]);
    mockUseSession.mockReturnValue(makeLoggedInSessionResult());

    const { result, rerender } = renderHook(() => useSubscriptions());

    await waitFor(() => {
      expect(result.current).toEqual([sub]);
    });

    // Session changes to null (logout)
    mockUseSession.mockReturnValue(
      makeMockSessionResult({ data: null, isPending: false }),
    );
    rerender();

    await waitFor(() => {
      expect(result.current).toEqual([]);
    });
  });

  it("fetches when session changes from null to authenticated", async () => {
    const sub = makeMockUserSubscription();
    mockFetchMySubscriptions.mockResolvedValue([sub]);

    // Start unauthenticated
    mockUseSession.mockReturnValue(
      makeMockSessionResult({ data: null, isPending: false }),
    );

    const { result, rerender } = renderHook(() => useSubscriptions());

    expect(result.current).toEqual([]);
    expect(mockFetchMySubscriptions).not.toHaveBeenCalled();

    // Session arrives
    mockUseSession.mockReturnValue(makeLoggedInSessionResult());
    rerender();

    await waitFor(() => {
      expect(result.current).toEqual([sub]);
    });

    expect(mockFetchMySubscriptions).toHaveBeenCalledTimes(1);
  });

  it("calls AbortController.abort() on cleanup when session changes", async () => {
    const abortSpy = vi.fn();
    const originalAbortController = globalThis.AbortController;
    globalThis.AbortController = class MockAbortController {
      readonly signal = {} as AbortSignal;
      abort = abortSpy;
    } as unknown as typeof AbortController;

    // Provide a fetch that never resolves, so the effect is still in-flight
    mockFetchMySubscriptions.mockReturnValue(new Promise(() => {}));
    mockUseSession.mockReturnValue(makeLoggedInSessionResult());

    const { rerender } = renderHook(() => useSubscriptions());

    // Change session to trigger cleanup of the previous effect
    mockUseSession.mockReturnValue(
      makeMockSessionResult({ data: null, isPending: false }),
    );

    act(() => {
      rerender();
    });

    expect(abortSpy).toHaveBeenCalledTimes(1);

    globalThis.AbortController = originalAbortController;
  });
});
