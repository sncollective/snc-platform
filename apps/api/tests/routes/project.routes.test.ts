import { describe, it, expect, vi } from "vitest";

import { setupRouteTest } from "../helpers/route-test-factory.js";
import { makeMockUser } from "../helpers/auth-fixtures.js";
import {
  makeMockCalendarEvent,
  makeMockProject,
} from "../helpers/calendar-fixtures.js";
import { chainablePromise } from "../helpers/db-mock-utils.js";

// ── Mock DB Chains ──

// SELECT: db.select().from(table).where(...).orderBy(...).limit(...)
// Also: db.select().from(table).leftJoin(...).where(...).orderBy(...).limit(...)
const mockLimit = vi.fn();
const mockOrderBy = vi.fn();
const mockSelectWhere = vi.fn();
const mockLeftJoin = vi.fn();
const mockSelectFrom = vi.fn();
const mockSelect = vi.fn();

// INSERT: db.insert(table).values({}).returning()
const mockInsertReturning = vi.fn();
const mockInsertValues = vi.fn();
const mockInsert = vi.fn();

// UPDATE: db.update(table).set({}).where(...).returning()
const mockUpdateReturning = vi.fn();
const mockUpdateWhere = vi.fn();
const mockUpdateSet = vi.fn();
const mockUpdate = vi.fn();

// DELETE: db.delete(table).where(...)
const mockDeleteWhere = vi.fn();
const mockDelete = vi.fn();

const mockDb = {
  select: mockSelect,
  insert: mockInsert,
  update: mockUpdate,
  delete: mockDelete,
};

// ── Service mock ──

const mockRequireCreatorPermission = vi.fn();

// ── Test Setup ──

const ctx = setupRouteTest({
  db: mockDb,
  defaultAuth: {
    user: makeMockUser(),
    roles: ["stakeholder"],
  },
  mocks: () => {
    vi.doMock("../../src/db/schema/project.schema.js", () => ({
      projects: {
        id: {},
        name: {},
        slug: {},
        description: {},
        creatorId: {},
        createdBy: {},
        completed: {},
        completedAt: {},
        createdAt: {},
        updatedAt: {},
      },
    }));

    vi.doMock("../../src/db/schema/calendar.schema.js", () => ({
      calendarEvents: {
        id: {},
        title: {},
        description: {},
        startAt: {},
        endAt: {},
        allDay: {},
        eventType: {},
        location: {},
        createdBy: {},
        creatorId: {},
        projectId: {},
        deletedAt: {},
        completedAt: {},
        createdAt: {},
        updatedAt: {},
      },
      calendarFeedTokens: {
        id: {},
        userId: {},
        token: {},
        createdAt: {},
      },
      customEventTypes: {
        id: {},
        label: {},
        slug: {},
        createdBy: {},
        createdAt: {},
      },
    }));

    vi.doMock("../../src/db/schema/creator.schema.js", () => ({
      creatorProfiles: { id: {}, displayName: {} },
      creatorMembers: {},
    }));

    vi.doMock("../../src/db/schema/user.schema.js", () => ({
      users: {
        id: {},
        name: {},
        email: {},
        emailVerified: {},
        image: {},
        createdAt: {},
        updatedAt: {},
      },
      sessions: {},
      accounts: {},
      verifications: {},
      userRoles: {},
    }));

    vi.doMock("../../src/services/creator-team.js", () => ({
      requireCreatorPermission: mockRequireCreatorPermission,
      checkCreatorPermission: vi.fn(),
      getCreatorMemberships: vi.fn(),
    }));
  },
  mountRoute: async (app) => {
    const { projectRoutes } = await import(
      "../../src/routes/project.routes.js"
    );
    app.route("/api/projects", projectRoutes);
  },
  beforeEach: () => {
    // SELECT chain with leftJoin support
    // mockSelectWhere uses chainablePromise so it is both directly awaitable
    // (resolves to []) and supports further .orderBy().limit() chaining.
    mockSelect.mockReturnValue({ from: mockSelectFrom });
    mockSelectFrom.mockReturnValue({ leftJoin: mockLeftJoin, where: mockSelectWhere });
    mockLeftJoin.mockReturnValue({ leftJoin: mockLeftJoin, where: mockSelectWhere });
    mockSelectWhere.mockImplementation(() =>
      chainablePromise([], { orderBy: mockOrderBy }),
    );
    mockOrderBy.mockReturnValue({ limit: mockLimit });
    mockLimit.mockResolvedValue([]);

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
    mockDeleteWhere.mockResolvedValue(undefined);

    // Permission check: allowed by default
    mockRequireCreatorPermission.mockResolvedValue(undefined);
  },
});

// ── Tests ──

describe("project routes", () => {
  // ── GET /api/projects ──

  describe("GET /api/projects", () => {
    it("returns paginated list of projects", async () => {
      const project = makeMockProject();
      mockLimit.mockResolvedValue([project]);

      const res = await ctx.app.request("/api/projects");
      const body = (await res.json()) as { items: unknown[]; nextCursor: string | null };

      expect(res.status).toBe(200);
      expect(body.items).toHaveLength(1);
      expect((body.items[0] as { id: string }).id).toBe(project.id);
      expect(body.nextCursor).toBeNull();
    });

    it("returns empty array when no projects", async () => {
      const res = await ctx.app.request("/api/projects");
      const body = (await res.json()) as { items: unknown[] };

      expect(res.status).toBe(200);
      expect(body.items).toHaveLength(0);
    });

    it("returns 401 when unauthenticated", async () => {
      ctx.auth.user = null;

      const res = await ctx.app.request("/api/projects");

      expect(res.status).toBe(401);
    });

    it("returns 403 for non-stakeholder", async () => {
      ctx.auth.roles = [];

      const res = await ctx.app.request("/api/projects");

      expect(res.status).toBe(403);
    });
  });

  // ── GET /api/projects/:id ──

  describe("GET /api/projects/:id", () => {
    it("returns single project", async () => {
      const project = makeMockProject();
      mockSelectWhere.mockResolvedValue([project]);

      const res = await ctx.app.request("/api/projects/proj_test001");
      const body = (await res.json()) as { project: { id: string } };

      expect(res.status).toBe(200);
      expect(body.project.id).toBe(project.id);
    });

    it("returns 404 for non-existent project", async () => {
      mockSelectWhere.mockResolvedValue([]);

      const res = await ctx.app.request("/api/projects/nonexistent");

      expect(res.status).toBe(404);
    });

    it("returns 401 when unauthenticated", async () => {
      ctx.auth.user = null;

      const res = await ctx.app.request("/api/projects/proj_test001");

      expect(res.status).toBe(401);
    });
  });

  // ── POST /api/projects ──

  describe("POST /api/projects", () => {
    it("creates project and returns 201", async () => {
      const project = makeMockProject();
      mockInsertReturning.mockResolvedValue([project]);

      const res = await ctx.app.request("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "New Album" }),
      });
      const body = (await res.json()) as { project: { id: string; name: string } };

      expect(res.status).toBe(201);
      expect(body.project.id).toBe(project.id);
      expect(body.project.name).toBe("New Album");
    });

    it("returns 400 for missing name", async () => {
      const res = await ctx.app.request("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      expect(res.status).toBe(400);
    });

    it("returns 401 when unauthenticated", async () => {
      ctx.auth.user = null;

      const res = await ctx.app.request("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "New Album" }),
      });

      expect(res.status).toBe(401);
    });

    it("returns 403 for non-stakeholder", async () => {
      ctx.auth.roles = [];

      const res = await ctx.app.request("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "New Album" }),
      });

      expect(res.status).toBe(403);
    });

    it("returns 403 when user lacks creator permission for creator-scoped project", async () => {
      const { ForbiddenError } = await import("@snc/shared");
      mockRequireCreatorPermission.mockRejectedValueOnce(
        new ForbiddenError("Missing creator permission: manageScheduling"),
      );

      const res = await ctx.app.request("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Creator Album", creatorId: "creator_1" }),
      });

      expect(res.status).toBe(403);
    });
  });

  // ── PATCH /api/projects/:id ──

  describe("PATCH /api/projects/:id", () => {
    it("updates project name", async () => {
      const project = makeMockProject();
      const updated = makeMockProject({ name: "Updated Name" });

      mockSelectWhere.mockResolvedValueOnce([project]);
      mockUpdateReturning.mockResolvedValue([updated]);

      const res = await ctx.app.request("/api/projects/proj_test001", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Updated Name" }),
      });
      const body = (await res.json()) as { project: { name: string } };

      expect(res.status).toBe(200);
      expect(body.project.name).toBe("Updated Name");
    });

    it("marks project as completed and sets completedAt", async () => {
      const project = makeMockProject();
      const completed = makeMockProject({
        completed: true,
        completedAt: new Date("2026-03-19T12:00:00.000Z"),
      });

      mockSelectWhere.mockResolvedValueOnce([project]);
      mockUpdateReturning.mockResolvedValue([completed]);

      const res = await ctx.app.request("/api/projects/proj_test001", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completed: true }),
      });
      const body = (await res.json()) as { project: { completed: boolean; completedAt: string | null } };

      expect(res.status).toBe(200);
      expect(body.project.completed).toBe(true);
      expect(body.project.completedAt).toBeTruthy();
    });

    it("reopens project and clears completedAt", async () => {
      const completed = makeMockProject({
        completed: true,
        completedAt: new Date("2026-03-19T12:00:00.000Z"),
      });
      const reopened = makeMockProject({ completed: false, completedAt: null });

      mockSelectWhere.mockResolvedValueOnce([completed]);
      mockUpdateReturning.mockResolvedValue([reopened]);

      const res = await ctx.app.request("/api/projects/proj_test001", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completed: false }),
      });
      const body = (await res.json()) as { project: { completed: boolean; completedAt: string | null } };

      expect(res.status).toBe(200);
      expect(body.project.completed).toBe(false);
      expect(body.project.completedAt).toBeNull();
    });

    it("returns 404 for non-existent project", async () => {
      mockSelectWhere.mockResolvedValue([]);

      const res = await ctx.app.request("/api/projects/nonexistent", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Updated" }),
      });

      expect(res.status).toBe(404);
    });

    it("returns 401 when unauthenticated", async () => {
      ctx.auth.user = null;

      const res = await ctx.app.request("/api/projects/proj_test001", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Updated" }),
      });

      expect(res.status).toBe(401);
    });
  });

  // ── DELETE /api/projects/:id ──

  describe("DELETE /api/projects/:id", () => {
    it("deletes project and returns 204", async () => {
      const project = makeMockProject();
      mockSelectWhere.mockResolvedValueOnce([project]);

      const res = await ctx.app.request("/api/projects/proj_test001", {
        method: "DELETE",
      });

      expect(res.status).toBe(204);
    });

    it("returns 404 for non-existent project", async () => {
      mockSelectWhere.mockResolvedValue([]);

      const res = await ctx.app.request("/api/projects/nonexistent", {
        method: "DELETE",
      });

      expect(res.status).toBe(404);
    });

    it("returns 401 when unauthenticated", async () => {
      ctx.auth.user = null;

      const res = await ctx.app.request("/api/projects/proj_test001", {
        method: "DELETE",
      });

      expect(res.status).toBe(401);
    });

    it("returns 403 for non-stakeholder", async () => {
      ctx.auth.roles = [];

      const res = await ctx.app.request("/api/projects/proj_test001", {
        method: "DELETE",
      });

      expect(res.status).toBe(403);
    });
  });

  // ── GET /api/projects/:id/events ──

  describe("GET /api/projects/:id/events", () => {
    it("returns project timeline events", async () => {
      const project = makeMockProject();
      const event = makeMockCalendarEvent({ projectId: project.id });

      // Project lookup
      mockSelectWhere.mockResolvedValueOnce([project]);
      // Events query via leftJoin
      mockLimit.mockResolvedValueOnce([{ event, projectName: project.name }]);

      const res = await ctx.app.request("/api/projects/proj_test001/events");
      const body = (await res.json()) as { items: unknown[]; nextCursor: string | null };

      expect(res.status).toBe(200);
      expect(body.items).toHaveLength(1);
      expect((body.items[0] as { id: string }).id).toBe(event.id);
    });

    it("includes completedAt in event response", async () => {
      const project = makeMockProject();
      const event = makeMockCalendarEvent({ projectId: project.id, completedAt: null });

      mockSelectWhere.mockResolvedValueOnce([project]);
      mockLimit.mockResolvedValueOnce([{ event, projectName: project.name }]);

      const res = await ctx.app.request("/api/projects/proj_test001/events");
      const body = (await res.json()) as { items: Array<{ completedAt: string | null }> };

      expect(res.status).toBe(200);
      expect(body.items[0]!.completedAt).toBeNull();
    });

    it("returns 404 for non-existent project", async () => {
      mockSelectWhere.mockResolvedValue([]);

      const res = await ctx.app.request("/api/projects/nonexistent/events");

      expect(res.status).toBe(404);
    });

    it("returns 401 when unauthenticated", async () => {
      ctx.auth.user = null;

      const res = await ctx.app.request("/api/projects/proj_test001/events");

      expect(res.status).toBe(401);
    });
  });
});
