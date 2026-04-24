import { describe, it, expect, vi } from "vitest";

import { setupRouteTest } from "../helpers/route-test-factory.js";
import { makeMockUser } from "../helpers/auth-fixtures.js";
import { makeMockCalendarEvent } from "../helpers/calendar-fixtures.js";
import { chainablePromise } from "../helpers/db-mock-utils.js";

// ── Mock DB Chains ──

// SELECT with leftJoin: db.select().from(table).leftJoin(...).leftJoin(...).where(...).orderBy(...).limit(...)
const mockLimit = vi.fn();
const mockOrderBy = vi.fn();
const mockSelectWhere = vi.fn();
const mockLeftJoin2 = vi.fn();
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

// ── Helper to wrap a DB row for leftJoin shape ──

const wrapEventRow = (event: ReturnType<typeof makeMockCalendarEvent>) => ({
  event,
  projectName: null,
  creatorName: null,
});

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
        eventType: {},
        location: {},
        visibility: {},
        createdBy: {},
        creatorId: {},
        projectId: {},
        deletedAt: {},
        createdAt: {},
        updatedAt: {},
      },
      customEventTypes: {
        id: {},
        label: {},
        slug: {},
        createdBy: {},
        createdAt: {},
      },
    }));

    vi.doMock("../../src/db/schema/project.schema.js", () => ({
      projects: {
        id: {},
        name: {},
        description: {},
        creatorId: {},
        createdBy: {},
        completed: {},
        completedAt: {},
        createdAt: {},
        updatedAt: {},
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
    const { creatorEventRoutes } = await import(
      "../../src/routes/creator-events.routes.js"
    );
    app.route("/api/creators", creatorEventRoutes);
  },
  beforeEach: () => {
    // SELECT chain with leftJoin support (two leftJoins: projects + creatorProfiles)
    mockSelect.mockReturnValue({ from: mockSelectFrom });
    mockSelectFrom.mockReturnValue({ leftJoin: mockLeftJoin, where: mockSelectWhere });
    mockLeftJoin.mockReturnValue({ leftJoin: mockLeftJoin2, where: mockSelectWhere });
    mockLeftJoin2.mockReturnValue({ where: mockSelectWhere });
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

      // Creator lookup resolves to a creator (uses .where directly)
      mockSelectWhere.mockResolvedValueOnce([{ id: "creator_1" }]);
      // Events query returns events via limit (uses leftJoin chain)
      mockLimit.mockResolvedValueOnce([wrapEventRow(event)]);

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

    it("filters events by projectId when provided", async () => {
      const matchingEvent = makeMockCalendarEvent({
        creatorId: "creator_1",
        projectId: "proj_test001",
      });
      const otherEvent = makeMockCalendarEvent({
        id: "evt_test002",
        creatorId: "creator_1",
        projectId: "proj_other",
      });

      // Creator lookup
      mockSelectWhere.mockResolvedValueOnce([{ id: "creator_1" }]);
      // Events query — only return the matching event (projectId filter applied by DB)
      mockLimit.mockResolvedValueOnce([wrapEventRow(matchingEvent)]);

      const res = await ctx.app.request(
        "/api/creators/creator_1/events?projectId=proj_test001",
      );
      const body = (await res.json()) as { items: unknown[] };

      expect(res.status).toBe(200);
      expect(body.items).toHaveLength(1);
      expect((body.items[0] as { projectId: string | null }).projectId).toBe("proj_test001");
      // Verify the other event is not present
      expect(body.items.find((i) => (i as { id: string }).id === otherEvent.id)).toBeUndefined();
    });

    it("returns all events when no projectId is provided", async () => {
      const event1 = makeMockCalendarEvent({ id: "evt_1", creatorId: "creator_1" });
      const event2 = makeMockCalendarEvent({
        id: "evt_2",
        creatorId: "creator_1",
        projectId: "proj_test001",
      });

      // Creator lookup
      mockSelectWhere.mockResolvedValueOnce([{ id: "creator_1" }]);
      // Events query — returns both events
      mockLimit.mockResolvedValueOnce([wrapEventRow(event1), wrapEventRow(event2)]);

      const res = await ctx.app.request(
        "/api/creators/creator_1/events",
      );
      const body = (await res.json()) as { items: unknown[] };

      expect(res.status).toBe(200);
      expect(body.items).toHaveLength(2);
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
            eventType: "recording-session",
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
            eventType: "recording-session",
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
            eventType: "recording-session",
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

      // findActiveEvent select (uses .where directly — no leftJoin)
      mockSelectWhere.mockResolvedValueOnce([event]);
      // Update resolves (no returning)
      // Re-fetch with leftJoin after update
      mockSelectWhere.mockResolvedValueOnce([wrapEventRow(updated)]);

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

    it("persists visibility change to the DB", async () => {
      const event = makeMockCalendarEvent({ creatorId: "creator_1" });
      const updated = makeMockCalendarEvent({
        creatorId: "creator_1",
        visibility: "public",
      });

      mockSelectWhere.mockResolvedValueOnce([event]);
      mockSelectWhere.mockResolvedValueOnce([wrapEventRow(updated)]);

      const res = await ctx.app.request(
        "/api/creators/creator_1/events/evt_test001",
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ visibility: "public" }),
        },
      );

      expect(res.status).toBe(200);
      expect(mockUpdateSet).toHaveBeenCalledWith(
        expect.objectContaining({ visibility: "public" }),
      );
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

      // findActiveEvent (uses .where directly — no leftJoin)
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
