import { describe, it, expect, vi } from "vitest";

import { setupRouteTest } from "../helpers/route-test-factory.js";
import { makeMockUser } from "../helpers/auth-fixtures.js";

// ── Mock Service Functions ──

const mockGetNotifications = vi.fn();
const mockGetUnreadCount = vi.fn();
const mockMarkRead = vi.fn();
const mockMarkAllRead = vi.fn();

// ── Test Context ──

const ctx = setupRouteTest({
  defaultAuth: { user: makeMockUser(), roles: [] },
  mocks: () => {
    vi.doMock("../../src/services/notification-inbox.js", () => ({
      getNotifications: mockGetNotifications,
      getUnreadCount: mockGetUnreadCount,
      markRead: mockMarkRead,
      markAllRead: mockMarkAllRead,
    }));
  },
  mountRoute: async (app) => {
    const { notificationInboxRoutes } = await import(
      "../../src/routes/notification-inbox.routes.js"
    );
    app.route("/api/notifications", notificationInboxRoutes);
  },
  beforeEach: () => {
    mockGetNotifications.mockResolvedValue({
      ok: true,
      value: { notifications: [], hasMore: false },
    });
    mockGetUnreadCount.mockResolvedValue({ ok: true, value: 0 });
    mockMarkRead.mockResolvedValue({ ok: true, value: undefined });
    mockMarkAllRead.mockResolvedValue({ ok: true, value: undefined });
  },
});

// ── Tests ──

describe("GET /api/notifications", () => {
  it("returns 200 with paginated notification list", async () => {
    const notification = {
      id: "notif-1",
      type: "go_live",
      title: "Stream is live!",
      body: "Creator is streaming",
      actionUrl: null,
      read: false,
      createdAt: "2026-04-01T10:00:00.000Z",
    };
    mockGetNotifications.mockResolvedValueOnce({
      ok: true,
      value: { notifications: [notification], hasMore: false },
    });

    const res = await ctx.app.request("/api/notifications");
    expect(res.status).toBe(200);

    const body = await res.json() as { notifications: unknown[]; hasMore: boolean };
    expect(body.notifications).toHaveLength(1);
    expect(body.hasMore).toBe(false);
  });

  it("returns 401 when unauthenticated", async () => {
    ctx.auth.user = null;

    const res = await ctx.app.request("/api/notifications");
    expect(res.status).toBe(401);
  });

  it("passes limit query param to service", async () => {
    const res = await ctx.app.request("/api/notifications?limit=5");
    expect(res.status).toBe(200);
    expect(mockGetNotifications).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 5 }),
    );
  });
});

describe("GET /api/notifications/unread-count", () => {
  it("returns 200 with unread count", async () => {
    mockGetUnreadCount.mockResolvedValueOnce({ ok: true, value: 7 });

    const res = await ctx.app.request("/api/notifications/unread-count");
    expect(res.status).toBe(200);

    const body = await res.json() as { count: number };
    expect(body.count).toBe(7);
  });

  it("returns 401 when unauthenticated", async () => {
    ctx.auth.user = null;

    const res = await ctx.app.request("/api/notifications/unread-count");
    expect(res.status).toBe(401);
  });
});

describe("PATCH /api/notifications/:id/read", () => {
  it("returns 200 when marking as read", async () => {
    const res = await ctx.app.request("/api/notifications/notif-1/read", {
      method: "PATCH",
    });
    expect(res.status).toBe(200);

    const body = await res.json() as { ok: boolean };
    expect(body.ok).toBe(true);
  });

  it("returns 401 when unauthenticated", async () => {
    ctx.auth.user = null;

    const res = await ctx.app.request("/api/notifications/notif-1/read", {
      method: "PATCH",
    });
    expect(res.status).toBe(401);
  });
});

describe("POST /api/notifications/read-all", () => {
  it("returns 200 when marking all read", async () => {
    const res = await ctx.app.request("/api/notifications/read-all", {
      method: "POST",
    });
    expect(res.status).toBe(200);

    const body = await res.json() as { ok: boolean };
    expect(body.ok).toBe(true);
  });

  it("returns 401 when unauthenticated", async () => {
    ctx.auth.user = null;

    const res = await ctx.app.request("/api/notifications/read-all", {
      method: "POST",
    });
    expect(res.status).toBe(401);
  });
});
