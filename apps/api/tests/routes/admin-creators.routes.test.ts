import { describe, it, expect, vi } from "vitest";

import { setupRouteTest } from "../helpers/route-test-factory.js";
import { makeMockUser, makeMockSession } from "../helpers/auth-fixtures.js";
import { makeMockDbCreatorProfile } from "../helpers/creator-fixtures.js";
import { chainablePromise } from "../helpers/db-mock-utils.js";

// ── Test UUIDs ──

const ADMIN_UUID = "00000000-0000-4000-a000-000000000001";
const CREATOR_UUID = "00000000-0000-4000-a000-000000000099";

// ── Mock DB Chains ──

const mockSelectWhere = vi.fn();
const mockSelectFrom = vi.fn();
const mockSelect = vi.fn();

const mockInsertReturning = vi.fn();
const mockInsertValues = vi.fn(() => ({ returning: mockInsertReturning }));
const mockInsert = vi.fn(() => ({ values: mockInsertValues }));

const mockUpdateReturning = vi.fn();
const mockUpdateWhere = vi.fn(() =>
  chainablePromise(undefined, { returning: mockUpdateReturning }),
);
const mockUpdateSet = vi.fn(() => ({ where: mockUpdateWhere }));
const mockUpdate = vi.fn(() => ({ set: mockUpdateSet }));

const mockDeleteWhere = vi.fn();
const mockDelete = vi.fn(() => ({ where: mockDeleteWhere }));

const mockOrderBy = vi.fn();
const mockLimit = vi.fn();

const mockGroupBy = vi.fn();

const mockDb = {
  select: mockSelect,
  insert: mockInsert,
  update: mockUpdate,
  delete: mockDelete,
};

// ── Archive Service Mock ──

const mockArchiveCreator = vi.fn();

// ── Test Setup ──

const ctx = setupRouteTest({
  db: mockDb,
  defaultAuth: {
    user: makeMockUser({ id: ADMIN_UUID }),
    session: makeMockSession({ userId: ADMIN_UUID }),
    roles: ["admin"],
  },
  mocks: () => {
    vi.doMock("../../src/db/schema/creator.schema.js", () => ({
      creatorProfiles: {},
    }));

    vi.doMock("../../src/db/schema/content.schema.js", () => ({
      content: {},
    }));

    vi.doMock("../../src/db/schema/subscription.schema.js", () => ({
      subscriptionPlans: {},
      userSubscriptions: {},
    }));

    vi.doMock("../../src/db/schema/user.schema.js", () => ({
      users: {},
      userRoles: {},
    }));

    vi.doMock("../../src/services/creator-lifecycle.js", () => ({
      archiveCreator: mockArchiveCreator,
    }));
  },
  mountRoute: async (app) => {
    const { adminCreatorRoutes } = await import(
      "../../src/routes/admin-creators.routes.js"
    );
    app.route("/api/admin/creators", adminCreatorRoutes);
  },
  beforeEach: () => {
    // SELECT chain: select → from → where → orderBy → limit
    mockSelect.mockReturnValue({ from: mockSelectFrom });
    mockSelectFrom.mockImplementation(() => ({
      where: mockSelectWhere,
    }));
    mockSelectWhere.mockReturnValue(
      chainablePromise([], {
        orderBy: vi.fn(() => ({ limit: mockLimit })),
        groupBy: mockGroupBy,
      }),
    );
    mockOrderBy.mockReturnValue({ limit: mockLimit });
    mockLimit.mockResolvedValue([]);
    mockGroupBy.mockResolvedValue([]);

    // INSERT chain
    mockInsert.mockReturnValue({ values: mockInsertValues });
    mockInsertValues.mockReturnValue({ returning: mockInsertReturning });
    mockInsertReturning.mockResolvedValue([]);

    // UPDATE chain
    mockUpdate.mockReturnValue({ set: mockUpdateSet });
    mockUpdateSet.mockReturnValue({ where: mockUpdateWhere });
    mockUpdateWhere.mockImplementation(() =>
      chainablePromise(undefined, { returning: mockUpdateReturning }),
    );
    mockUpdateReturning.mockResolvedValue([]);

    // DELETE chain
    mockDelete.mockReturnValue({ where: mockDeleteWhere });
    mockDeleteWhere.mockResolvedValue({ rowCount: 0 });

    // Archive service: no-op by default
    mockArchiveCreator.mockResolvedValue(undefined);
  },
});

// ── Tests ──

describe("admin creator routes", () => {
  // ── GET /api/admin/creators ──

  describe("GET /api/admin/creators", () => {
    it("returns paginated creator list with status", async () => {
      const profiles = [
        makeMockDbCreatorProfile({ id: "creator-1", displayName: "Creator One" }),
        makeMockDbCreatorProfile({ id: "creator-2", displayName: "Creator Two", status: "inactive" }),
      ];

      mockSelectWhere.mockReturnValueOnce(
        chainablePromise(profiles, {
          orderBy: vi.fn(() => ({ limit: vi.fn().mockResolvedValue(profiles) })),
          groupBy: mockGroupBy,
        }),
      );

      // batchGetContentCounts
      mockSelectWhere.mockReturnValueOnce(
        chainablePromise([], { groupBy: vi.fn().mockResolvedValue([]) }),
      );

      const res = await ctx.app.request("/api/admin/creators");

      expect(res.status).toBe(200);
      const body = (await res.json()) as { items: Array<{ status: string; displayName: string }>; nextCursor: string | null };
      expect(body.items).toHaveLength(2);
      expect(body.items[0].status).toBe("active");
      expect(body.items[1].status).toBe("inactive");
    });

    it("filters by status query param", async () => {
      const inactiveProfile = makeMockDbCreatorProfile({
        id: "creator-1",
        status: "inactive",
      });

      mockSelectWhere.mockReturnValueOnce(
        chainablePromise([inactiveProfile], {
          orderBy: vi.fn(() => ({ limit: vi.fn().mockResolvedValue([inactiveProfile]) })),
          groupBy: mockGroupBy,
        }),
      );

      // batchGetContentCounts
      mockSelectWhere.mockReturnValueOnce(
        chainablePromise([], { groupBy: vi.fn().mockResolvedValue([]) }),
      );

      const res = await ctx.app.request("/api/admin/creators?status=inactive");

      expect(res.status).toBe(200);
      const body = (await res.json()) as { items: Array<{ status: string }> };
      expect(body.items).toHaveLength(1);
      expect(body.items[0].status).toBe("inactive");
    });

    it("returns 401 without auth", async () => {
      ctx.auth.user = null;
      ctx.auth.roles = [];

      const res = await ctx.app.request("/api/admin/creators");

      expect(res.status).toBe(401);
    });

    it("returns 403 without admin role", async () => {
      ctx.auth.roles = ["stakeholder"];

      const res = await ctx.app.request("/api/admin/creators");

      expect(res.status).toBe(403);
    });
  });

  // ── POST /api/admin/creators ──

  describe("POST /api/admin/creators", () => {
    it("creates creator with inactive status and no member row", async () => {
      const newProfile = makeMockDbCreatorProfile({
        id: CREATOR_UUID,
        displayName: "New Creator",
        handle: "new-creator",
        status: "inactive",
      });

      // Handle uniqueness check (no conflict)
      mockSelectWhere.mockResolvedValueOnce([]);
      // generateUniqueSlug slug check
      mockSelectWhere.mockResolvedValueOnce([]);
      // INSERT returning
      mockInsertReturning.mockResolvedValueOnce([newProfile]);

      const res = await ctx.app.request("/api/admin/creators", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName: "New Creator" }),
      });

      expect(res.status).toBe(201);
      const body = (await res.json()) as { creator: { status: string; displayName: string } };
      expect(body.creator.status).toBe("inactive");
      expect(body.creator.displayName).toBe("New Creator");

      // No creator member insert (admin creates without member row)
      // We check INSERT was called exactly once (for creatorProfiles, not creatorMembers)
      expect(mockInsert).toHaveBeenCalledOnce();
    });

    it("rejects duplicate handles", async () => {
      // Handle uniqueness check returns existing
      mockSelectWhere.mockResolvedValueOnce([{ id: "existing-creator" }]);

      const res = await ctx.app.request("/api/admin/creators", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName: "Test", handle: "taken-handle" }),
      });

      expect(res.status).toBe(400);
    });

    it("returns 401/403 for non-admin", async () => {
      ctx.auth.roles = ["stakeholder"];

      const res = await ctx.app.request("/api/admin/creators", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName: "Test" }),
      });

      expect(res.status).toBe(403);
    });

    it("auto-generates handle from displayName when not provided", async () => {
      const newProfile = makeMockDbCreatorProfile({
        displayName: "My Artist",
        handle: "my-artist",
        status: "inactive",
      });

      // No explicit handle → handle uniqueness check skipped
      // generateUniqueSlug slug check
      mockSelectWhere.mockResolvedValueOnce([]);
      // INSERT returning
      mockInsertReturning.mockResolvedValueOnce([newProfile]);

      const res = await ctx.app.request("/api/admin/creators", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName: "My Artist" }),
      });

      expect(res.status).toBe(201);
      const body = (await res.json()) as { creator: { handle: string } };
      expect(body.creator.handle).toBe("my-artist");
    });
  });

  // ── PATCH /api/admin/creators/:creatorId/status ──

  describe("PATCH /api/admin/creators/:creatorId/status", () => {
    it("changes status from inactive to active", async () => {
      const existing = makeMockDbCreatorProfile({
        id: CREATOR_UUID,
        status: "inactive",
      });
      const updated = makeMockDbCreatorProfile({
        id: CREATOR_UUID,
        status: "active",
      });

      // Lookup existing
      mockSelectWhere.mockResolvedValueOnce([existing]);
      // UPDATE returning
      mockUpdateReturning.mockResolvedValueOnce([updated]);
      // getContentCount
      mockSelectWhere.mockReturnValueOnce(
        chainablePromise([{ count: 0 }], { groupBy: mockGroupBy }),
      );

      const res = await ctx.app.request(
        `/api/admin/creators/${CREATOR_UUID}/status`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "active" }),
        },
      );

      expect(res.status).toBe(200);
      const body = (await res.json()) as { creator: { status: string } };
      expect(body.creator.status).toBe("active");
      expect(mockArchiveCreator).not.toHaveBeenCalled();
    });

    it("changes status from active to archived and runs cleanup", async () => {
      const existing = makeMockDbCreatorProfile({
        id: CREATOR_UUID,
        status: "active",
      });
      const updated = makeMockDbCreatorProfile({
        id: CREATOR_UUID,
        status: "archived",
      });

      // Lookup existing
      mockSelectWhere.mockResolvedValueOnce([existing]);
      // UPDATE returning
      mockUpdateReturning.mockResolvedValueOnce([updated]);
      // getContentCount
      mockSelectWhere.mockReturnValueOnce(
        chainablePromise([{ count: 0 }], { groupBy: mockGroupBy }),
      );

      const res = await ctx.app.request(
        `/api/admin/creators/${CREATOR_UUID}/status`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "archived" }),
        },
      );

      expect(res.status).toBe(200);
      const body = (await res.json()) as { creator: { status: string } };
      expect(body.creator.status).toBe("archived");
      // Archive side effect was triggered
      expect(mockArchiveCreator).toHaveBeenCalledOnce();
      expect(mockArchiveCreator).toHaveBeenCalledWith(CREATOR_UUID);
    });

    it("does not run archive cleanup when already archived", async () => {
      const existing = makeMockDbCreatorProfile({
        id: CREATOR_UUID,
        status: "archived",
      });
      const updated = makeMockDbCreatorProfile({
        id: CREATOR_UUID,
        status: "archived",
      });

      // Lookup existing
      mockSelectWhere.mockResolvedValueOnce([existing]);
      // UPDATE returning
      mockUpdateReturning.mockResolvedValueOnce([updated]);
      // getContentCount
      mockSelectWhere.mockReturnValueOnce(
        chainablePromise([{ count: 0 }], { groupBy: mockGroupBy }),
      );

      const res = await ctx.app.request(
        `/api/admin/creators/${CREATOR_UUID}/status`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "archived" }),
        },
      );

      expect(res.status).toBe(200);
      // Archive not called again since already archived
      expect(mockArchiveCreator).not.toHaveBeenCalled();
    });

    it("returns 404 for unknown creator", async () => {
      mockSelectWhere.mockResolvedValueOnce([]);

      const res = await ctx.app.request(
        "/api/admin/creators/nonexistent-creator/status",
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "active" }),
        },
      );

      expect(res.status).toBe(404);
      const body = (await res.json()) as { error: { code: string } };
      expect(body.error.code).toBe("NOT_FOUND");
    });

    it("returns 401 without auth", async () => {
      ctx.auth.user = null;
      ctx.auth.roles = [];

      const res = await ctx.app.request(
        `/api/admin/creators/${CREATOR_UUID}/status`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "active" }),
        },
      );

      expect(res.status).toBe(401);
    });

    it("returns 403 without admin role", async () => {
      ctx.auth.roles = ["stakeholder"];

      const res = await ctx.app.request(
        `/api/admin/creators/${CREATOR_UUID}/status`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "active" }),
        },
      );

      expect(res.status).toBe(403);
    });

    it("changes status from archived to active (restore)", async () => {
      const existing = makeMockDbCreatorProfile({
        id: CREATOR_UUID,
        status: "archived",
      });
      const updated = makeMockDbCreatorProfile({
        id: CREATOR_UUID,
        status: "active",
      });

      // Lookup existing
      mockSelectWhere.mockResolvedValueOnce([existing]);
      // UPDATE returning
      mockUpdateReturning.mockResolvedValueOnce([updated]);
      // getContentCount
      mockSelectWhere.mockReturnValueOnce(
        chainablePromise([{ count: 0 }], { groupBy: mockGroupBy }),
      );

      const res = await ctx.app.request(
        `/api/admin/creators/${CREATOR_UUID}/status`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "active" }),
        },
      );

      expect(res.status).toBe(200);
      const body = (await res.json()) as { creator: { status: string } };
      expect(body.creator.status).toBe("active");
      // No archive side effects for restore
      expect(mockArchiveCreator).not.toHaveBeenCalled();
    });
  });
});
