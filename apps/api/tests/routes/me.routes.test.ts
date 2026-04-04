import { describe, it, expect, vi, beforeEach } from "vitest";

import { setupRouteTest } from "../helpers/route-test-factory.js";
import { makeMockUser, makeMockSession } from "../helpers/auth-fixtures.js";

// ── Mock Helpers ──

const mockGetSession = vi.fn();
const mockGetUserRoles = vi.fn();

// ── Drizzle chain mocks ──

const mockLimit = vi.fn();
const mockWhere = vi.fn();
const mockProvidersWhere = vi.fn();
const mockInnerJoin = vi.fn();
const mockFrom = vi.fn();
const mockSelect = vi.fn();

// ── Test Setup ──

const ctx = setupRouteTest({
  mockAuth: false,
  mockRole: false,
  defaultAuth: { user: null, session: null, roles: [] },
  mocks: ({ UnauthorizedError }) => {
    vi.doMock("../../src/auth/auth.js", () => ({
      auth: {
        api: {
          getSession: mockGetSession,
        },
      },
    }));

    vi.doMock("../../src/auth/user-roles.js", () => ({
      getUserRoles: mockGetUserRoles,
    }));

    vi.doMock("../../src/db/connection.js", () => ({
      db: { select: mockSelect },
      sql: vi.fn(),
    }));

    vi.doMock("../../src/db/schema/subscription.schema.js", () => ({
      subscriptionPlans: {},
      userSubscriptions: {},
    }));

    vi.doMock("../../src/db/schema/user.schema.js", () => ({
      accounts: {},
    }));

    // Mock requireAuth so /providers tests can control auth state directly
    vi.doMock("../../src/middleware/require-auth.js", () => ({
      requireAuth: async (c: any, next: any) => {
        if (!ctx.auth.user) throw new UnauthorizedError();
        c.set("user", ctx.auth.user);
        c.set("session", ctx.auth.session);
        await next();
      },
    }));
  },
  mountRoute: async (app) => {
    const { meRoutes } = await import("../../src/routes/me.routes.js");
    app.route("/api/me", meRoutes);
  },
  beforeEach: () => {
    mockGetSession.mockReset();
    mockGetUserRoles.mockReset();
    mockProvidersWhere.mockReset();

    // Wire the Drizzle chain for both query shapes:
    // - Patron query:   select → from → innerJoin → where → limit
    // - Providers query: select → from → where (resolves directly)
    mockSelect.mockReturnValue({ from: mockFrom });
    mockFrom.mockReturnValue({ innerJoin: mockInnerJoin, where: mockProvidersWhere });
    mockInnerJoin.mockReturnValue({ where: mockWhere });
    mockWhere.mockReturnValue({ limit: mockLimit });
    // Default: no patron subscription
    mockLimit.mockResolvedValue([]);
    // Default: no providers
    mockProvidersWhere.mockResolvedValue([]);
  },
});

// ── Tests ──

describe("GET /api/me", () => {
  it("returns { user: null } when no session exists", async () => {
    mockGetSession.mockResolvedValue(null);

    const res = await ctx.app.request("/api/me");

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toStrictEqual({ user: null });
    expect(mockGetUserRoles).not.toHaveBeenCalled();
  });

  it("returns user, session, and roles when authenticated", async () => {
    const user = makeMockUser();
    const session = makeMockSession();
    mockGetSession.mockResolvedValue({ user, session });
    mockGetUserRoles.mockResolvedValue([]);

    const res = await ctx.app.request("/api/me", {
      headers: {
        Cookie: "better-auth.session_token=valid_token",
      },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.user.id).toBe("user_test123");
    expect(body.user.email).toBe("test@example.com");
    expect(body.session.token).toBe("tok_test789");
    expect(body.roles).toStrictEqual([]);
  });

  it("returns multiple roles for users with multiple roles", async () => {
    mockGetSession.mockResolvedValue({
      user: makeMockUser(),
      session: makeMockSession(),
    });
    mockGetUserRoles.mockResolvedValue(["stakeholder", "admin"]);

    const res = await ctx.app.request("/api/me", {
      headers: {
        Cookie: "better-auth.session_token=valid_token",
      },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.roles).toStrictEqual(["stakeholder", "admin"]);
  });

  it("calls getUserRoles with the correct user ID", async () => {
    const user = makeMockUser({ id: "user_xyz" });
    const session = makeMockSession({ userId: "user_xyz" });
    mockGetSession.mockResolvedValue({ user, session });
    mockGetUserRoles.mockResolvedValue([]);

    await ctx.app.request("/api/me", {
      headers: {
        Cookie: "better-auth.session_token=valid_token",
      },
    });

    expect(mockGetUserRoles).toHaveBeenCalledOnce();
    expect(mockGetUserRoles).toHaveBeenCalledWith("user_xyz");
  });

  it("normalizes user.image from undefined to null", async () => {
    const user = { ...makeMockUser(), image: undefined };
    mockGetSession.mockResolvedValue({
      user,
      session: makeMockSession(),
    });
    mockGetUserRoles.mockResolvedValue([]);

    const res = await ctx.app.request("/api/me", {
      headers: {
        Cookie: "better-auth.session_token=valid_token",
      },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.user.image).toBeNull();
  });

  it("passes raw request headers to auth.api.getSession", async () => {
    mockGetSession.mockResolvedValue(null);

    await ctx.app.request("/api/me", {
      headers: {
        Cookie: "better-auth.session_token=some_token",
      },
    });

    expect(mockGetSession).toHaveBeenCalledOnce();
    const callArg = mockGetSession.mock.calls[0][0];
    expect(callArg).toHaveProperty("headers");
  });
});

describe("isPatron field", () => {
  it("returns isPatron true with active platform subscription", async () => {
    mockGetSession.mockResolvedValue({ user: makeMockUser(), session: makeMockSession() });
    mockGetUserRoles.mockResolvedValue([]);
    mockLimit.mockResolvedValue([{ id: "sub_1" }]);

    const res = await ctx.app.request("/api/me", {
      headers: { Cookie: "better-auth.session_token=valid_token" },
    });

    const body = await res.json();
    expect(body.isPatron).toBe(true);
  });

  it("returns isPatron false with no subscriptions", async () => {
    mockGetSession.mockResolvedValue({ user: makeMockUser(), session: makeMockSession() });
    mockGetUserRoles.mockResolvedValue([]);
    mockLimit.mockResolvedValue([]);

    const res = await ctx.app.request("/api/me", {
      headers: { Cookie: "better-auth.session_token=valid_token" },
    });

    const body = await res.json();
    expect(body.isPatron).toBe(false);
  });

  it("does not include isPatron for unauthenticated response", async () => {
    mockGetSession.mockResolvedValue(null);

    const res = await ctx.app.request("/api/me");

    const body = await res.json();
    expect(body).toStrictEqual({ user: null });
    expect(body.isPatron).toBeUndefined();
  });
});

describe("GET /api/me/providers", () => {
  it("returns 401 when unauthenticated", async () => {
    ctx.auth.user = null;
    ctx.auth.session = null;

    const res = await ctx.app.request("/api/me/providers");

    expect(res.status).toBe(401);
  });

  it("returns hasPassword true when user has credential provider", async () => {
    mockProvidersWhere.mockResolvedValue([
      { providerId: "credential" },
      { providerId: "google" },
    ]);

    const res = await ctx.app.request("/api/me/providers", {
      headers: { Cookie: "better-auth.session_token=valid_token" },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.hasPassword).toBe(true);
    expect(body.providers).toStrictEqual(["credential", "google"]);
  });

  it("returns hasPassword false when user only has OAuth providers", async () => {
    mockProvidersWhere.mockResolvedValue([{ providerId: "google" }]);

    const res = await ctx.app.request("/api/me/providers", {
      headers: { Cookie: "better-auth.session_token=valid_token" },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.hasPassword).toBe(false);
    expect(body.providers).toStrictEqual(["google"]);
  });

  it("returns empty providers list for user with no linked accounts", async () => {
    mockProvidersWhere.mockResolvedValue([]);

    const res = await ctx.app.request("/api/me/providers", {
      headers: { Cookie: "better-auth.session_token=valid_token" },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.hasPassword).toBe(false);
    expect(body.providers).toStrictEqual([]);
  });
});
