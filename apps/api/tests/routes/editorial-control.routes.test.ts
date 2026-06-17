import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { ok, err, AppError } from "@snc/shared";

import { setupRouteTest } from "../helpers/route-test-factory.js";
import { makeTestConfig } from "../helpers/test-constants.js";

// ── Mock editorial-control service ──

const mockSetMode = vi.fn();
const mockArmQueue = vi.fn();
const mockTakeQueue = vi.fn();
const mockSetManualTier = vi.fn();
const mockResolvePoolNextUri = vi.fn();

// ── Mock pool-related services ──

const mockPoolContentScope = vi.fn();

// Mock liquidsoap-client
const mockCreateLiquidsoapClient = vi.fn(() => ({
  setMode: vi.fn().mockResolvedValue(ok(undefined)),
  armQueue: vi.fn().mockResolvedValue(ok(undefined)),
  setManualTier: vi.fn().mockResolvedValue(ok(undefined)),
}));
const mockCreateStubLiquidsoapClient = vi.fn(() => ({
  setMode: vi.fn().mockResolvedValue(ok(undefined)),
  armQueue: vi.fn().mockResolvedValue(ok(undefined)),
  setManualTier: vi.fn().mockResolvedValue(ok(undefined)),
}));

// ── DB mock for pool/next route ──

const mockDbSelect = vi.fn();
const mockDbFrom = vi.fn();
const mockDbWhere = vi.fn();
const mockDb = { select: mockDbSelect };

// ── Route test context (playout.routes.ts — editorial control) ──

const editorialCtx = setupRouteTest({
  mockAuth: true,
  mockRole: true,
  defaultAuth: { roles: ["admin"] },
  mocks: () => {
    vi.doMock("../../src/services/editorial-control.js", () => ({
      setMode: mockSetMode,
      armQueue: mockArmQueue,
      takeQueue: mockTakeQueue,
      setManualTier: mockSetManualTier,
      resolvePoolNextUri: mockResolvePoolNextUri,
    }));
    vi.doMock("../../src/services/liquidsoap-client.js", () => ({
      createLiquidsoapClient: mockCreateLiquidsoapClient,
      createStubLiquidsoapClient: mockCreateStubLiquidsoapClient,
    }));
    // Mock services used by playout.routes.ts (existing routes)
    vi.doMock("../../src/services/playout.js", () => ({
      listPlayoutItems: vi.fn().mockResolvedValue(ok([])),
      getPlayoutItem: vi.fn().mockResolvedValue(ok({})),
      createPlayoutItem: vi.fn().mockResolvedValue(ok({})),
      updatePlayoutItem: vi.fn().mockResolvedValue(ok({})),
      deletePlayoutItem: vi.fn().mockResolvedValue(ok(undefined)),
      getPlayoutStatus: vi.fn().mockResolvedValue({}),
      queuePlayoutItem: vi.fn().mockResolvedValue(ok(undefined)),
      skipCurrentTrack: vi.fn().mockResolvedValue(ok(undefined)),
      retryPlayoutIngest: vi.fn().mockResolvedValue(ok(undefined)),
    }));
  },
  mountRoute: async (app) => {
    const { playoutRoutes } = await import("../../src/routes/playout.routes.js");
    app.route("/api/playout", playoutRoutes);
  },
  beforeEach: () => {
    mockSetMode.mockResolvedValue(ok(undefined));
    mockArmQueue.mockResolvedValue(ok(undefined));
    mockTakeQueue.mockResolvedValue(ok(undefined));
    mockSetManualTier.mockResolvedValue(ok(undefined));
  },
});

// ── Route test context (playout-channels.routes.ts — pool/next callback) ──

const VALID_SECRET = "test-playout-callback-secret-minimum-32-chars";

const poolCtx = setupRouteTest({
  mockAuth: false,
  mockRole: false,
  mocks: () => {
    vi.doMock("../../src/services/editorial-control.js", () => ({
      resolvePoolNextUri: mockResolvePoolNextUri,
      setMode: mockSetMode,
      armQueue: mockArmQueue,
      takeQueue: mockTakeQueue,
      setManualTier: mockSetManualTier,
    }));
    vi.doMock("../../src/services/editorial-config.js", () => ({
      poolContentScope: mockPoolContentScope,
    }));
    vi.doMock("../../src/db/connection.js", () => ({
      db: mockDb,
      sql: vi.fn(),
    }));
    vi.doMock("../../src/routes/playout-channels.init.js", () => ({
      orchestrator: {
        getChannelQueueStatus: vi.fn().mockResolvedValue(ok({ channelId: "ch-1", channelName: "Test", nowPlaying: null, upcoming: [], poolSize: 0 })),
        onTrackStarted: vi.fn().mockResolvedValue(ok(undefined)),
        insertIntoQueue: vi.fn().mockResolvedValue(ok({})),
        removeFromQueue: vi.fn().mockResolvedValue(ok(undefined)),
        skip: vi.fn().mockResolvedValue(ok(undefined)),
        listContent: vi.fn().mockResolvedValue(ok([])),
        assignContent: vi.fn().mockResolvedValue(ok(undefined)),
        removeContent: vi.fn().mockResolvedValue(ok(undefined)),
        searchAvailableContent: vi.fn().mockResolvedValue(ok([])),
      },
    }));
    // Minimal mocks for other services playout-channels.routes.ts imports
    vi.doMock("../../src/services/channels.js", () => ({
      ensurePlayout: vi.fn().mockResolvedValue(ok({ id: "ch-1", name: "Test" })),
    }));
    vi.doMock("../../src/services/liquidsoap-config.js", () => ({
      regenerateAndRestart: vi.fn().mockResolvedValue(ok(undefined)),
      waitForHealth: vi.fn().mockResolvedValue(true),
    }));
    vi.doMock("../../src/services/event-bus.js", () => ({
      eventBus: { publish: vi.fn(), subscribe: vi.fn() },
    }));
    vi.doMock("../../src/services/playout-live-state.js", () => ({
      setAiringSource: vi.fn(),
      getAiringSource: vi.fn().mockReturnValue("fallback"),
    }));
    vi.doMock("../../src/services/notify-dispatch.js", () => ({
      dispatchChannelGoLive: vi.fn().mockResolvedValue(undefined),
    }));
  },
  mountRoute: async (app) => {
    const { playoutChannelRoutes } = await import("../../src/routes/playout-channels.routes.js");
    app.route("/api/playout", playoutChannelRoutes);
  },
  beforeEach: () => {
    mockResolvePoolNextUri.mockResolvedValue("s3://test-bucket/item-1/1080p.mp4");
    mockPoolContentScope.mockReturnValue({ allCreators: true });

    // Wire DB chain for channel lookup
    mockDbWhere.mockResolvedValue([{ id: "ch-1", ownership: "platform", creatorId: null }]);
    mockDbFrom.mockReturnValue({ where: mockDbWhere });
    mockDb.select = vi.fn().mockReturnValue({ from: mockDbFrom });
  },
});

// ── Editorial control route tests ──

describe("editorial control routes", () => {
  describe("POST /api/playout/channels/:channelId/editorial/mode", () => {
    it("200 — sets mode for admin", async () => {
      const res = await editorialCtx.app.request(
        "/api/playout/channels/ch-1/editorial/mode",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mode: "auto" }),
        },
      );

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toEqual({ ok: true });
      expect(mockSetMode).toHaveBeenCalledWith("ch-1", "auto", expect.anything());
    });

    it("403 — forbidden without admin role", async () => {
      editorialCtx.auth.roles = [];
      const res = await editorialCtx.app.request(
        "/api/playout/channels/ch-1/editorial/mode",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mode: "auto" }),
        },
      );

      expect(res.status).toBe(403);
    });

    it("401 — unauthorized when not authenticated", async () => {
      editorialCtx.auth.user = null;
      const res = await editorialCtx.app.request(
        "/api/playout/channels/ch-1/editorial/mode",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mode: "auto" }),
        },
      );

      expect(res.status).toBe(401);
    });

    it("400 — invalid mode value", async () => {
      const res = await editorialCtx.app.request(
        "/api/playout/channels/ch-1/editorial/mode",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mode: "invalid" }),
        },
      );

      expect(res.status).toBe(400);
    });

    it("404 — channel not found propagated from service", async () => {
      // Must dynamically import to get the same module instance as the error handler
      const { AppError: AppErrorCls } = await import("@snc/shared");
      mockSetMode.mockResolvedValue({ ok: false, error: new AppErrorCls("NOT_FOUND", "Channel not found", 404) });

      const res = await editorialCtx.app.request(
        "/api/playout/channels/ch-1/editorial/mode",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mode: "auto" }),
        },
      );

      expect(res.status).toBe(404);
    });
  });

  describe("POST /api/playout/channels/:channelId/editorial/arm", () => {
    it("200 — arms queue for admin", async () => {
      const res = await editorialCtx.app.request(
        "/api/playout/channels/ch-1/editorial/arm",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ armed: true }),
        },
      );

      expect(res.status).toBe(200);
      expect(mockArmQueue).toHaveBeenCalledWith("ch-1", true, expect.anything());
    });

    it("403 — forbidden without admin role", async () => {
      editorialCtx.auth.roles = [];
      const res = await editorialCtx.app.request(
        "/api/playout/channels/ch-1/editorial/arm",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ armed: true }),
        },
      );

      expect(res.status).toBe(403);
    });

    it("401 — unauthorized when not authenticated", async () => {
      editorialCtx.auth.user = null;
      const res = await editorialCtx.app.request(
        "/api/playout/channels/ch-1/editorial/arm",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ armed: true }),
        },
      );

      expect(res.status).toBe(401);
    });
  });

  describe("POST /api/playout/channels/:channelId/editorial/take", () => {
    it("200 — take-over queue for admin", async () => {
      const res = await editorialCtx.app.request(
        "/api/playout/channels/ch-1/editorial/take",
        { method: "POST" },
      );

      expect(res.status).toBe(200);
      expect(mockTakeQueue).toHaveBeenCalledWith("ch-1", expect.anything());
    });

    it("403 — forbidden without admin role", async () => {
      editorialCtx.auth.roles = [];
      const res = await editorialCtx.app.request(
        "/api/playout/channels/ch-1/editorial/take",
        { method: "POST" },
      );

      expect(res.status).toBe(403);
    });

    it("401 — unauthorized when not authenticated", async () => {
      editorialCtx.auth.user = null;
      const res = await editorialCtx.app.request(
        "/api/playout/channels/ch-1/editorial/take",
        { method: "POST" },
      );

      expect(res.status).toBe(401);
    });
  });

  describe("POST /api/playout/channels/:channelId/editorial/manual", () => {
    it("200 — pins manual tier for admin", async () => {
      const res = await editorialCtx.app.request(
        "/api/playout/channels/ch-1/editorial/manual",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tierId: "tier-1" }),
        },
      );

      expect(res.status).toBe(200);
      expect(mockSetManualTier).toHaveBeenCalledWith("ch-1", "tier-1", expect.anything());
    });

    it("403 — forbidden without admin role", async () => {
      editorialCtx.auth.roles = [];
      const res = await editorialCtx.app.request(
        "/api/playout/channels/ch-1/editorial/manual",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tierId: "tier-1" }),
        },
      );

      expect(res.status).toBe(403);
    });

    it("401 — unauthorized when not authenticated", async () => {
      editorialCtx.auth.user = null;
      const res = await editorialCtx.app.request(
        "/api/playout/channels/ch-1/editorial/manual",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tierId: "tier-1" }),
        },
      );

      expect(res.status).toBe(401);
    });

    it("400 — missing tierId", async () => {
      const res = await editorialCtx.app.request(
        "/api/playout/channels/ch-1/editorial/manual",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        },
      );

      expect(res.status).toBe(400);
    });
  });
});

// ── Pool/next callback route tests ──

describe("pool/next callback route", () => {
  describe("GET /api/playout/channels/:channelId/pool/next", () => {
    it("200 — returns URI as plain text with valid secret", async () => {
      const res = await poolCtx.app.request(
        `/api/playout/channels/ch-1/pool/next?secret=${VALID_SECRET}`,
      );

      expect(res.status).toBe(200);
      const text = await res.text();
      expect(text).toBe("s3://test-bucket/item-1/1080p.mp4");
    });

    it("200 — returns empty body when pool is empty (not an error)", async () => {
      mockResolvePoolNextUri.mockResolvedValue(null);

      const res = await poolCtx.app.request(
        `/api/playout/channels/ch-1/pool/next?secret=${VALID_SECRET}`,
      );

      expect(res.status).toBe(200);
      const text = await res.text();
      expect(text).toBe("");
    });

    it("200 — returns empty body when channel not found (safe degradation)", async () => {
      mockDbWhere.mockResolvedValue([]);

      const res = await poolCtx.app.request(
        `/api/playout/channels/nonexistent/pool/next?secret=${VALID_SECRET}`,
      );

      expect(res.status).toBe(200);
      const text = await res.text();
      expect(text).toBe("");
    });

    it("401 — rejects with wrong secret", async () => {
      const res = await poolCtx.app.request(
        "/api/playout/channels/ch-1/pool/next?secret=wrong-secret",
      );

      expect(res.status).toBe(401);
      // pool/next returns empty body on 401 (Liquidsoap sees empty = not-ready, not a bad URI)
      const text = await res.text();
      expect(text).toBe("");
    });

    it("401 — rejects with missing secret", async () => {
      const res = await poolCtx.app.request(
        "/api/playout/channels/ch-1/pool/next",
      );

      expect(res.status).toBe(401);
    });

    it("calls poolContentScope and resolvePoolNextUri with resolved scope", async () => {
      await poolCtx.app.request(
        `/api/playout/channels/ch-1/pool/next?secret=${VALID_SECRET}`,
      );

      expect(mockPoolContentScope).toHaveBeenCalledWith(
        expect.objectContaining({ id: "ch-1", ownership: "platform" }),
      );
      expect(mockResolvePoolNextUri).toHaveBeenCalledWith("ch-1", { allCreators: true });
    });

    it("uses creator scope for creator-owned channels", async () => {
      mockDbWhere.mockResolvedValue([{ id: "ch-creator", ownership: "creator", creatorId: "user-1" }]);
      mockPoolContentScope.mockReturnValue({ creatorId: "user-1" });
      mockResolvePoolNextUri.mockResolvedValue("s3://test-bucket/creator-item.mp4");

      const res = await poolCtx.app.request(
        `/api/playout/channels/ch-creator/pool/next?secret=${VALID_SECRET}`,
      );

      expect(res.status).toBe(200);
      const text = await res.text();
      expect(text).toBe("s3://test-bucket/creator-item.mp4");
      expect(mockPoolContentScope).toHaveBeenCalledWith(
        expect.objectContaining({ ownership: "creator", creatorId: "user-1" }),
      );
      expect(mockResolvePoolNextUri).toHaveBeenCalledWith("ch-creator", { creatorId: "user-1" });
    });
  });
});
