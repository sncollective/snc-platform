import { describe, it, expect, vi } from "vitest";

import { setupRouteTest } from "../helpers/route-test-factory.js";
import { makeMockUser } from "../helpers/auth-fixtures.js";

// ── Mock DB Chains ──

// GET /event-types: db.select({ ... }).from(table) — resolves directly from `from`
// POST /event-types: db.select().from(table).where(...) — needs chained .where()
const mockSelectWhere = vi.fn();
const mockSelectFrom = vi.fn();
const mockSelect = vi.fn();

// INSERT: db.insert(table).values({}).returning()
const mockInsertReturning = vi.fn();
const mockInsertValues = vi.fn();
const mockInsert = vi.fn();

const mockDb = {
  select: mockSelect,
  insert: mockInsert,
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
      customEventTypes: {
        id: {},
        label: {},
        slug: {},
        createdBy: {},
        createdAt: {},
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
    // Base SELECT chain: from() returns chainable object for POST path (.from().where())
    // Individual GET tests override mockSelectFrom with mockResolvedValueOnce([]) for direct resolution
    mockSelect.mockReturnValue({ from: mockSelectFrom });
    mockSelectFrom.mockReturnValue({ where: mockSelectWhere });
    mockSelectWhere.mockResolvedValue([]);

    // INSERT chain
    mockInsert.mockReturnValue({ values: mockInsertValues });
    mockInsertValues.mockReturnValue({ returning: mockInsertReturning });
    mockInsertReturning.mockResolvedValue([]);
  },
});

// ── Tests ──

describe("calendar-event-types routes", () => {
  // ── GET /api/calendar/event-types ──

  describe("GET /api/calendar/event-types", () => {
    it("returns default event types when no custom types exist", async () => {
      mockSelectFrom.mockResolvedValueOnce([]);

      const res = await ctx.app.request("/api/calendar/event-types");
      const body = (await res.json()) as { items: Array<{ slug: string; label: string; id: string }> };

      expect(res.status).toBe(200);
      expect(body.items.length).toBeGreaterThan(0);
      const slugs = body.items.map((i) => i.slug);
      expect(slugs).toContain("recording-session");
      expect(slugs).toContain("meeting");
      // "other" should be last
      expect(slugs[slugs.length - 1]).toBe("other");
    });

    it("merges custom types with defaults", async () => {
      const customRow = {
        id: "ct_001",
        label: "Album Launch",
        slug: "album-launch",
      };
      mockSelectFrom.mockResolvedValueOnce([customRow]);

      const res = await ctx.app.request("/api/calendar/event-types");
      const body = (await res.json()) as { items: Array<{ slug: string; id: string }> };

      expect(res.status).toBe(200);
      const slugs = body.items.map((i) => i.slug);
      expect(slugs).toContain("album-launch");
      expect(slugs).toContain("recording-session");
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
    it("creates a custom event type and returns 201", async () => {
      // No existing slug conflict in DB
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
      const body = (await res.json()) as { items: Array<{ id: string; label: string; slug: string }> };

      expect(res.status).toBe(201);
      expect(body.items[0]?.slug).toBe("album-launch");
      expect(body.items[0]?.label).toBe("Album Launch");
    });

    it("returns 409 when slug conflicts with an existing custom type", async () => {
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

    it("returns 409 when label slugifies to a default event type slug", async () => {
      // "Recording Session" → slug "recording-session" which is a default type
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

    it("returns 400 for missing label field", async () => {
      const res = await ctx.app.request("/api/calendar/event-types", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
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

    it("returns 403 for non-stakeholder", async () => {
      ctx.auth.roles = [];

      const res = await ctx.app.request("/api/calendar/event-types", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: "My Type" }),
      });

      expect(res.status).toBe(403);
    });
  });
});
