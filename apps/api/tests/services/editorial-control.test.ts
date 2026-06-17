import { describe, it, expect, vi, afterEach } from "vitest";
import { ok, err, AppError } from "@snc/shared";

// ── DB Mock (module-level, rewired in each test) ──

const mockSelect = vi.fn();
const mockUpdate = vi.fn();

const mockDb = {
  select: mockSelect,
  update: mockUpdate,
};

// ── editorial-config mock functions ──

const mockUpsertEditorialConfig = vi.fn();
const mockGetEditorialTiers = vi.fn();
const mockCreateEditorialTier = vi.fn();
const mockUpdateEditorialTier = vi.fn();
const mockDeleteEditorialTier = vi.fn();

// ── liquidsoap-config mock ──

const mockRegenerateAndRestart = vi.fn();

// ── Config mock ──

const mockConfig = {
  S3_BUCKET: "test-bucket",
  LIQUIDSOAP_API_URL: "http://liquidsoap.test:8888",
  PLAYOUT_CALLBACK_SECRET: "test-playout-callback-secret-minimum-32-chars",
};

// ── Logger mock ──

const mockLogger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};

// ── Module setup ──

const setupModule = async () => {
  vi.doMock("../../src/db/connection.js", () => ({ db: mockDb }));
  vi.doMock("../../src/db/schema/streaming.schema.js", () => ({
    channels: { id: "id", ownership: "ownership", creatorId: "creatorId" },
  }));
  vi.doMock("../../src/db/schema/playout-queue.schema.js", () => ({
    channelContent: {
      id: "id",
      channelId: "channelId",
      playoutItemId: "playoutItemId",
      contentId: "contentId",
      lastPlayedAt: "lastPlayedAt",
      playCount: "playCount",
    },
  }));
  vi.doMock("../../src/db/schema/playout.schema.js", () => ({
    playoutItems: {
      id: "id",
      rendition1080pKey: "r1080",
      rendition720pKey: "r720",
      rendition480pKey: "r480",
      sourceKey: "src",
    },
  }));
  vi.doMock("../../src/db/schema/content.schema.js", () => ({
    content: { id: "id", mediaKey: "mediaKey", transcodedMediaKey: "transcodedMediaKey" },
  }));
  vi.doMock("../../src/services/editorial-config.js", () => ({
    upsertEditorialConfig: mockUpsertEditorialConfig,
    getEditorialTiers: mockGetEditorialTiers,
    createEditorialTier: mockCreateEditorialTier,
    updateEditorialTier: mockUpdateEditorialTier,
    deleteEditorialTier: mockDeleteEditorialTier,
  }));
  vi.doMock("../../src/services/liquidsoap-config.js", () => ({
    regenerateAndRestart: mockRegenerateAndRestart,
  }));
  vi.doMock("../../src/config.js", () => ({ config: mockConfig }));
  vi.doMock("../../src/logging/logger.js", () => ({
    rootLogger: { child: () => mockLogger },
  }));

  return await import("../../src/services/editorial-control.js");
};

afterEach(() => {
  vi.resetModules();
  vi.resetAllMocks();
});

// ── Fixtures ──

const makeChannel = (overrides: Record<string, unknown> = {}) => ({
  id: "ch-1",
  ownership: "platform",
  creatorId: null,
  ...overrides,
});

const makeTier = (overrides: Record<string, unknown> = {}) => ({
  id: "tier-1",
  channelId: "ch-1",
  tierType: "queue",
  priority: 0,
  enabled: true,
  sourceChannelId: null,
  ...overrides,
});

const makePlayoutItem = (overrides: Record<string, unknown> = {}) => ({
  id: "item-1",
  rendition1080pKey: "renditions/item-1/1080p.mp4",
  rendition720pKey: null,
  rendition480pKey: null,
  sourceKey: null,
  ...overrides,
});

const makeChannelContentRow = (overrides: Record<string, unknown> = {}) => ({
  id: "cc-1",
  playoutItemId: "item-1",
  contentId: null,
  lastPlayedAt: null,
  ...overrides,
});

const makeMockClient = () => ({
  pushTrack: vi.fn().mockResolvedValue(ok(undefined)),
  skipTrack: vi.fn().mockResolvedValue(ok(undefined)),
  getNowPlaying: vi.fn().mockResolvedValue(null),
  setMode: vi.fn().mockResolvedValue(ok(undefined)),
  armQueue: vi.fn().mockResolvedValue(ok(undefined)),
  setManualTier: vi.fn().mockResolvedValue(ok(undefined)),
});

// ── Helper to wire a simple channel lookup ──

const wireChannelLookup = (channel: Record<string, unknown> | null) => {
  const whereMock = vi.fn().mockResolvedValue(channel ? [channel] : []);
  const fromMock = vi.fn().mockReturnValue({ where: whereMock });
  mockSelect.mockReturnValue({ from: fromMock });
  return { whereMock, fromMock };
};

// ── Helper to wire update chain ──

const wireUpdateChain = () => {
  const updateWhereMock = vi.fn().mockResolvedValue([]);
  const setMock = vi.fn().mockReturnValue({ where: updateWhereMock });
  const updateMock = vi.fn().mockReturnValue({ set: setMock });
  mockDb.update = updateMock;
  return { updateMock, setMock, updateWhereMock };
};

// ── Tests ──

describe("editorial-control service", () => {
  // ── setMode ──

  describe("setMode", () => {
    it("persists the mode and live-mutates the client", async () => {
      wireChannelLookup(makeChannel());
      mockUpsertEditorialConfig.mockResolvedValue(ok({ channelId: "ch-1", mode: "auto", manualTierId: null, updatedAt: "2026-01-01T00:00:00Z" }));

      const client = makeMockClient();
      const { setMode } = await setupModule();
      const result = await setMode("ch-1", "auto", client);

      expect(result.ok).toBe(true);
      expect(mockUpsertEditorialConfig).toHaveBeenCalledWith("ch-1", { mode: "auto" });
      expect(client.setMode).toHaveBeenCalledWith("ch-1", "auto");
    });

    it("returns NOT_FOUND error when channel not found", async () => {
      wireChannelLookup(null);

      const client = makeMockClient();
      const { setMode } = await setupModule();
      const result = await setMode("nonexistent", "auto", client);

      expect(result.ok).toBe(false);
      expect((result as { ok: false; error: { code: string } }).error.code).toBe("NOT_FOUND");
      expect(mockUpsertEditorialConfig).not.toHaveBeenCalled();
      expect(client.setMode).not.toHaveBeenCalled();
    });

    it("succeeds even when client live-mutate fails (persisted state survives restart)", async () => {
      wireChannelLookup(makeChannel());
      mockUpsertEditorialConfig.mockResolvedValue(ok({ channelId: "ch-1", mode: "manual", manualTierId: null, updatedAt: "2026-01-01T00:00:00Z" }));

      const client = makeMockClient();
      client.setMode.mockResolvedValue(err(new AppError("LIQUIDSOAP_ERROR", "unreachable", 502)));

      const { setMode } = await setupModule();
      const result = await setMode("ch-1", "manual", client);

      // Persist succeeded, client failed — overall success (client failure is best-effort)
      expect(result.ok).toBe(true);
      expect(mockUpsertEditorialConfig).toHaveBeenCalledWith("ch-1", { mode: "manual" });
    });
  });

  // ── armQueue ──

  describe("armQueue", () => {
    it("calls client.armQueue but does NOT persist to DB (arm is transient)", async () => {
      wireChannelLookup(makeChannel());

      const client = makeMockClient();
      const { armQueue } = await setupModule();
      const result = await armQueue("ch-1", true, client);

      expect(result.ok).toBe(true);
      expect(client.armQueue).toHaveBeenCalledWith("ch-1", true);
      // arm state is NOT persisted — upsertEditorialConfig must NOT be called
      expect(mockUpsertEditorialConfig).not.toHaveBeenCalled();
    });

    it("returns NOT_FOUND error when channel not found", async () => {
      wireChannelLookup(null);

      const client = makeMockClient();
      const { armQueue } = await setupModule();
      const result = await armQueue("nonexistent", true, client);

      expect(result.ok).toBe(false);
      expect((result as { ok: false; error: { code: string } }).error.code).toBe("NOT_FOUND");
      expect(client.armQueue).not.toHaveBeenCalled();
    });
  });

  // ── takeQueue (workshop scenario: "build a queue while pool rotates, take when ready") ──

  describe("takeQueue", () => {
    it("persists mode=auto and live-mutates arm+mode", async () => {
      wireChannelLookup(makeChannel());
      mockUpsertEditorialConfig.mockResolvedValue(ok({ channelId: "ch-1", mode: "auto", manualTierId: null, updatedAt: "2026-01-01T00:00:00Z" }));

      const client = makeMockClient();
      const { takeQueue } = await setupModule();
      const result = await takeQueue("ch-1", client);

      expect(result.ok).toBe(true);
      // Persists mode=auto (the switch-over intent survives restart)
      expect(mockUpsertEditorialConfig).toHaveBeenCalledWith("ch-1", { mode: "auto" });
      // Live-mutates: arm=true and mode=auto
      expect(client.armQueue).toHaveBeenCalledWith("ch-1", true);
      expect(client.setMode).toHaveBeenCalledWith("ch-1", "auto");
    });
  });

  // ── setManualTier (workshop scenario: "choose the event over the live creator") ──

  describe("setManualTier", () => {
    it("resolves tier index, persists mode=manual + manualTierId, live-mutates", async () => {
      wireChannelLookup(makeChannel());

      const tiers = [
        makeTier({ id: "tier-live", tierType: "live", priority: 0, enabled: true }),
        makeTier({ id: "tier-queue", tierType: "queue", priority: 1, enabled: true }),
      ];
      mockGetEditorialTiers.mockResolvedValue(ok(tiers));
      mockUpsertEditorialConfig.mockResolvedValue(ok({ channelId: "ch-1", mode: "manual", manualTierId: "tier-queue", updatedAt: "2026-01-01T00:00:00Z" }));

      const client = makeMockClient();
      const { setManualTier } = await setupModule();
      const result = await setManualTier("ch-1", "tier-queue", client);

      expect(result.ok).toBe(true);
      expect(mockUpsertEditorialConfig).toHaveBeenCalledWith("ch-1", {
        mode: "manual",
        manualTierId: "tier-queue",
      });
      // tier-queue is index 1 among enabled tiers (tier-live=0, tier-queue=1)
      expect(client.setManualTier).toHaveBeenCalledWith("ch-1", 1);
      expect(client.setMode).toHaveBeenCalledWith("ch-1", "manual");
    });

    it("returns NOT_FOUND error for a tier that doesn't exist", async () => {
      wireChannelLookup(makeChannel());
      mockGetEditorialTiers.mockResolvedValue(ok([]));

      const client = makeMockClient();
      const { setManualTier } = await setupModule();
      const result = await setManualTier("ch-1", "nonexistent-tier", client);

      expect(result.ok).toBe(false);
      expect((result as { ok: false; error: { code: string } }).error.code).toBe("NOT_FOUND");
    });

    it("returns VALIDATION_ERROR when tier exists but is disabled", async () => {
      wireChannelLookup(makeChannel());
      const tiers = [makeTier({ id: "tier-disabled", enabled: false })];
      mockGetEditorialTiers.mockResolvedValue(ok(tiers));

      const client = makeMockClient();
      const { setManualTier } = await setupModule();
      const result = await setManualTier("ch-1", "tier-disabled", client);

      expect(result.ok).toBe(false);
      expect((result as { ok: false; error: { code: string } }).error.code).toBe("VALIDATION_ERROR");
    });
  });

  // ── setTierEnabled (structural edit → regenerate-and-restart) ──

  describe("setTierEnabled", () => {
    it("persists then triggers regenerateAndRestart", async () => {
      mockUpdateEditorialTier.mockResolvedValue(ok(makeTier({ enabled: false })));
      mockRegenerateAndRestart.mockResolvedValue(ok(undefined));

      const { setTierEnabled } = await setupModule();
      const result = await setTierEnabled("tier-1", false);

      expect(result.ok).toBe(true);
      expect(mockUpdateEditorialTier).toHaveBeenCalledWith("tier-1", { enabled: false });
      expect(mockRegenerateAndRestart).toHaveBeenCalledTimes(1);
    });

    it("does NOT trigger restart if the persist fails", async () => {
      mockUpdateEditorialTier.mockResolvedValue(err(new AppError("NOT_FOUND", "not found", 404)));

      const { setTierEnabled } = await setupModule();
      const result = await setTierEnabled("nonexistent", false);

      expect(result.ok).toBe(false);
      expect(mockRegenerateAndRestart).not.toHaveBeenCalled();
    });
  });

  // ── addCarryEdge (structural edit) ──

  describe("addCarryEdge", () => {
    it("creates tier then triggers regenerateAndRestart", async () => {
      mockCreateEditorialTier.mockResolvedValue(ok(makeTier({ tierType: "channel-as-source", sourceChannelId: "ch-2" })));
      mockRegenerateAndRestart.mockResolvedValue(ok(undefined));

      const { addCarryEdge } = await setupModule();
      const result = await addCarryEdge("ch-1", "ch-2", 0);

      expect(result.ok).toBe(true);
      expect(mockCreateEditorialTier).toHaveBeenCalledWith("ch-1", {
        tierType: "channel-as-source",
        priority: 0,
        enabled: true,
        sourceChannelId: "ch-2",
      });
      expect(mockRegenerateAndRestart).toHaveBeenCalledTimes(1);
    });
  });

  // ── removeTier (structural edit) ──

  describe("removeTier", () => {
    it("deletes tier then triggers regenerateAndRestart", async () => {
      mockDeleteEditorialTier.mockResolvedValue(ok(undefined));
      mockRegenerateAndRestart.mockResolvedValue(ok(undefined));

      const { removeTier } = await setupModule();
      const result = await removeTier("tier-1");

      expect(result.ok).toBe(true);
      expect(mockDeleteEditorialTier).toHaveBeenCalledWith("tier-1");
      expect(mockRegenerateAndRestart).toHaveBeenCalledTimes(1);
    });
  });

  // ── resolvePoolNextUri (pool/next LRP) ──

  describe("resolvePoolNextUri", () => {
    it("returns the URI of the least-recently-played item and updates lastPlayedAt+playCount", async () => {
      // sequence: select(channel_content), select(playoutItems), update
      let selectCallCount = 0;
      mockSelect.mockImplementation(() => {
        selectCallCount++;
        if (selectCallCount === 1) {
          // channel_content LRP query
          const limitMock = vi.fn().mockResolvedValue([makeChannelContentRow()]);
          const orderByMock = vi.fn().mockReturnValue({ limit: limitMock });
          const whereMock = vi.fn().mockReturnValue({ orderBy: orderByMock });
          const fromMock = vi.fn().mockReturnValue({ where: whereMock });
          return { from: fromMock };
        } else {
          // playoutItems lookup
          const whereMock = vi.fn().mockResolvedValue([makePlayoutItem()]);
          const fromMock = vi.fn().mockReturnValue({ where: whereMock });
          return { from: fromMock };
        }
      });

      const { updateMock, setMock } = wireUpdateChain();

      const { resolvePoolNextUri } = await setupModule();
      const uri = await resolvePoolNextUri("ch-1", { allCreators: true });

      expect(uri).toBe("s3://test-bucket/renditions/item-1/1080p.mp4");
      // LRP update was called
      expect(updateMock).toHaveBeenCalledTimes(1);
      expect(setMock).toHaveBeenCalledWith(
        expect.objectContaining({ lastPlayedAt: expect.any(Date) }),
      );
    });

    it("returns null when pool is empty", async () => {
      const limitMock = vi.fn().mockResolvedValue([]);
      const orderByMock = vi.fn().mockReturnValue({ limit: limitMock });
      const whereMock = vi.fn().mockReturnValue({ orderBy: orderByMock });
      const fromMock = vi.fn().mockReturnValue({ where: whereMock });
      mockSelect.mockReturnValue({ from: fromMock });

      const { resolvePoolNextUri } = await setupModule();
      const uri = await resolvePoolNextUri("ch-1", { allCreators: true });

      expect(uri).toBeNull();
    });

    it("skips items with no playable URI and tries the next one", async () => {
      const rows = [
        makeChannelContentRow({ id: "cc-1", playoutItemId: "item-no-uri" }),
        makeChannelContentRow({ id: "cc-2", playoutItemId: "item-has-uri" }),
      ];

      let selectCallCount = 0;
      let itemCallCount = 0;
      mockSelect.mockImplementation(() => {
        selectCallCount++;
        if (selectCallCount === 1) {
          const limitMock = vi.fn().mockResolvedValue(rows);
          const orderByMock = vi.fn().mockReturnValue({ limit: limitMock });
          const whereMock = vi.fn().mockReturnValue({ orderBy: orderByMock });
          const fromMock = vi.fn().mockReturnValue({ where: whereMock });
          return { from: fromMock };
        } else {
          itemCallCount++;
          const items = itemCallCount === 1
            ? [] // first item: no DB row
            : [{ id: "item-has-uri", rendition1080pKey: null, rendition720pKey: "renditions/item-has-uri/720p.mp4", rendition480pKey: null, sourceKey: null }];
          const whereMock = vi.fn().mockResolvedValue(items);
          const fromMock = vi.fn().mockReturnValue({ where: whereMock });
          return { from: fromMock };
        }
      });

      wireUpdateChain();

      const { resolvePoolNextUri } = await setupModule();
      const uri = await resolvePoolNextUri("ch-1", { allCreators: true });

      expect(uri).toBe("s3://test-bucket/renditions/item-has-uri/720p.mp4");
    });

    it("works with creator scope descriptor (scope enforced at seed time)", async () => {
      // Confirm the function works with a { creatorId } scope — scope is channelId-bounded at runtime
      let selectCallCount = 0;
      mockSelect.mockImplementation(() => {
        selectCallCount++;
        if (selectCallCount === 1) {
          const limitMock = vi.fn().mockResolvedValue([makeChannelContentRow()]);
          const orderByMock = vi.fn().mockReturnValue({ limit: limitMock });
          const whereMock = vi.fn().mockReturnValue({ orderBy: orderByMock });
          const fromMock = vi.fn().mockReturnValue({ where: whereMock });
          return { from: fromMock };
        } else {
          const whereMock = vi.fn().mockResolvedValue([makePlayoutItem()]);
          const fromMock = vi.fn().mockReturnValue({ where: whereMock });
          return { from: fromMock };
        }
      });

      wireUpdateChain();

      const { resolvePoolNextUri } = await setupModule();
      const uri = await resolvePoolNextUri("ch-1", { creatorId: "creator-1" });

      expect(uri).toBe("s3://test-bucket/renditions/item-1/1080p.mp4");
    });
  });
});
