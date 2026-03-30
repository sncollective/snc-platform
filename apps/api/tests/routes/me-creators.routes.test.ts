import { describe, it, expect, vi } from "vitest";

import { setupRouteTest } from "../helpers/route-test-factory.js";
import { makeMockUser } from "../helpers/auth-fixtures.js";

// ── Mock DB Chains ──

const mockWhere = vi.fn();
const mockInnerJoin = vi.fn();
const mockFrom = vi.fn();
const mockSelect = vi.fn();

const mockDb = {
  select: mockSelect,
};

// ── Test Setup ──

const ctx = setupRouteTest({
  db: mockDb,
  defaultAuth: { user: makeMockUser(), roles: [] },
  mocks: () => {
    vi.doMock("../../src/db/schema/creator.schema.js", () => ({
      creatorProfiles: {},
      creatorMembers: {},
    }));
  },
  mountRoute: async (app) => {
    const { meCreatorsRoutes } = await import("../../src/routes/me-creators.routes.js");
    app.route("/api/me/creators", meCreatorsRoutes);
  },
  beforeEach: () => {
    // Wire the Drizzle chain: select → from → innerJoin → where
    mockSelect.mockReturnValue({ from: mockFrom });
    mockFrom.mockReturnValue({ innerJoin: mockInnerJoin });
    mockInnerJoin.mockReturnValue({ where: mockWhere });
    // Default: no creator memberships
    mockWhere.mockResolvedValue([]);
  },
});

// ── Tests ──

describe("GET /api/me/creators", () => {
  it("returns 401 when not authenticated", async () => {
    ctx.auth.user = null;
    ctx.auth.session = null;

    const res = await ctx.app.request("/api/me/creators");

    expect(res.status).toBe(401);
  });

  it("returns empty array when user has no creator memberships", async () => {
    mockWhere.mockResolvedValue([]);

    const res = await ctx.app.request("/api/me/creators");

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toStrictEqual({ creators: [] });
  });

  it("returns correct creator data with role and avatar URL when avatarKey is set", async () => {
    mockWhere.mockResolvedValue([
      {
        id: "creator_abc",
        displayName: "My Band",
        handle: "my-band",
        role: "owner",
        avatarKey: "avatars/creator_abc.jpg",
      },
    ]);

    const res = await ctx.app.request("/api/me/creators");

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.creators).toHaveLength(1);
    expect(body.creators[0]).toStrictEqual({
      id: "creator_abc",
      displayName: "My Band",
      handle: "my-band",
      role: "owner",
      avatarUrl: "/api/creators/creator_abc/avatar",
    });
  });

  it("returns null avatarUrl when avatarKey is null", async () => {
    mockWhere.mockResolvedValue([
      {
        id: "creator_xyz",
        displayName: "No Avatar Creator",
        handle: null,
        role: "editor",
        avatarKey: null,
      },
    ]);

    const res = await ctx.app.request("/api/me/creators");

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.creators[0].avatarUrl).toBeNull();
  });

  it("returns multiple creators when user is a member of several", async () => {
    mockWhere.mockResolvedValue([
      {
        id: "creator_1",
        displayName: "Creator One",
        handle: "creator-one",
        role: "owner",
        avatarKey: null,
      },
      {
        id: "creator_2",
        displayName: "Creator Two",
        handle: "creator-two",
        role: "viewer",
        avatarKey: "avatars/creator_2.jpg",
      },
    ]);

    const res = await ctx.app.request("/api/me/creators");

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.creators).toHaveLength(2);
    expect(body.creators[0].id).toBe("creator_1");
    expect(body.creators[0].role).toBe("owner");
    expect(body.creators[1].id).toBe("creator_2");
    expect(body.creators[1].role).toBe("viewer");
    expect(body.creators[1].avatarUrl).toBe("/api/creators/creator_2/avatar");
  });
});
