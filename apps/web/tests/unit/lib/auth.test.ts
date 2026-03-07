import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";

import { makeMockUser, makeMockSession } from "../../helpers/auth-fixtures.js";
import { setupFetchMock } from "../../helpers/fetch-mock.js";

// ── Hoisted Mocks ──

const { mockUseSession } = vi.hoisted(() => ({
  mockUseSession: vi.fn(),
}));

vi.mock("better-auth/react", () => ({
  createAuthClient: vi.fn(() => ({
    useSession: mockUseSession,
    signIn: { email: vi.fn() },
    signUp: { email: vi.fn() },
    signOut: vi.fn(),
  })),
}));

// ── Imports (after mocks) ──

import { createAuthClient } from "better-auth/react";
import { useRoles, fetchAuthState, hasRole } from "../../../src/lib/auth.js";

// ── Test Lifecycle ──

const { getMockFetch } = setupFetchMock();

beforeEach(() => {
  mockUseSession.mockReturnValue({
    data: null,
    isPending: false,
    error: null,
  });
});

// ── Tests ──

describe("auth client configuration", () => {
  it("configures auth client without explicit baseURL (uses window.location.origin)", () => {
    expect(createAuthClient).toHaveBeenCalledWith({});
  });
});

describe("useRoles", () => {
  it("returns empty array when no session exists", async () => {
    mockUseSession.mockReturnValue({ data: null, isPending: false, error: null });

    const { result } = renderHook(() => useRoles());

    await waitFor(() => {
      expect(result.current).toEqual([]);
    });
  });

  it("returns roles from API when session exists", async () => {
    const user = makeMockUser();
    const session = makeMockSession({ userId: user.id });
    mockUseSession.mockReturnValue({
      data: { user, session },
      isPending: false,
      error: null,
    });

    getMockFetch().mockResolvedValue(
      new Response(
        JSON.stringify({ user, roles: ["subscriber"] }),
        { status: 200 },
      ),
    );

    const { result } = renderHook(() => useRoles());

    await waitFor(() => {
      expect(result.current).toEqual(["subscriber"]);
    });

    expect(getMockFetch()).toHaveBeenCalledWith("/api/me", {
      credentials: "include",
    });
  });

  it("returns empty array when API fetch fails", async () => {
    const user = makeMockUser();
    const session = makeMockSession({ userId: user.id });
    mockUseSession.mockReturnValue({
      data: { user, session },
      isPending: false,
      error: null,
    });

    getMockFetch().mockRejectedValue(new Error("Network error"));

    const { result } = renderHook(() => useRoles());

    await waitFor(() => {
      expect(result.current).toEqual([]);
    });
  });

  it("returns empty array when API returns non-ok", async () => {
    const user = makeMockUser();
    const session = makeMockSession({ userId: user.id });
    mockUseSession.mockReturnValue({
      data: { user, session },
      isPending: false,
      error: null,
    });

    getMockFetch().mockResolvedValue(new Response(null, { status: 500 }));

    const { result } = renderHook(() => useRoles());

    await waitFor(() => {
      expect(result.current).toEqual([]);
    });
  });
});

describe("hasRole", () => {
  it("returns true when the role is present", () => {
    expect(hasRole(["subscriber", "creator"], "creator")).toBe(true);
  });

  it("returns false when the role is absent", () => {
    expect(hasRole(["subscriber"], "creator")).toBe(false);
  });

  it("returns false for an empty roles array", () => {
    expect(hasRole([], "subscriber")).toBe(false);
  });

  it("returns true for a single matching role", () => {
    expect(hasRole(["cooperative-member"], "cooperative-member")).toBe(true);
  });
});

describe("fetchAuthState", () => {
  it("returns user and roles on successful response", async () => {
    const userJson = {
      id: "user_test123",
      name: "Test User",
      email: "test@example.com",
      emailVerified: true,
      image: null,
      createdAt: "2025-01-01T00:00:00.000Z",
      updatedAt: "2025-01-01T00:00:00.000Z",
    };

    getMockFetch().mockResolvedValue(
      new Response(
        JSON.stringify({ user: userJson, roles: ["subscriber"] }),
        { status: 200 },
      ),
    );

    const result = await fetchAuthState();

    expect(result.user).toEqual(userJson);
    expect(result.roles).toEqual(["subscriber"]);
  });

  it("returns null user when response is not ok", async () => {
    getMockFetch().mockResolvedValue(new Response(null, { status: 401 }));

    const result = await fetchAuthState();

    expect(result).toEqual({ user: null, roles: [] });
  });

  it("returns null user when fetch throws", async () => {
    getMockFetch().mockRejectedValue(new Error("Network error"));

    const result = await fetchAuthState();

    expect(result).toEqual({ user: null, roles: [] });
  });
});
