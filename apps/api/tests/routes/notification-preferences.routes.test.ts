import { describe, it, expect, vi } from "vitest";

import { setupRouteTest } from "../helpers/route-test-factory.js";
import { makeMockUser } from "../helpers/auth-fixtures.js";

// ── Mock DB Chains ──

const mockSelectWhere = vi.fn();
const mockSelectFrom = vi.fn(() => ({ where: mockSelectWhere }));
const mockSelect = vi.fn(() => ({ from: mockSelectFrom }));

const mockInsertOnConflictDoUpdate = vi.fn().mockResolvedValue(undefined);
const mockInsertValues = vi.fn(() => ({ onConflictDoUpdate: mockInsertOnConflictDoUpdate }));
const mockInsert = vi.fn(() => ({ values: mockInsertValues }));

const mockDb = {
  select: mockSelect,
  insert: mockInsert,
};

// ── Test Context ──

const ctx = setupRouteTest({
  db: mockDb,
  defaultAuth: { user: makeMockUser(), roles: [] },
  mocks: () => {
    vi.doMock("../../src/db/schema/notification.schema.js", () => ({
      notificationPreferences: {
        userId: {},
        eventType: {},
        channel: {},
        enabled: {},
        updatedAt: {},
      },
    }));
  },
  mountRoute: async (app) => {
    const { notificationPreferencesRoutes } = await import(
      "../../src/routes/notification-preferences.routes.js"
    );
    app.route("/api/me/notifications", notificationPreferencesRoutes);
  },
  beforeEach: () => {
    mockSelect.mockReturnValue({ from: mockSelectFrom });
    mockSelectFrom.mockReturnValue({ where: mockSelectWhere });
    mockSelectWhere.mockResolvedValue([]);
  },
});

// ── Tests ──

describe("GET /api/me/notifications", () => {
  it("returns full preference matrix with defaults when no preferences saved", async () => {
    mockSelectWhere.mockResolvedValueOnce([]);

    const res = await ctx.app.request("/api/me/notifications");
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.preferences).toBeDefined();
    expect(Array.isArray(body.preferences)).toBe(true);
    // 2 event types × 1 channel = 2 preferences
    expect(body.preferences).toHaveLength(2);
    // All should default to enabled: true
    for (const pref of body.preferences) {
      expect(pref.enabled).toBe(true);
    }
  });

  it("returns saved preferences where they exist", async () => {
    mockSelectWhere.mockResolvedValueOnce([
      { userId: "user_test123", eventType: "go_live", channel: "email", enabled: false },
    ]);

    const res = await ctx.app.request("/api/me/notifications");
    expect(res.status).toBe(200);

    const body = await res.json();
    const goLivePref = body.preferences.find(
      (p: any) => p.eventType === "go_live" && p.channel === "email",
    );
    expect(goLivePref).toBeDefined();
    expect(goLivePref.enabled).toBe(false);
  });

  it("returns 401 when unauthenticated", async () => {
    ctx.auth.user = null;
    const res = await ctx.app.request("/api/me/notifications");
    expect(res.status).toBe(401);
  });
});

describe("PUT /api/me/notifications", () => {
  it("upserts a notification preference and returns the updated value", async () => {
    const body = { eventType: "go_live", channel: "email", enabled: false };

    const res = await ctx.app.request("/api/me/notifications", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    expect(res.status).toBe(200);
    const responseBody = await res.json();
    expect(responseBody).toMatchObject({ eventType: "go_live", channel: "email", enabled: false });
    expect(mockInsert).toHaveBeenCalled();
    expect(mockInsertOnConflictDoUpdate).toHaveBeenCalled();
  });

  it("returns 401 when unauthenticated", async () => {
    ctx.auth.user = null;
    const res = await ctx.app.request("/api/me/notifications", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventType: "go_live", channel: "email", enabled: false }),
    });
    expect(res.status).toBe(401);
  });

  it("returns 400 for invalid event type", async () => {
    const res = await ctx.app.request("/api/me/notifications", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventType: "invalid_event", channel: "email", enabled: true }),
    });
    expect(res.status).toBe(400);
  });
});
