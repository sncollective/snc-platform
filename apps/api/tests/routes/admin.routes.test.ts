import { describe, it, expect, vi } from "vitest";

import { setupRouteTest } from "../helpers/route-test-factory.js";
import { makeMockUser, makeMockSession } from "../helpers/auth-fixtures.js";
import { makeMockDbUser } from "../helpers/admin-fixtures.js";
import { chainablePromise } from "../helpers/db-mock-utils.js";

// ── Mock DB Chains ──

const mockSelectWhere = vi.fn();
const mockSelectFrom = vi.fn();
const mockSelect = vi.fn();
const mockInsertOnConflictDoNothing = vi.fn();
const mockInsertValues = vi.fn();
const mockInsert = vi.fn();
const mockDeleteWhere = vi.fn();
const mockDelete = vi.fn();

const mockDb = {
  select: mockSelect,
  insert: mockInsert,
  delete: mockDelete,
};

// ── Helpers ──

function setupSelectChain(results: unknown[]) {
  mockSelect.mockReturnValue({ from: mockSelectFrom });
  mockSelectFrom.mockImplementation(() =>
    chainablePromise(results, {
      where: mockSelectWhere,
      orderBy: vi.fn().mockImplementation(() => ({
        limit: vi.fn().mockResolvedValue(results),
      })),
    }),
  );
  mockSelectWhere.mockImplementation(() =>
    chainablePromise(results, {
      orderBy: vi.fn().mockImplementation(() => ({
        limit: vi.fn().mockResolvedValue(results),
      })),
    }),
  );
}

function setupInsertChain() {
  mockInsert.mockReturnValue({ values: mockInsertValues });
  mockInsertValues.mockReturnValue({
    onConflictDoNothing: mockInsertOnConflictDoNothing,
  });
  mockInsertOnConflictDoNothing.mockResolvedValue(undefined);
}

function setupDeleteChain() {
  mockDelete.mockReturnValue({ where: mockDeleteWhere });
  mockDeleteWhere.mockResolvedValue(undefined);
}

// ── Test Setup ──

const ctx = setupRouteTest({
  db: mockDb,
  defaultAuth: {
    user: makeMockUser({ id: "admin_user_001" }),
    session: makeMockSession({ userId: "admin_user_001" }),
    roles: ["admin"],
  },
  mocks: () => {
    vi.doMock("../../src/db/schema/user.schema.js", () => ({
      users: {
        id: { name: "id" },
        name: { name: "name" },
        email: { name: "email" },
        emailVerified: { name: "email_verified" },
        image: { name: "image" },
        createdAt: { name: "created_at" },
        updatedAt: { name: "updated_at" },
      },
      userRoles: {
        userId: { name: "user_id" },
        role: { name: "role" },
        createdAt: { name: "created_at" },
      },
      sessions: {},
      accounts: {},
      verifications: {},
    }));
  },
  mountRoute: async (app) => {
    const { adminRoutes } = await import("../../src/routes/admin.routes.js");
    app.route("/api/admin", adminRoutes);
  },
  beforeEach: () => {
    setupInsertChain();
    setupDeleteChain();
  },
});

// ── Tests ──

describe("admin routes", () => {
  // ── GET /api/admin/users ──

  describe("GET /api/admin/users", () => {
    it("returns paginated user list with roles", async () => {
      const dbUser = makeMockDbUser();

      // First call: paginated users query (select → from → where → orderBy → limit)
      // Second call: batch roles query (select → from → where with inArray)
      let callCount = 0;
      mockSelect.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          // Users query
          return {
            from: () => {
              const chain: any = {
                where: vi.fn().mockImplementation(() => chain),
                orderBy: vi.fn().mockImplementation(() => ({
                  limit: vi.fn().mockResolvedValue([dbUser]),
                })),
              };
              return chain;
            },
          };
        }
        // Batch roles query (select userId + role, from userRoles, where inArray)
        return {
          from: () => ({
            where: vi
              .fn()
              .mockResolvedValue([
                { userId: dbUser.id, role: "stakeholder" },
              ]),
          }),
        };
      });

      const res = await ctx.app.request("/api/admin/users?limit=20");
      const body = (await res.json()) as {
        items: unknown[];
        nextCursor: string | null;
      };

      expect(res.status).toBe(200);
      expect(body.items).toHaveLength(1);
      expect(body.nextCursor).toBeNull();
    });

    it("returns empty list when no users", async () => {
      mockSelect.mockReturnValue({ from: mockSelectFrom });
      mockSelectFrom.mockImplementation(() => {
        const chain: any = {
          where: vi.fn().mockImplementation(() => chain),
          orderBy: vi.fn().mockImplementation(() => ({
            limit: vi.fn().mockResolvedValue([]),
          })),
        };
        return chain;
      });

      const res = await ctx.app.request("/api/admin/users");
      const body = (await res.json()) as {
        items: unknown[];
        nextCursor: string | null;
      };

      expect(res.status).toBe(200);
      expect(body.items).toHaveLength(0);
      expect(body.nextCursor).toBeNull();
    });

    it("returns 403 for non-admin user", async () => {
      ctx.auth.roles = [];

      const res = await ctx.app.request("/api/admin/users");

      expect(res.status).toBe(403);
    });

    it("returns 401 for unauthenticated request", async () => {
      ctx.auth.user = null;

      const res = await ctx.app.request("/api/admin/users");

      expect(res.status).toBe(401);
    });
  });

  // ── POST /api/admin/users/:userId/roles ──

  describe("POST /api/admin/users/:userId/roles", () => {
    it("assigns role to user", async () => {
      const targetUser = makeMockDbUser();

      let callCount = 0;
      mockSelect.mockImplementation(() => {
        callCount++;
        if (callCount <= 2) {
          // User exists check + getUserWithRoles user query
          return {
            from: () => ({
              where: vi.fn().mockResolvedValue([targetUser]),
            }),
          };
        }
        // getUserRoles query
        return {
          from: () => ({
            where: vi
              .fn()
              .mockResolvedValue([
                { userId: targetUser.id, role: "stakeholder" },
                { userId: targetUser.id, role: "admin" },
              ]),
          }),
        };
      });

      const res = await ctx.app.request("/api/admin/users/user_target_001/roles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: "stakeholder" }),
      });

      expect(res.status).toBe(200);
      expect(mockInsert).toHaveBeenCalled();
    });

    it("returns 404 when user does not exist", async () => {
      mockSelect.mockReturnValue({
        from: () => ({
          where: vi.fn().mockResolvedValue([]),
        }),
      });

      const res = await ctx.app.request("/api/admin/users/nonexistent/roles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: "stakeholder" }),
      });

      expect(res.status).toBe(404);
    });

    it("returns 400 for invalid role", async () => {
      const res = await ctx.app.request("/api/admin/users/user_target_001/roles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: "superadmin" }),
      });

      expect(res.status).toBe(400);
    });

    it("is idempotent when role already exists", async () => {
      const targetUser = makeMockDbUser();

      let callCount = 0;
      mockSelect.mockImplementation(() => {
        callCount++;
        if (callCount <= 2) {
          return {
            from: () => ({
              where: vi.fn().mockResolvedValue([targetUser]),
            }),
          };
        }
        return {
          from: () => ({
            where: vi
              .fn()
              .mockResolvedValue([{ userId: targetUser.id, role: "stakeholder" }]),
          }),
        };
      });

      const res = await ctx.app.request("/api/admin/users/user_target_001/roles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: "stakeholder" }),
      });

      expect(res.status).toBe(200);
      expect(mockInsertOnConflictDoNothing).toHaveBeenCalled();
    });

    it("returns 403 for non-admin user", async () => {
      ctx.auth.roles = [];

      const res = await ctx.app.request("/api/admin/users/user_target_001/roles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: "stakeholder" }),
      });

      expect(res.status).toBe(403);
    });

    it("returns 401 for unauthenticated request", async () => {
      ctx.auth.user = null;

      const res = await ctx.app.request("/api/admin/users/user_target_001/roles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: "stakeholder" }),
      });

      expect(res.status).toBe(401);
    });
  });

  // ── DELETE /api/admin/users/:userId/roles ──

  describe("DELETE /api/admin/users/:userId/roles", () => {
    it("revokes role from user", async () => {
      const targetUser = makeMockDbUser();

      let callCount = 0;
      mockSelect.mockImplementation(() => {
        callCount++;
        if (callCount <= 2) {
          return {
            from: () => ({
              where: vi.fn().mockResolvedValue([targetUser]),
            }),
          };
        }
        return {
          from: () => ({
            where: vi
              .fn()
              .mockResolvedValue([{ userId: targetUser.id, role: "stakeholder" }]),
          }),
        };
      });

      const res = await ctx.app.request("/api/admin/users/user_target_001/roles", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: "stakeholder" }),
      });

      expect(res.status).toBe(200);
      expect(mockDelete).toHaveBeenCalled();
    });

    it("prevents removing own admin role", async () => {
      const res = await ctx.app.request(
        "/api/admin/users/admin_user_001/roles",
        {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ role: "admin" }),
        },
      );

      expect(res.status).toBe(403);
      const body = (await res.json()) as { error: { message: string } };
      expect(body.error.message).toContain("own admin role");
    });

    it("returns 404 when user does not exist", async () => {
      mockSelect.mockReturnValue({
        from: () => ({
          where: vi.fn().mockResolvedValue([]),
        }),
      });

      const res = await ctx.app.request("/api/admin/users/nonexistent/roles", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: "stakeholder" }),
      });

      expect(res.status).toBe(404);
    });

    it("returns 400 for invalid role", async () => {
      const res = await ctx.app.request("/api/admin/users/user_target_001/roles", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: "superadmin" }),
      });

      expect(res.status).toBe(400);
    });

    it("returns 403 for non-admin user", async () => {
      ctx.auth.roles = [];

      const res = await ctx.app.request("/api/admin/users/user_target_001/roles", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: "stakeholder" }),
      });

      expect(res.status).toBe(403);
    });

    it("returns 401 for unauthenticated request", async () => {
      ctx.auth.user = null;

      const res = await ctx.app.request("/api/admin/users/user_target_001/roles", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: "stakeholder" }),
      });

      expect(res.status).toBe(401);
    });
  });
});
