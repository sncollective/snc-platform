import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook } from "@testing-library/react";

import { createRouterMock } from "../../helpers/router-mock.js";
import { createAuthMock } from "../../helpers/auth-mock.js";

// ── Hoisted Mocks ──

const { mockUseSession, mockNavigate } = vi.hoisted(() => ({
  mockUseSession: vi.fn(),
  mockNavigate: vi.fn(),
}));

vi.mock("../../../src/lib/auth.js", () =>
  createAuthMock({ useSession: mockUseSession }),
);

vi.mock("@tanstack/react-router", () =>
  createRouterMock({ useNavigate: () => mockNavigate }),
);

// ── Import hook under test (after mocks) ──

import { useGuestRedirect } from "../../../src/hooks/use-guest-redirect.js";
import {
  makeMockSessionResult,
  makeLoggedInSessionResult,
} from "../../helpers/auth-fixtures.js";

// ── Tests ──

describe("useGuestRedirect", () => {
  beforeEach(() => {
    mockUseSession.mockReturnValue(makeMockSessionResult());
    mockNavigate.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns true (shouldRender) when session is pending", () => {
    mockUseSession.mockReturnValue(
      makeMockSessionResult({ isPending: true, data: null }),
    );

    const { result } = renderHook(() => useGuestRedirect());

    expect(result.current).toBe(false);
  });

  it("returns true when session has no data (unauthenticated)", () => {
    mockUseSession.mockReturnValue(
      makeMockSessionResult({ isPending: false, data: null }),
    );

    const { result } = renderHook(() => useGuestRedirect());

    expect(result.current).toBe(true);
  });

  it("returns false and calls navigate when session.data is set (authenticated)", () => {
    mockUseSession.mockReturnValue(makeLoggedInSessionResult());

    const { result } = renderHook(() => useGuestRedirect());

    expect(result.current).toBe(false);
    expect(mockNavigate).toHaveBeenCalledWith({ to: "/feed" });
  });

  it("calls navigate with the /feed path", () => {
    mockUseSession.mockReturnValue(makeLoggedInSessionResult());

    renderHook(() => useGuestRedirect());

    expect(mockNavigate).toHaveBeenCalledTimes(1);
    expect(mockNavigate).toHaveBeenCalledWith({ to: "/feed" });
  });
});
