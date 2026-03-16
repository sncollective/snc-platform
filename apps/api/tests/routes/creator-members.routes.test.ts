import { describe, it, expect, vi } from "vitest";

import { setupRouteTest } from "../helpers/route-test-factory.js";
import { makeMockUser } from "../helpers/auth-fixtures.js";
import { makeMockDbCreatorProfile, makeMockCreatorMember } from "../helpers/creator-fixtures.js";
import { chainablePromise } from "../helpers/db-mock-utils.js";

// ── Mock DB Chains ──

const mockSelectWhere = vi.fn();
const mockSelectFrom = vi.fn();
const mockSelect = vi.fn();

const mockInsertValues = vi.fn();
const mockInsert = vi.fn(() => ({ values: mockInsertValues }));

const mockUpdateWhere = vi.fn();
const mockUpdateSet = vi.fn(() => ({ where: mockUpdateWhere }));
const mockUpdate = vi.fn(() => ({ set: mockUpdateSet }));

const mockDeleteWhere = vi.fn();
const mockDelete = vi.fn(() => ({ where: mockDeleteWhere }));

const mockInnerJoinWhere = vi.fn();
const mockInnerJoin = vi.fn(() => ({ where: mockInnerJoinWhere }));

const mockDb = {
  select: mockSelect,
  insert: mockInsert,
  update: mockUpdate,
  delete: mockDelete,
};

// ── Creator Team Service Mock ──

const mockRequireCreatorPermission = vi.fn();
const mockGetCreatorMemberships = vi.fn();
const mockCheckCreatorPermission = vi.fn();

// ── Test Setup ──

const ctx = setupRouteTest({
  db: mockDb,
  defaultAuth: { roles: ["subscriber", "creator"] },
  mocks: () => {
    vi.doMock("../../src/db/schema/creator.schema.js", () => ({
      creatorProfiles: {},
      creatorMembers: {},
    }));

    vi.doMock("../../src/db/schema/content.schema.js", () => ({
      content: {},
    }));

    vi.doMock("../../src/db/schema/user.schema.js", () => ({
      users: {},
      userRoles: {},
    }));

    vi.doMock("../../src/storage/index.js", () => ({
      storage: { upload: vi.fn(), download: vi.fn(), delete: vi.fn(), getSignedUrl: vi.fn() },
      createStorageProvider: vi.fn(),
    }));

    vi.doMock("../../src/services/creator-team.js", () => ({
      requireCreatorPermission: mockRequireCreatorPermission,
      getCreatorMemberships: mockGetCreatorMemberships,
      checkCreatorPermission: mockCheckCreatorPermission,
    }));
  },
  mountRoute: async (app) => {
    const { creatorRoutes } = await import(
      "../../src/routes/creator.routes.js"
    );
    app.route("/api/creators", creatorRoutes);
  },
  beforeEach: () => {
    // Re-establish SELECT chain
    mockSelect.mockReturnValue({ from: mockSelectFrom });
    mockSelectFrom.mockImplementation(() => ({
      where: mockSelectWhere,
      orderBy: vi.fn(() => ({ limit: vi.fn().mockResolvedValue([]) })),
    }));
    mockSelectWhere.mockResolvedValue([]);

    // INSERT chain
    mockInsert.mockReturnValue({ values: mockInsertValues });
    mockInsertValues.mockResolvedValue([]);

    // UPDATE chain
    mockUpdate.mockReturnValue({ set: mockUpdateSet });
    mockUpdateSet.mockReturnValue({ where: mockUpdateWhere });
    mockUpdateWhere.mockImplementation(() =>
      chainablePromise(undefined, {}),
    );

    // DELETE chain
    mockDelete.mockReturnValue({ where: mockDeleteWhere });
    mockDeleteWhere.mockResolvedValue([]);

    // Creator team service defaults
    mockRequireCreatorPermission.mockResolvedValue(undefined);
    mockGetCreatorMemberships.mockResolvedValue([]);
    mockCheckCreatorPermission.mockResolvedValue(true);
  },
});

// ── Tests ──

describe("creator member routes", () => {
  // ── POST /api/creators ──

  describe("POST /api/creators", () => {
    it("creates a new creator entity with creator role", async () => {
      const newProfile = makeMockDbCreatorProfile({ id: "new_creator_id", displayName: "New Band" });

      // Handle uniqueness check (no existing handle)
      mockSelectWhere.mockResolvedValueOnce([]);

      // INSERT profile returning
      const mockReturning = vi.fn().mockResolvedValue([newProfile]);
      const mockOnConflictDoNothing = vi.fn(() => ({ returning: mockReturning }));
      mockInsertValues.mockReturnValueOnce({
        returning: mockReturning,
        onConflictDoNothing: mockOnConflictDoNothing,
      });
      // INSERT member row
      mockInsertValues.mockReturnValueOnce({ returning: vi.fn().mockResolvedValue([]) });

      const res = await ctx.app.request("/api/creators", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName: "New Band" }),
      });

      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.displayName).toBe("New Band");
    });

    it("returns 403 without creator platform role", async () => {
      ctx.auth.roles = ["subscriber"];

      const res = await ctx.app.request("/api/creators", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName: "New Band" }),
      });

      expect(res.status).toBe(403);
    });
  });

  // ── GET /api/creators/:id/members ──

  describe("GET /api/creators/:id/members", () => {
    it("returns members list for a member", async () => {
      const profile = makeMockDbCreatorProfile();
      const member = makeMockCreatorMember();
      const ownerUser = makeMockUser({ id: "user_test123", name: "Test Creator" });

      // findCreatorProfile
      mockSelectWhere.mockResolvedValueOnce([profile]);
      // membership check
      mockSelectWhere.mockResolvedValueOnce([{ role: "owner" }]);
      // list members with join
      mockInnerJoinWhere.mockResolvedValueOnce([
        {
          userId: member.userId,
          role: member.role,
          joinedAt: member.createdAt,
          displayName: ownerUser.name,
        },
      ]);
      mockSelectFrom.mockReturnValueOnce({ where: mockSelectWhere });
      mockSelectFrom.mockReturnValueOnce({ where: mockSelectWhere });
      mockSelectFrom.mockReturnValueOnce({ innerJoin: mockInnerJoin });

      const res = await ctx.app.request("/api/creators/user_test123/members");

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(Array.isArray(body.members)).toBe(true);
    });

    it("returns 404 for unknown creator", async () => {
      mockSelectWhere.mockResolvedValueOnce([]);

      const res = await ctx.app.request("/api/creators/nonexistent/members");

      expect(res.status).toBe(404);
    });

    it("returns 403 for non-member", async () => {
      const profile = makeMockDbCreatorProfile();

      // findCreatorProfile
      mockSelectWhere.mockResolvedValueOnce([profile]);
      // membership check - not a member
      mockSelectWhere.mockResolvedValueOnce([]);

      const res = await ctx.app.request("/api/creators/user_test123/members");

      expect(res.status).toBe(403);
    });
  });

  // ── POST /api/creators/:id/members ──

  describe("POST /api/creators/:id/members", () => {
    it("adds a member as owner", async () => {
      const profile = makeMockDbCreatorProfile();

      // findCreatorProfile
      mockSelectWhere.mockResolvedValueOnce([profile]);
      // target user exists
      mockSelectWhere.mockResolvedValueOnce([{ id: "user_new", name: "New User" }]);
      // not already a member
      mockSelectWhere.mockResolvedValueOnce([]);
      // INSERT member
      mockInsertValues.mockResolvedValueOnce([]);
      // list updated members with join
      mockInnerJoinWhere.mockResolvedValueOnce([]);
      mockSelectFrom.mockReturnValueOnce({ where: mockSelectWhere });
      mockSelectFrom.mockReturnValueOnce({ where: mockSelectWhere });
      mockSelectFrom.mockReturnValueOnce({ where: mockSelectWhere });
      mockSelectFrom.mockReturnValueOnce({ innerJoin: mockInnerJoin });

      const res = await ctx.app.request("/api/creators/user_test123/members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: "user_new", role: "editor" }),
      });

      expect(res.status).toBe(201);
    });

    it("returns 403 for editor trying to add members", async () => {
      const profile = makeMockDbCreatorProfile();
      mockSelectWhere.mockResolvedValueOnce([profile]);

      const { ForbiddenError } = await import("@snc/shared");
      mockRequireCreatorPermission.mockRejectedValueOnce(
        new ForbiddenError("Missing creator permission: manageMembers"),
      );

      const res = await ctx.app.request("/api/creators/user_test123/members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: "user_other", role: "viewer" }),
      });

      expect(res.status).toBe(403);
    });

    it("returns 400 if user is already a member", async () => {
      const profile = makeMockDbCreatorProfile();

      mockSelectWhere.mockResolvedValueOnce([profile]);
      mockSelectWhere.mockResolvedValueOnce([{ id: "user_existing", name: "Existing" }]);
      mockSelectWhere.mockResolvedValueOnce([{ role: "editor" }]);

      const res = await ctx.app.request("/api/creators/user_test123/members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: "user_existing", role: "viewer" }),
      });

      expect(res.status).toBe(400);
    });
  });

  // ── PATCH /api/creators/:id/members/:userId ──

  describe("PATCH /api/creators/:id/members/:memberId", () => {
    it("updates member role as owner", async () => {
      const profile = makeMockDbCreatorProfile();

      mockSelectWhere.mockResolvedValueOnce([profile]);
      // member exists
      mockSelectWhere.mockResolvedValueOnce([{ role: "editor" }]);
      // after update, list members with join
      mockInnerJoinWhere.mockResolvedValueOnce([]);
      mockSelectFrom.mockReturnValueOnce({ where: mockSelectWhere });
      mockSelectFrom.mockReturnValueOnce({ where: mockSelectWhere });
      mockSelectFrom.mockReturnValueOnce({ innerJoin: mockInnerJoin });

      const res = await ctx.app.request(
        "/api/creators/user_test123/members/user_editor",
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ role: "viewer" }),
        },
      );

      expect(res.status).toBe(200);
    });

    it("returns 403 for editor trying to update roles", async () => {
      const profile = makeMockDbCreatorProfile();
      mockSelectWhere.mockResolvedValueOnce([profile]);

      const { ForbiddenError } = await import("@snc/shared");
      mockRequireCreatorPermission.mockRejectedValueOnce(
        new ForbiddenError("Missing creator permission: manageMembers"),
      );

      const res = await ctx.app.request(
        "/api/creators/user_test123/members/user_editor",
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ role: "viewer" }),
        },
      );

      expect(res.status).toBe(403);
    });
  });

  // ── DELETE /api/creators/:id/members/:memberId ──

  describe("DELETE /api/creators/:id/members/:memberId", () => {
    it("removes a non-owner member", async () => {
      const profile = makeMockDbCreatorProfile();

      mockSelectWhere.mockResolvedValueOnce([profile]);
      // member exists (editor)
      mockSelectWhere.mockResolvedValueOnce([{ role: "editor" }]);
      // after delete, list members
      mockInnerJoinWhere.mockResolvedValueOnce([]);
      mockSelectFrom.mockReturnValueOnce({ where: mockSelectWhere });
      mockSelectFrom.mockReturnValueOnce({ where: mockSelectWhere });
      mockSelectFrom.mockReturnValueOnce({ innerJoin: mockInnerJoin });

      const res = await ctx.app.request(
        "/api/creators/user_test123/members/user_editor",
        { method: "DELETE" },
      );

      expect(res.status).toBe(200);
    });

    it("returns 422 when removing last owner", async () => {
      const profile = makeMockDbCreatorProfile();

      mockSelectWhere.mockResolvedValueOnce([profile]);
      // member is an owner
      mockSelectWhere.mockResolvedValueOnce([{ role: "owner" }]);
      // only 1 owner in the list
      mockSelectWhere.mockResolvedValueOnce([{ userId: "user_test123" }]);

      const res = await ctx.app.request(
        "/api/creators/user_test123/members/user_test123",
        { method: "DELETE" },
      );

      expect(res.status).toBe(400);
    });
  });
});
