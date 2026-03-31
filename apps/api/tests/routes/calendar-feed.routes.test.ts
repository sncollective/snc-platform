import { describe, it, expect, vi } from "vitest";

import { setupRouteTest } from "../helpers/route-test-factory.js";
import { makeMockUser } from "../helpers/auth-fixtures.js";
import {
  makeMockCalendarEvent,
  makeMockFeedToken,
} from "../helpers/calendar-fixtures.js";

// ── Mock DB Chains ──

// SELECT: db.select().from().where() or db.select().from().leftJoin().where().orderBy()
const mockOrderBy = vi.fn();
const mockSelectWhere = vi.fn();
const mockLeftJoin = vi.fn();
const mockSelectFrom = vi.fn();
const mockSelect = vi.fn();

// INSERT: db.insert(table).values({})
const mockInsertValues = vi.fn();
const mockInsert = vi.fn();

// DELETE: db.delete(table).where(...)
const mockDeleteWhere = vi.fn();
const mockDelete = vi.fn();

const mockDb = {
  select: mockSelect,
  insert: mockInsert,
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
    }));

    vi.doMock("../../src/db/schema/creator.schema.js", () => ({
      creatorProfiles: {
        id: {},
        userId: {},
        displayName: {},
        bio: {},
        avatarKey: {},
        bannerKey: {},
        socialLinks: {},
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
    const { calendarFeedRoutes } = await import(
      "../../src/routes/calendar-feed.routes.js"
    );
    app.route("/api/calendar", calendarFeedRoutes);
  },
  beforeEach: () => {
    // SELECT chain: supports both direct .where() and .leftJoin().where().orderBy()
    mockSelect.mockReturnValue({ from: mockSelectFrom });
    mockSelectFrom.mockReturnValue({ where: mockSelectWhere, leftJoin: mockLeftJoin });
    mockLeftJoin.mockReturnValue({ where: mockSelectWhere });
    mockSelectWhere.mockResolvedValue([]);
    mockOrderBy.mockResolvedValue([]);

    // INSERT chain (no returning needed for feed token insert)
    mockInsert.mockReturnValue({ values: mockInsertValues });
    mockInsertValues.mockResolvedValue(undefined);

    // DELETE chain
    mockDelete.mockReturnValue({ where: mockDeleteWhere });
    mockDeleteWhere.mockResolvedValue(undefined);
  },
});

// ── Tests ──

describe("calendar-feed routes", () => {
  // ── POST /api/calendar/feed-token ──

  describe("POST /api/calendar/feed-token", () => {
    it("generates a feed token and returns token and URL", async () => {
      const res = await ctx.app.request("/api/calendar/feed-token", {
        method: "POST",
      });
      const body = (await res.json()) as { token: string; url: string };

      expect(res.status).toBe(200);
      expect(body.token).toBeTruthy();
      expect(body.url).toContain(body.token);
      expect(body.url).toContain("feed.ics");
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
    it("returns existing feed token and URL", async () => {
      const token = makeMockFeedToken();
      mockSelectWhere.mockResolvedValueOnce([token]);

      const res = await ctx.app.request("/api/calendar/feed-token");
      const body = (await res.json()) as { token: string; url: string };

      expect(res.status).toBe(200);
      expect(body.token).toBe(token.token);
      expect(body.url).toContain(token.token);
      expect(body.url).toContain("feed.ics");
    });

    it("returns 404 when no token exists for user", async () => {
      mockSelectWhere.mockResolvedValueOnce([]);

      const res = await ctx.app.request("/api/calendar/feed-token");

      expect(res.status).toBe(404);
    });

    it("returns 401 when unauthenticated", async () => {
      ctx.auth.user = null;

      const res = await ctx.app.request("/api/calendar/feed-token");

      expect(res.status).toBe(401);
    });

    it("returns 403 for non-stakeholder", async () => {
      ctx.auth.roles = [];

      const res = await ctx.app.request("/api/calendar/feed-token");

      expect(res.status).toBe(403);
    });
  });

  // ── GET /api/calendar/feed.ics ──

  describe("GET /api/calendar/feed.ics", () => {
    it("returns .ics content for a valid token", async () => {
      const feedToken = makeMockFeedToken();
      const event = makeMockCalendarEvent();

      // Token validation lookup
      mockSelectWhere.mockResolvedValueOnce([feedToken]);
      // Events query: .leftJoin().where().orderBy() chain
      mockSelectWhere.mockReturnValueOnce({ orderBy: mockOrderBy });
      mockOrderBy.mockResolvedValueOnce([{ event, creatorName: null }]);

      const res = await ctx.app.request(
        `/api/calendar/feed.ics?token=${feedToken.token}`,
      );

      expect(res.status).toBe(200);
      const contentType = res.headers.get("content-type");
      expect(contentType).toContain("text/calendar");

      const text = await res.text();
      expect(text).toContain("BEGIN:VCALENDAR");
      expect(text).toContain("END:VCALENDAR");
      expect(text).toContain(event.title);
    });

    it("includes creator name in event summary when present", async () => {
      const feedToken = makeMockFeedToken();
      const event = makeMockCalendarEvent({ creatorId: "creator_abc" });

      mockSelectWhere.mockResolvedValueOnce([feedToken]);
      mockSelectWhere.mockReturnValueOnce({ orderBy: mockOrderBy });
      mockOrderBy.mockResolvedValueOnce([{ event, creatorName: "Alice" }]);

      const res = await ctx.app.request(
        `/api/calendar/feed.ics?token=${feedToken.token}`,
      );
      const text = await res.text();

      expect(res.status).toBe(200);
      expect(text).toContain("Alice");
    });

    it("returns 400 when token query param is missing", async () => {
      const res = await ctx.app.request("/api/calendar/feed.ics");

      expect(res.status).toBe(400);
    });

    it("returns 401 for an invalid or unknown token", async () => {
      mockSelectWhere.mockResolvedValueOnce([]);

      const res = await ctx.app.request(
        "/api/calendar/feed.ics?token=invalid-token",
      );

      expect(res.status).toBe(401);
    });

    it("returns empty calendar when no events exist for valid token", async () => {
      const feedToken = makeMockFeedToken();

      // Token valid
      mockSelectWhere.mockResolvedValueOnce([feedToken]);
      // No events
      mockSelectWhere.mockReturnValueOnce({ orderBy: mockOrderBy });
      mockOrderBy.mockResolvedValueOnce([]);

      const res = await ctx.app.request(
        `/api/calendar/feed.ics?token=${feedToken.token}`,
      );
      const text = await res.text();

      expect(res.status).toBe(200);
      expect(text).toContain("BEGIN:VCALENDAR");
      expect(text).toContain("END:VCALENDAR");
    });
  });
});
