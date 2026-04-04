import { describe, it, expect, vi } from "vitest";

import { setupRouteTest } from "../helpers/route-test-factory.js";
import { makeMockUser } from "../helpers/auth-fixtures.js";

// ── Service Mocks ──

const mockFollowCreator = vi.fn();
const mockUnfollowCreator = vi.fn();
const mockGetFollowStatus = vi.fn();

// ── Test Context ──

const ctx = setupRouteTest({
  defaultAuth: { user: makeMockUser(), roles: [] },
  mocks: () => {
    vi.doMock("../../src/services/follows.js", () => ({
      followCreator: mockFollowCreator,
      unfollowCreator: mockUnfollowCreator,
      getFollowStatus: mockGetFollowStatus,
    }));

    vi.doMock("../../src/middleware/optional-auth.js", () => ({
      optionalAuth: async (c: any, next: any) => {
        c.set("user", ctx.auth.user);
        c.set("session", null);
        c.set("roles", ctx.auth.roles);
        await next();
      },
    }));
  },
  mountRoute: async (app) => {
    const { followRoutes } = await import("../../src/routes/follow.routes.js");
    app.route("/api/creators", followRoutes);
  },
  beforeEach: () => {
    mockFollowCreator.mockResolvedValue({ ok: true, value: undefined });
    mockUnfollowCreator.mockResolvedValue({ ok: true, value: undefined });
    mockGetFollowStatus.mockResolvedValue({ isFollowing: false, followerCount: 0 });
  },
});

// ── Tests ──

describe("GET /api/creators/:creatorId/follow", () => {
  it("returns follow status for anonymous user", async () => {
    ctx.auth.user = null;
    mockGetFollowStatus.mockResolvedValueOnce({ isFollowing: false, followerCount: 42 });

    const res = await ctx.app.request("/api/creators/creator-1/follow");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.isFollowing).toBe(false);
    expect(body.followerCount).toBe(42);
  });

  it("returns follow status with isFollowing true for authenticated user", async () => {
    mockGetFollowStatus.mockResolvedValueOnce({ isFollowing: true, followerCount: 10 });

    const res = await ctx.app.request("/api/creators/creator-1/follow");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.isFollowing).toBe(true);
    expect(body.followerCount).toBe(10);
  });
});

describe("POST /api/creators/:creatorId/follow", () => {
  it("follows a creator and returns 204", async () => {
    const res = await ctx.app.request("/api/creators/creator-1/follow", {
      method: "POST",
    });
    expect(res.status).toBe(204);
    expect(mockFollowCreator).toHaveBeenCalledWith("user_test123", "creator-1");
  });

  it("returns 401 when unauthenticated", async () => {
    ctx.auth.user = null;
    const res = await ctx.app.request("/api/creators/creator-1/follow", {
      method: "POST",
    });
    expect(res.status).toBe(401);
  });
});

describe("DELETE /api/creators/:creatorId/follow", () => {
  it("unfollows a creator and returns 204", async () => {
    const res = await ctx.app.request("/api/creators/creator-1/follow", {
      method: "DELETE",
    });
    expect(res.status).toBe(204);
    expect(mockUnfollowCreator).toHaveBeenCalledWith("user_test123", "creator-1");
  });

  it("returns 401 when unauthenticated", async () => {
    ctx.auth.user = null;
    const res = await ctx.app.request("/api/creators/creator-1/follow", {
      method: "DELETE",
    });
    expect(res.status).toBe(401);
  });
});
