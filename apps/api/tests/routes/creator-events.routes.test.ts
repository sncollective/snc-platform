import { describe, it, expect, vi } from "vitest";

import { setupRouteTest } from "../helpers/route-test-factory.js";
import { makeMockUser } from "../helpers/auth-fixtures.js";
import { makeMockCalendarEvent } from "../helpers/calendar-fixtures.js";
import { chainablePromise } from "../helpers/db-mock-utils.js";

// ── Mock DB Chains ──

// SELECT: db.select().from(table).where(...).orderBy(...).limit(...)
const mockLimit = vi.fn();
const mockOrderBy = vi.fn();
const mockSelectWhere = vi.fn();
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
  mocks: ({ ForbiddenError }) => {
    vi.doMock("../../src/db/schema/calendar.schema.js", () => ({
      calendarEvents: {
        id: {},
        title: {},
        description: {},
        startAt: {},
        endAt: {},
        allDay: {},
        category: {},
        location: {},
        createdBy: {},
        creatorId: {},
        deletedAt: {},
        createdAt: {},
        updatedAt: {},
      },
    }));

    vi.doMock("../../src/db/schema/creator.schema.js", () => ({
      creatorProfiles: { id: {} },
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
    const { creatorEventRoutes } = await import(
      "../../src/routes/creator-events.routes.js"
    );
    app.route("/api/creators", creatorEventRoutes);
  },
  beforeEach: () => {
    // SELECT chain
    mockSelect.mockReturnValue({ from: mockSelectFrom });
    mockSelectFrom.mockReturnValue({ where: mockSelectWhere });
    mockSelectWhere.mockReturnValue({ orderBy: mockOrderBy });
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

describe("creator event routes", () => {
  // ── GET /api/creators/:creatorId/events ──

  describe("GET /:creatorId/events", () => {
    it("returns paginated events for the creator", async () => {
      const event = makeMockCalendarEvent({ creatorId: "creator_1" });

      // Creator lookup resolves to a creator
      mockSelectWhere.mockResolvedValueOnce([{ id: "creator_1" }]);
      // Events query returns events via limit
      mockLimit.mockResolvedValueOnce([event]);

      const res = await ctx.app.request(
        "/api/creators/creator_1/events",
      );
      const body = (await res.json()) as { items: unknown[]; nextCursor: string | null };

      expect(res.status).toBe(200);
      expect(body.items).toHaveLength(1);
      expect((body.items[0] as { id: string }).id).toBe(event.id);
      expect(body.nextCursor).toBeNull();
    });

    it("returns 404 for non-existent creator", async () => {
      // Creator lookup returns empty
      mockSelectWhere.mockResolvedValueOnce([]);

      const res = await ctx.app.request(
        "/api/creators/nonexistent/events",
      );

      expect(res.status).toBe(404);
    });

    it("returns 401 when unauthenticated", async () => {
      ctx.auth.user = null;

      const res = await ctx.app.request(
        "/api/creators/creator_1/events",
      );

      expect(res.status).toBe(401);
    });

    it("returns 403 for non-stakeholder", async () => {
      ctx.auth.roles = [];

      const res = await ctx.app.request(
        "/api/creators/creator_1/events",
      );

      expect(res.status).toBe(403);
    });
  });

  // ── POST /api/creators/:creatorId/events ──

  describe("POST /:creatorId/events", () => {
    it("creates event with creatorId set and returns 201", async () => {
      const event = makeMockCalendarEvent({ creatorId: "creator_1" });

      // Creator lookup
      mockSelectWhere.mockResolvedValueOnce([{ id: "creator_1" }]);
      // Insert returning
      mockInsertReturning.mockResolvedValue([event]);

      const res = await ctx.app.request(
        "/api/creators/creator_1/events",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: "Recording Session",
            startAt: "2026-03-20T14:00:00.000Z",
            category: "recording-session",
          }),
        },
      );
      const body = (await res.json()) as { event: { id: string; creatorId: string } };

      expect(res.status).toBe(201);
      expect(body.event.id).toBe(event.id);
      expect(body.event.creatorId).toBe("creator_1");
    });

    it("returns 403 when user lacks manageScheduling permission", async () => {
      const { ForbiddenError } = await import("@snc/shared");

      // Creator lookup
      mockSelectWhere.mockResolvedValueOnce([{ id: "creator_1" }]);
      mockRequireCreatorPermission.mockRejectedValueOnce(
        new ForbiddenError("Missing creator permission: manageScheduling"),
      );

      const res = await ctx.app.request(
        "/api/creators/creator_1/events",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: "Recording Session",
            startAt: "2026-03-20T14:00:00.000Z",
            category: "recording-session",
          }),
        },
      );

      expect(res.status).toBe(403);
    });

    it("returns 404 for non-existent creator", async () => {
      // Creator lookup returns empty
      mockSelectWhere.mockResolvedValueOnce([]);

      const res = await ctx.app.request(
        "/api/creators/nonexistent/events",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: "Recording Session",
            startAt: "2026-03-20T14:00:00.000Z",
            category: "recording-session",
          }),
        },
      );

      expect(res.status).toBe(404);
    });
  });

  // ── PATCH /api/creators/:creatorId/events/:eventId ──

  describe("PATCH /:creatorId/events/:eventId", () => {
    it("updates event fields", async () => {
      const event = makeMockCalendarEvent({ creatorId: "creator_1" });
      const updated = makeMockCalendarEvent({
        creatorId: "creator_1",
        title: "Updated Title",
      });

      // findActiveEvent select
      mockSelectWhere.mockResolvedValueOnce([event]);
      // Update returning
      mockUpdateReturning.mockResolvedValue([updated]);

      const res = await ctx.app.request(
        "/api/creators/creator_1/events/evt_test001",
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: "Updated Title" }),
        },
      );
      const body = (await res.json()) as { event: { title: string } };

      expect(res.status).toBe(200);
      expect(body.event.title).toBe("Updated Title");
    });

    it("returns 404 when event belongs to different creator", async () => {
      // findActiveEvent returns empty (event not found for this creator)
      mockSelectWhere.mockResolvedValueOnce([]);

      const res = await ctx.app.request(
        "/api/creators/creator_1/events/evt_other",
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: "Updated" }),
        },
      );

      expect(res.status).toBe(404);
    });

    it("returns 403 when user lacks manageScheduling permission", async () => {
      const { ForbiddenError } = await import("@snc/shared");

      mockRequireCreatorPermission.mockRejectedValueOnce(
        new ForbiddenError("Missing creator permission: manageScheduling"),
      );

      const res = await ctx.app.request(
        "/api/creators/creator_1/events/evt_test001",
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: "Updated" }),
        },
      );

      expect(res.status).toBe(403);
    });
  });

  // ── DELETE /api/creators/:creatorId/events/:eventId ──

  describe("DELETE /:creatorId/events/:eventId", () => {
    it("soft-deletes event and returns 204", async () => {
      const event = makeMockCalendarEvent({ creatorId: "creator_1" });

      // findActiveEvent
      mockSelectWhere.mockResolvedValueOnce([event]);

      const res = await ctx.app.request(
        "/api/creators/creator_1/events/evt_test001",
        { method: "DELETE" },
      );

      expect(res.status).toBe(204);
    });

    it("returns 404 for non-existent event", async () => {
      // findActiveEvent returns empty
      mockSelectWhere.mockResolvedValueOnce([]);

      const res = await ctx.app.request(
        "/api/creators/creator_1/events/nonexistent",
        { method: "DELETE" },
      );

      expect(res.status).toBe(404);
    });

    it("returns 403 when user lacks manageScheduling permission", async () => {
      const { ForbiddenError } = await import("@snc/shared");

      mockRequireCreatorPermission.mockRejectedValueOnce(
        new ForbiddenError("Missing creator permission: manageScheduling"),
      );

      const res = await ctx.app.request(
        "/api/creators/creator_1/events/evt_test001",
        { method: "DELETE" },
      );

      expect(res.status).toBe(403);
    });
  });
});
