import { describe, it, expect, vi } from "vitest";

import { setupRouteTest } from "../helpers/route-test-factory.js";
import { makeMockUser } from "../helpers/auth-fixtures.js";
import {
  makeMockCalendarEvent,
  makeMockFeedToken,
} from "../helpers/calendar-fixtures.js";
import { chainablePromise } from "../helpers/db-mock-utils.js";

// ── Mock DB Chains ──

// SELECT with leftJoin: db.select().from(table).leftJoin(...).where(...).orderBy(...).limit(...)
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

// ── Helper to wrap a DB row for leftJoin shape ──

const wrapEventRow = (event: ReturnType<typeof makeMockCalendarEvent>) => ({
  event,
  projectName: null,
});

// ── Test Setup ──

const ctx = setupRouteTest({
  db: mockDb,
  defaultAuth: {
    user: makeMockUser(),
    roles: ["stakeholder"],
  },
  mocks: () => {
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
  },
  mountRoute: async (app) => {
    const { calendarRoutes } = await import(
      "../../src/routes/calendar.routes.js"
    );
    app.route("/api/calendar", calendarRoutes);
  },
  beforeEach: () => {
    // SELECT chain with leftJoin support
    mockSelect.mockReturnValue({ from: mockSelectFrom });
    mockSelectFrom.mockReturnValue({ leftJoin: mockLeftJoin, where: mockSelectWhere });
    mockLeftJoin.mockReturnValue({ where: mockSelectWhere });
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
  },
});

// ── Tests ──

describe("calendar routes", () => {
  // ── GET /api/calendar/events ──

  describe("GET /api/calendar/events", () => {
    it("returns events list", async () => {
      const event = makeMockCalendarEvent();
      mockLimit.mockResolvedValue([wrapEventRow(event)]);

      const res = await ctx.app.request("/api/calendar/events");
      const body = (await res.json()) as { items: unknown[] };

      expect(res.status).toBe(200);
      expect(body.items).toHaveLength(1);
      expect((body.items[0] as { id: string }).id).toBe(event.id);
    });

    it("returns empty array when no events", async () => {
      const res = await ctx.app.request("/api/calendar/events");
      const body = (await res.json()) as { items: unknown[] };

      expect(res.status).toBe(200);
      expect(body.items).toHaveLength(0);
    });

    it("returns 401 when unauthenticated", async () => {
      ctx.auth.user = null;

      const res = await ctx.app.request("/api/calendar/events");

      expect(res.status).toBe(401);
    });

    it("returns 403 for non-stakeholder", async () => {
      ctx.auth.roles = [];

      const res = await ctx.app.request("/api/calendar/events");

      expect(res.status).toBe(403);
    });
  });

  // ── GET /api/calendar/events/:id ──

  describe("GET /api/calendar/events/:id", () => {
    it("returns single event", async () => {
      const event = makeMockCalendarEvent();
      mockSelectWhere.mockResolvedValue([wrapEventRow(event)]);

      const res = await ctx.app.request("/api/calendar/events/evt_test001");
      const body = (await res.json()) as { event: { id: string } };

      expect(res.status).toBe(200);
      expect(body.event.id).toBe(event.id);
    });

    it("returns 404 for non-existent event", async () => {
      mockSelectWhere.mockResolvedValue([]);

      const res = await ctx.app.request("/api/calendar/events/nonexistent");

      expect(res.status).toBe(404);
    });

    it("returns 401 when unauthenticated", async () => {
      ctx.auth.user = null;

      const res = await ctx.app.request("/api/calendar/events/evt_test001");

      expect(res.status).toBe(401);
    });
  });

  // ── POST /api/calendar/events ──

  describe("POST /api/calendar/events", () => {
    it("creates event and returns 201", async () => {
      const event = makeMockCalendarEvent();
      mockInsertReturning.mockResolvedValue([event]);

      const res = await ctx.app.request("/api/calendar/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "Recording Session",
          startAt: "2026-03-20T14:00:00.000Z",
          eventType: "recording-session",
        }),
      });
      const body = (await res.json()) as { event: { id: string; title: string } };

      expect(res.status).toBe(201);
      expect(body.event.id).toBe(event.id);
      expect(body.event.title).toBe("Recording Session");
    });

    it("returns 401 when unauthenticated", async () => {
      ctx.auth.user = null;

      const res = await ctx.app.request("/api/calendar/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "Event",
          startAt: "2026-03-20T14:00:00.000Z",
          eventType: "meeting",
        }),
      });

      expect(res.status).toBe(401);
    });

    it("returns 400 for missing title", async () => {
      const res = await ctx.app.request("/api/calendar/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startAt: "2026-03-20T14:00:00.000Z",
          eventType: "meeting",
        }),
      });

      expect(res.status).toBe(400);
    });

    it("returns 400 for missing eventType", async () => {
      const res = await ctx.app.request("/api/calendar/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "Event",
          startAt: "2026-03-20T14:00:00.000Z",
        }),
      });

      expect(res.status).toBe(400);
    });

    it("returns 403 for non-stakeholder", async () => {
      ctx.auth.roles = [];

      const res = await ctx.app.request("/api/calendar/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "Event",
          startAt: "2026-03-20T14:00:00.000Z",
          eventType: "meeting",
        }),
      });

      expect(res.status).toBe(403);
    });
  });

  // ── PATCH /api/calendar/events/:id ──

  describe("PATCH /api/calendar/events/:id", () => {
    it("updates event and returns updated", async () => {
      const event = makeMockCalendarEvent();
      const updated = makeMockCalendarEvent({ title: "Updated Title" });

      // First select: existence check via leftJoin chain
      mockSelectWhere.mockResolvedValueOnce([wrapEventRow(event)]);
      // Update resolves (no returning)
      // Second select: re-fetch with leftJoin after update
      mockSelectWhere.mockResolvedValueOnce([wrapEventRow(updated)]);

      const res = await ctx.app.request("/api/calendar/events/evt_test001", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Updated Title" }),
      });
      const body = (await res.json()) as { event: { title: string } };

      expect(res.status).toBe(200);
      expect(body.event.title).toBe("Updated Title");
    });

    it("returns 404 for non-existent event", async () => {
      mockSelectWhere.mockResolvedValue([]);

      const res = await ctx.app.request("/api/calendar/events/nonexistent", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Updated" }),
      });

      expect(res.status).toBe(404);
    });

    it("returns 401 when unauthenticated", async () => {
      ctx.auth.user = null;

      const res = await ctx.app.request("/api/calendar/events/evt_test001", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Updated" }),
      });

      expect(res.status).toBe(401);
    });
  });

  // ── DELETE /api/calendar/events/:id ──

  describe("DELETE /api/calendar/events/:id", () => {
    it("soft-deletes event and returns 204", async () => {
      const event = makeMockCalendarEvent();
      mockSelectWhere.mockResolvedValueOnce([event]);

      const res = await ctx.app.request("/api/calendar/events/evt_test001", {
        method: "DELETE",
      });

      expect(res.status).toBe(204);
    });

    it("returns 404 for non-existent event", async () => {
      mockSelectWhere.mockResolvedValue([]);

      const res = await ctx.app.request("/api/calendar/events/nonexistent", {
        method: "DELETE",
      });

      expect(res.status).toBe(404);
    });

    it("returns 401 when unauthenticated", async () => {
      ctx.auth.user = null;

      const res = await ctx.app.request("/api/calendar/events/evt_test001", {
        method: "DELETE",
      });

      expect(res.status).toBe(401);
    });

    it("returns 403 for non-stakeholder", async () => {
      ctx.auth.roles = [];

      const res = await ctx.app.request("/api/calendar/events/evt_test001", {
        method: "DELETE",
      });

      expect(res.status).toBe(403);
    });
  });

  // ── POST /api/calendar/feed-token ──

  describe("POST /api/calendar/feed-token", () => {
    it("generates feed token and returns URL", async () => {
      const res = await ctx.app.request("/api/calendar/feed-token", {
        method: "POST",
      });
      const body = (await res.json()) as { token: string; url: string };

      expect(res.status).toBe(200);
      expect(body.token).toBeTruthy();
      expect(body.url).toContain(body.token);
    });

    it("returns 401 when unauthenticated", async () => {
      ctx.auth.user = null;

      const res = await ctx.app.request("/api/calendar/feed-token", {
        method: "POST",
      });

      expect(res.status).toBe(401);
    });

    it("returns 403 for non-stakeholder", async () => {
      ctx.auth.roles = [];

      const res = await ctx.app.request("/api/calendar/feed-token", {
        method: "POST",
      });

      expect(res.status).toBe(403);
    });
  });

  // ── GET /api/calendar/feed-token ──

  describe("GET /api/calendar/feed-token", () => {
    it("returns existing feed token", async () => {
      const token = makeMockFeedToken();
      mockSelectWhere.mockResolvedValue([token]);

      const res = await ctx.app.request("/api/calendar/feed-token");
      const body = (await res.json()) as { token: string; url: string };

      expect(res.status).toBe(200);
      expect(body.token).toBe(token.token);
      expect(body.url).toContain(token.token);
    });

    it("returns 404 when no token exists", async () => {
      mockSelectWhere.mockResolvedValue([]);

      const res = await ctx.app.request("/api/calendar/feed-token");

      expect(res.status).toBe(404);
    });

    it("returns 401 when unauthenticated", async () => {
      ctx.auth.user = null;

      const res = await ctx.app.request("/api/calendar/feed-token");

      expect(res.status).toBe(401);
    });
  });

  // ── GET /api/calendar/feed.ics ──

  describe("GET /api/calendar/feed.ics", () => {
    it("returns 401 when token is missing", async () => {
      const res = await ctx.app.request("/api/calendar/feed.ics");

      expect(res.status).toBe(401);
    });

    it("returns 401 for invalid token", async () => {
      mockSelectWhere.mockResolvedValue([]);

      const res = await ctx.app.request(
        "/api/calendar/feed.ics?token=invalid",
      );

      expect(res.status).toBe(401);
    });

    it("returns .ics content for valid token", async () => {
      const token = makeMockFeedToken();
      const event = makeMockCalendarEvent();

      // Token lookup
      mockSelectWhere.mockResolvedValueOnce([token]);
      // Events query (no leftJoin in feed.ics)
      mockOrderBy.mockResolvedValueOnce([event]);

      const res = await ctx.app.request(
        `/api/calendar/feed.ics?token=${token.token}`,
      );

      expect(res.status).toBe(200);
      const contentType = res.headers.get("content-type");
      expect(contentType).toContain("text/calendar");

      const text = await res.text();
      expect(text).toContain("BEGIN:VCALENDAR");
      expect(text).toContain("Recording Session");
      expect(text).toContain("END:VCALENDAR");
    });
  });
});
