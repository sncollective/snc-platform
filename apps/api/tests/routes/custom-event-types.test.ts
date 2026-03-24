import { describe, it, expect, vi } from "vitest";

import { setupRouteTest } from "../helpers/route-test-factory.js";
import { makeMockUser } from "../helpers/auth-fixtures.js";
import { chainablePromise } from "../helpers/db-mock-utils.js";

// ── Mock DB Chains ──

const mockLimit = vi.fn();
const mockOrderBy = vi.fn();
const mockSelectWhere = vi.fn();
const mockSelectFrom = vi.fn();
const mockSelect = vi.fn();

const mockInsertReturning = vi.fn();
const mockInsertValues = vi.fn();
const mockInsert = vi.fn();

const mockUpdateReturning = vi.fn();
const mockUpdateWhere = vi.fn();
const mockUpdateSet = vi.fn();
const mockUpdate = vi.fn();

const mockDeleteWhere = vi.fn();
const mockDelete = vi.fn();

const mockDb = {
  select: mockSelect,
  insert: mockInsert,
  update: mockUpdate,
  delete: mockDelete,
};

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
    const { calendarEventTypeRoutes } = await import(
      "../../src/routes/calendar-event-types.routes.js"
    );
    app.route("/api/calendar", calendarEventTypeRoutes);
  },
  beforeEach: () => {
    // SELECT chain (no leftJoin needed for event types)
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
  },
});

// ── Tests ──

describe("custom event types endpoints", () => {
  // ── GET /api/calendar/event-types ──

  describe("GET /api/calendar/event-types", () => {
    it("returns defaults when no custom types exist", async () => {
      // select().from() returns empty array (no custom types)
      mockSelectFrom.mockResolvedValueOnce([]);

      const res = await ctx.app.request("/api/calendar/event-types");
      const body = (await res.json()) as { items: Array<{ slug: string; label: string }> };

      expect(res.status).toBe(200);
      expect(body.items.length).toBeGreaterThan(0);
      const slugs = body.items.map((i) => i.slug);
      expect(slugs).toContain("recording-session");
      expect(slugs).toContain("show");
      expect(slugs).toContain("meeting");
    });

    it("returns custom types merged with defaults", async () => {
      const customRow = {
        id: "ct_001",
        label: "Album Launch",
        slug: "album-launch",
        createdBy: "user_test123",
        createdAt: new Date("2026-03-15T10:00:00.000Z"),
      };
      mockSelectFrom.mockResolvedValueOnce([customRow]);

      const res = await ctx.app.request("/api/calendar/event-types");
      const body = (await res.json()) as { items: Array<{ slug: string }> };

      expect(res.status).toBe(200);
      const slugs = body.items.map((i) => i.slug);
      expect(slugs).toContain("recording-session");
      expect(slugs).toContain("album-launch");
    });

    it("returns 401 when unauthenticated", async () => {
      ctx.auth.user = null;

      const res = await ctx.app.request("/api/calendar/event-types");

      expect(res.status).toBe(401);
    });

    it("returns 403 for non-stakeholder", async () => {
      ctx.auth.roles = [];

      const res = await ctx.app.request("/api/calendar/event-types");

      expect(res.status).toBe(403);
    });
  });

  // ── POST /api/calendar/event-types ──

  describe("POST /api/calendar/event-types", () => {
    it("creates custom event type and returns 201", async () => {
      // No existing slug in DB
      mockSelectWhere.mockResolvedValueOnce([]);

      const created = {
        id: "ct_002",
        label: "Album Launch",
        slug: "album-launch",
        createdBy: "user_test123",
        createdAt: new Date("2026-03-19T10:00:00.000Z"),
      };
      mockInsertReturning.mockResolvedValue([created]);

      const res = await ctx.app.request("/api/calendar/event-types", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: "Album Launch" }),
      });
      const body = (await res.json()) as { items: Array<{ slug: string; label: string }> };

      expect(res.status).toBe(201);
      expect(body.items[0]?.slug).toBe("album-launch");
      expect(body.items[0]?.label).toBe("Album Launch");
    });

    it("returns 409 when slug conflicts with existing custom type", async () => {
      // Existing row with same slug in DB
      mockSelectWhere.mockResolvedValueOnce([
        {
          id: "ct_existing",
          label: "Album Launch",
          slug: "album-launch",
          createdBy: "user_other",
          createdAt: new Date(),
        },
      ]);

      const res = await ctx.app.request("/api/calendar/event-types", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: "Album Launch" }),
      });

      expect(res.status).toBe(409);
    });

    it("returns 409 when slug conflicts with a default type", async () => {
      const res = await ctx.app.request("/api/calendar/event-types", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: "Recording Session" }),
      });

      expect(res.status).toBe(409);
    });

    it("returns 400 for empty label", async () => {
      const res = await ctx.app.request("/api/calendar/event-types", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: "" }),
      });

      expect(res.status).toBe(400);
    });

    it("returns 401 when unauthenticated", async () => {
      ctx.auth.user = null;

      const res = await ctx.app.request("/api/calendar/event-types", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: "My Type" }),
      });

      expect(res.status).toBe(401);
    });
  });
});
