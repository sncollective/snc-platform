import { describe, it, expect, vi } from "vitest";

import { setupRouteTest } from "../helpers/route-test-factory.js";

// ── Mock Services ──

const mockListPlayoutItems = vi.fn();
const mockGetPlayoutItem = vi.fn();
const mockCreatePlayoutItem = vi.fn();
const mockUpdatePlayoutItem = vi.fn();
const mockDeletePlayoutItem = vi.fn();
const mockGetPlayoutStatus = vi.fn();
const mockQueuePlayoutItem = vi.fn();
const mockSkipCurrentTrack = vi.fn();
const mockRetryPlayoutIngest = vi.fn();

// ── Fixtures ──

const makePlayoutItem = (overrides: Record<string, unknown> = {}) => ({
  id: "item-1",
  title: "Test Film",
  year: 2020,
  director: "Test Director",
  duration: 90.0,
  processingStatus: "ready" as const,
  position: 0,
  enabled: true,
  renditions: { source: true, "1080p": true, "720p": false, "480p": false, audio: false },
  hasSubtitles: false,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  ...overrides,
});

const makePlayoutStatus = () => ({
  nowPlaying: null,
  queuedItems: [],
});

// ── Route Test Context ──

const ctx = setupRouteTest({
  mockAuth: true,
  mockRole: true,
  defaultAuth: {
    roles: ["admin"],
  },
  mocks: () => {
    vi.doMock("../../src/services/playout.js", () => ({
      listPlayoutItems: mockListPlayoutItems,
      getPlayoutItem: mockGetPlayoutItem,
      createPlayoutItem: mockCreatePlayoutItem,
      updatePlayoutItem: mockUpdatePlayoutItem,
      deletePlayoutItem: mockDeletePlayoutItem,
      getPlayoutStatus: mockGetPlayoutStatus,
      queuePlayoutItem: mockQueuePlayoutItem,
      skipCurrentTrack: mockSkipCurrentTrack,
      retryPlayoutIngest: mockRetryPlayoutIngest,
    }));
  },
  mountRoute: async (app) => {
    const { playoutRoutes } = await import("../../src/routes/playout.routes.js");
    app.route("/api/playout", playoutRoutes);
  },
  beforeEach: () => {
    mockListPlayoutItems.mockResolvedValue([makePlayoutItem()]);
    mockGetPlayoutItem.mockResolvedValue({ ok: true, value: makePlayoutItem() });
    mockCreatePlayoutItem.mockResolvedValue({ ok: true, value: makePlayoutItem() });
    mockUpdatePlayoutItem.mockResolvedValue({ ok: true, value: makePlayoutItem() });
    mockDeletePlayoutItem.mockResolvedValue({ ok: true, value: undefined });
    mockGetPlayoutStatus.mockResolvedValue(makePlayoutStatus());
    mockQueuePlayoutItem.mockResolvedValue({ ok: true, value: undefined });
    mockSkipCurrentTrack.mockResolvedValue({ ok: true, value: undefined });
    mockRetryPlayoutIngest.mockResolvedValue({ ok: true, value: undefined });
  },
});

// ── Tests ──

describe("playout routes", () => {
  describe("GET /api/playout/items", () => {
    it("returns items list for admin", async () => {
      const res = await ctx.app.request("/api/playout/items");

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.items).toHaveLength(1);
      expect(body.items[0]?.id).toBe("item-1");
      expect(body.items[0]?.title).toBe("Test Film");
    });

    it("returns 401 when unauthenticated", async () => {
      ctx.auth.user = null;
      ctx.auth.session = null;

      const res = await ctx.app.request("/api/playout/items");
      expect(res.status).toBe(401);
    });

    it("returns 403 when not admin", async () => {
      ctx.auth.roles = [];

      const res = await ctx.app.request("/api/playout/items");
      expect(res.status).toBe(403);
    });
  });

  describe("GET /api/playout/items/:id", () => {
    it("returns item when found", async () => {
      const res = await ctx.app.request("/api/playout/items/item-1");

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.id).toBe("item-1");
      expect(body.title).toBe("Test Film");
    });

    it("returns 404 when not found", async () => {
      const { AppError } = await import("@snc/shared");
      mockGetPlayoutItem.mockResolvedValue({
        ok: false,
        error: new AppError("NOT_FOUND", "Item not found", 404),
      });

      const res = await ctx.app.request("/api/playout/items/nonexistent");
      expect(res.status).toBe(404);
    });

    it("returns 401 when unauthenticated", async () => {
      ctx.auth.user = null;
      ctx.auth.session = null;

      const res = await ctx.app.request("/api/playout/items/item-1");
      expect(res.status).toBe(401);
    });
  });

  describe("POST /api/playout/items", () => {
    it("creates item and returns 201", async () => {
      const res = await ctx.app.request("/api/playout/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "New Film" }),
      });

      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.id).toBe("item-1");
      expect(mockCreatePlayoutItem).toHaveBeenCalledWith({ title: "New Film" });
    });

    it("creates item with null title when title is omitted", async () => {
      const res = await ctx.app.request("/api/playout/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}), // title is optional — defaults to null
      });

      expect(res.status).toBe(201);
    });

    it("returns 400 on invalid body when title exceeds max length", async () => {
      const res = await ctx.app.request("/api/playout/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "x".repeat(256) }), // title too long
      });

      expect(res.status).toBe(400);
    });

    it("returns 401 when unauthenticated", async () => {
      ctx.auth.user = null;
      ctx.auth.session = null;

      const res = await ctx.app.request("/api/playout/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Test" }),
      });
      expect(res.status).toBe(401);
    });

    it("returns 403 when not admin", async () => {
      ctx.auth.roles = [];

      const res = await ctx.app.request("/api/playout/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Test" }),
      });
      expect(res.status).toBe(403);
    });
  });

  describe("PATCH /api/playout/items/:id", () => {
    it("updates item and returns updated data", async () => {
      mockUpdatePlayoutItem.mockResolvedValue({
        ok: true,
        value: makePlayoutItem({ title: "Updated Film" }),
      });

      const res = await ctx.app.request("/api/playout/items/item-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Updated Film" }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.title).toBe("Updated Film");
      expect(mockUpdatePlayoutItem).toHaveBeenCalledWith("item-1", { title: "Updated Film" });
    });

    it("returns 404 when not found", async () => {
      const { AppError } = await import("@snc/shared");
      mockUpdatePlayoutItem.mockResolvedValue({
        ok: false,
        error: new AppError("NOT_FOUND", "Item not found", 404),
      });

      const res = await ctx.app.request("/api/playout/items/nonexistent", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "X" }),
      });
      expect(res.status).toBe(404);
    });

    it("returns 401 when unauthenticated", async () => {
      ctx.auth.user = null;
      ctx.auth.session = null;

      const res = await ctx.app.request("/api/playout/items/item-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Test" }),
      });
      expect(res.status).toBe(401);
    });

    it("returns 403 when not admin", async () => {
      ctx.auth.roles = [];

      const res = await ctx.app.request("/api/playout/items/item-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Test" }),
      });
      expect(res.status).toBe(403);
    });
  });

  describe("DELETE /api/playout/items/:id", () => {
    it("deletes item and returns ok", async () => {
      const res = await ctx.app.request("/api/playout/items/item-1", {
        method: "DELETE",
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.ok).toBe(true);
      expect(mockDeletePlayoutItem).toHaveBeenCalledWith("item-1");
    });

    it("returns 404 when not found", async () => {
      const { AppError } = await import("@snc/shared");
      mockDeletePlayoutItem.mockResolvedValue({
        ok: false,
        error: new AppError("NOT_FOUND", "Item not found", 404),
      });

      const res = await ctx.app.request("/api/playout/items/nonexistent", {
        method: "DELETE",
      });
      expect(res.status).toBe(404);
    });

    it("returns 401 when unauthenticated", async () => {
      ctx.auth.user = null;
      ctx.auth.session = null;

      const res = await ctx.app.request("/api/playout/items/item-1", {
        method: "DELETE",
      });
      expect(res.status).toBe(401);
    });

    it("returns 403 when not admin", async () => {
      ctx.auth.roles = [];

      const res = await ctx.app.request("/api/playout/items/item-1", {
        method: "DELETE",
      });
      expect(res.status).toBe(403);
    });
  });

  describe("GET /api/playout/status", () => {
    it("returns playout status with nowPlaying and items", async () => {
      mockGetPlayoutStatus.mockResolvedValue({
        nowPlaying: {
          itemId: "item-1",
          title: "Test Film",
          year: 2020,
          director: "Test Director",
          duration: 90.0,
          elapsed: -1,
          remaining: -1,
        },
        queuedItems: [],
      });

      const res = await ctx.app.request("/api/playout/status");

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.nowPlaying).not.toBeNull();
      expect(body.nowPlaying?.itemId).toBe("item-1");
      expect(body.nowPlaying?.title).toBe("Test Film");
    });

    it("returns status with null nowPlaying when nothing playing", async () => {
      const res = await ctx.app.request("/api/playout/status");

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.nowPlaying).toBeNull();
    });

    it("returns 401 when unauthenticated", async () => {
      ctx.auth.user = null;
      ctx.auth.session = null;

      const res = await ctx.app.request("/api/playout/status");
      expect(res.status).toBe(401);
    });

    it("returns 403 when not admin", async () => {
      ctx.auth.roles = [];

      const res = await ctx.app.request("/api/playout/status");
      expect(res.status).toBe(403);
    });
  });

  describe("POST /api/playout/skip", () => {
    it("skips current track and returns ok", async () => {
      const res = await ctx.app.request("/api/playout/skip", { method: "POST" });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.ok).toBe(true);
      expect(mockSkipCurrentTrack).toHaveBeenCalledTimes(1);
    });

    it("returns 503 when Liquidsoap not configured", async () => {
      const { AppError } = await import("@snc/shared");
      mockSkipCurrentTrack.mockResolvedValue({
        ok: false,
        error: new AppError("LIQUIDSOAP_NOT_CONFIGURED", "Liquidsoap is not configured", 503),
      });

      const res = await ctx.app.request("/api/playout/skip", { method: "POST" });

      expect(res.status).toBe(503);
      const body = await res.json();
      expect(body.error.code).toBe("LIQUIDSOAP_NOT_CONFIGURED");
    });

    it("returns 401 when unauthenticated", async () => {
      ctx.auth.user = null;
      ctx.auth.session = null;

      const res = await ctx.app.request("/api/playout/skip", { method: "POST" });
      expect(res.status).toBe(401);
    });

    it("returns 403 when not admin", async () => {
      ctx.auth.roles = [];

      const res = await ctx.app.request("/api/playout/skip", { method: "POST" });
      expect(res.status).toBe(403);
    });
  });

  describe("POST /api/playout/queue/:id", () => {
    it("queues item and returns ok", async () => {
      const res = await ctx.app.request("/api/playout/queue/item-1", { method: "POST" });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.ok).toBe(true);
      expect(mockQueuePlayoutItem).toHaveBeenCalledWith("item-1");
    });

    it("returns 404 when item not found", async () => {
      const { AppError } = await import("@snc/shared");
      mockQueuePlayoutItem.mockResolvedValue({
        ok: false,
        error: new AppError("NOT_FOUND", "Item not found", 404),
      });

      const res = await ctx.app.request("/api/playout/queue/nonexistent", { method: "POST" });

      expect(res.status).toBe(404);
    });

    it("returns error when no rendition available", async () => {
      const { AppError } = await import("@snc/shared");
      mockQueuePlayoutItem.mockResolvedValue({
        ok: false,
        error: new AppError("NO_RENDITION", "No rendition available for this item", 422),
      });

      const res = await ctx.app.request("/api/playout/queue/item-1", { method: "POST" });

      expect(res.status).toBe(422);
      const body = await res.json();
      expect(body.error.code).toBe("NO_RENDITION");
    });

    it("returns 401 when unauthenticated", async () => {
      ctx.auth.user = null;
      ctx.auth.session = null;

      const res = await ctx.app.request("/api/playout/queue/item-1", { method: "POST" });
      expect(res.status).toBe(401);
    });

    it("returns 403 when not admin", async () => {
      ctx.auth.roles = [];

      const res = await ctx.app.request("/api/playout/queue/item-1", { method: "POST" });
      expect(res.status).toBe(403);
    });
  });

  describe("POST /api/playout/items/:id/retry", () => {
    it("returns ok when retry succeeds", async () => {
      const res = await ctx.app.request("/api/playout/items/item-1/retry", {
        method: "POST",
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.ok).toBe(true);
      expect(mockRetryPlayoutIngest).toHaveBeenCalledWith("item-1");
    });

    it("returns 404 when item not found", async () => {
      const { AppError } = await import("@snc/shared");
      mockRetryPlayoutIngest.mockResolvedValue({
        ok: false,
        error: new AppError("NOT_FOUND", "Playout item not found", 404),
      });

      const res = await ctx.app.request("/api/playout/items/nonexistent/retry", {
        method: "POST",
      });
      expect(res.status).toBe(404);
    });

    it("returns 409 when item is not in failed state", async () => {
      const { AppError } = await import("@snc/shared");
      mockRetryPlayoutIngest.mockResolvedValue({
        ok: false,
        error: new AppError("INVALID_STATE", "Cannot retry item in state: ready", 409),
      });

      const res = await ctx.app.request("/api/playout/items/item-1/retry", {
        method: "POST",
      });
      expect(res.status).toBe(409);
      const body = await res.json();
      expect(body.error.code).toBe("INVALID_STATE");
    });

    it("returns 422 when item has no source file", async () => {
      const { AppError } = await import("@snc/shared");
      mockRetryPlayoutIngest.mockResolvedValue({
        ok: false,
        error: new AppError("NO_SOURCE", "Item has no source file", 422),
      });

      const res = await ctx.app.request("/api/playout/items/item-1/retry", {
        method: "POST",
      });
      expect(res.status).toBe(422);
    });

    it("returns 401 when unauthenticated", async () => {
      ctx.auth.user = null;
      ctx.auth.session = null;

      const res = await ctx.app.request("/api/playout/items/item-1/retry", {
        method: "POST",
      });
      expect(res.status).toBe(401);
    });

    it("returns 403 when not admin", async () => {
      ctx.auth.roles = [];

      const res = await ctx.app.request("/api/playout/items/item-1/retry", {
        method: "POST",
      });
      expect(res.status).toBe(403);
    });
  });
});
