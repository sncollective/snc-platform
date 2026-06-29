import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, it, expect, vi, afterEach } from "vitest";

import { makeTestConfig } from "../helpers/test-constants.js";

// ── Mock State ──

const mockDbSelect = vi.fn();
const mockFetch = vi.fn();
const mockPublish = vi.fn();
const mockGetAllEditorialConfigs = vi.fn();

// ── Setup Factory ──

const setupModule = async (overrides?: Parameters<typeof makeTestConfig>[0]) => {
  vi.stubGlobal("fetch", mockFetch);

  vi.doMock("../../src/config.js", () => ({
    config: makeTestConfig(overrides),
  }));

  vi.doMock("../../src/db/connection.js", () => ({
    db: {
      select: mockDbSelect,
    },
  }));

  vi.doMock("../../src/services/event-bus.js", () => ({
    eventBus: { publish: mockPublish },
  }));

  vi.doMock("../../src/db/schema/streaming.schema.js", () => ({
    channels: {
      id: "id",
      name: "name",
      type: "type",
      srsStreamName: "srsStreamName",
      isActive: "isActive",
      ownership: "ownership",
      creatorId: "creatorId",
      role: "role",
    },
  }));

  vi.doMock("../../src/logging/logger.js", () => ({
    rootLogger: {
      child: vi.fn().mockReturnValue({
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      }),
    },
  }));

  // Default: no editorial configs (channels fall back to queue-only defaults)
  mockGetAllEditorialConfigs.mockResolvedValue({ ok: true, value: [] });
  vi.doMock("../../src/services/editorial-config.js", () => ({
    getAllEditorialConfigs: mockGetAllEditorialConfigs,
  }));

  return await import("../../src/services/liquidsoap-config.js");
};

// ── DB Chain Helper ──

const makeDbChain = (rows: unknown[]) => {
  const chain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue(rows),
  };
  mockDbSelect.mockReturnValue(chain);
  return chain;
};

// ── Broadcast fixture ──
//
// S/NC TV is now an ordinary generated channel (role: "broadcast"), no longer a static
// tail. The widened query returns it alongside playout channels. Tests that exercise
// S/NC TV's airing behavior include this row + its 3-tier editorial config.

const SNCTV_ID = "f0f0f0f0-0000-0000-0000-000000000001";
const BROADCAST_ROW = {
  id: SNCTV_ID,
  name: "S/NC TV",
  srsStreamName: "snc-tv",
  ownership: "platform",
  creatorId: null,
  role: "broadcast",
};

const CREATOR_ID = "creator-maya";
const CREATOR_CHANNEL_ID = "cccccccc-0000-0000-0000-000000000003";
const CREATOR_CHANNEL_ROW = {
  id: CREATOR_CHANNEL_ID,
  name: "Live: Maya",
  srsStreamName: "creator-maya",
  ownership: "creator",
  creatorId: CREATOR_ID,
  role: "live-ingest",
};

/** The broadcast channel's editorial config: live → queue → carry(→classicsId). */
const broadcastConfig = (classicsId: string) => ({
  channelId: SNCTV_ID,
  mode: "auto" as const,
  manualTierId: null,
  updatedAt: "2026-06-16T00:00:00.000Z",
  tiers: [
    { id: "bt-live", channelId: SNCTV_ID, tierType: "live" as const, priority: 0, enabled: true, sourceChannelId: null },
    { id: "bt-queue", channelId: SNCTV_ID, tierType: "queue" as const, priority: 1, enabled: true, sourceChannelId: null },
    { id: "bt-carry", channelId: SNCTV_ID, tierType: "channel-as-source" as const, priority: 2, enabled: true, sourceChannelId: classicsId },
  ],
});

/** A creator config that includes a deferred live tier plus the queue tier e2e needs. */
const creatorConfig = () => ({
  channelId: CREATOR_CHANNEL_ID,
  mode: "auto" as const,
  manualTierId: null,
  updatedAt: "2026-06-28T00:00:00.000Z",
  tiers: [
    { id: "ct-live", channelId: CREATOR_CHANNEL_ID, tierType: "live" as const, priority: 0, enabled: true, sourceChannelId: null },
    { id: "ct-queue", channelId: CREATOR_CHANNEL_ID, tierType: "queue" as const, priority: 1, enabled: true, sourceChannelId: null },
  ],
});

afterEach(() => {
  vi.resetModules();
  vi.unstubAllGlobals();
  vi.resetAllMocks();
});

// ── Tests ──

describe("getLiquidsoapConfigPath", () => {
  it("defaults to the repo liquidsoap/ dir with no absolute workspace path", async () => {
    const { getLiquidsoapConfigPath } = await setupModule();

    // Same repo-root resolution as the module under test, anchored at this test file
    // (apps/api/tests/services/ and apps/api/src/services/ sit at equal depth).
    const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");

    expect(getLiquidsoapConfigPath()).toBe(resolve(repoRoot, "liquidsoap", "playout.liq"));
  });

  it("derives the default from the repo location, never a hardcoded mount path", async () => {
    // In a checkout that happens to live at the old hardcoded location, the derived
    // and hardcoded paths coincide — so behavior can't distinguish them. Pin the
    // source instead: no absolute mount-path literal may appear in the module.
    for (const module of ["liquidsoap-config.ts", "liquidsoap-render.ts", "playout-topology.ts"]) {
      const moduleSource = readFileSync(
        resolve(dirname(fileURLToPath(import.meta.url)), `../../src/services/${module}`),
        "utf8",
      );

      expect(moduleSource, module).not.toContain("/workspaces/");
    }
  });

  it("honors the LIQUIDSOAP_CONFIG_DIR override", async () => {
    const { getLiquidsoapConfigPath } = await setupModule({
      LIQUIDSOAP_CONFIG_DIR: "/custom/liq-dir",
    });

    expect(getLiquidsoapConfigPath()).toBe("/custom/liq-dir/playout.liq");
  });
});

describe("generateLiquidsoapConfig", () => {
  it("generates valid config with channel blocks", async () => {
    const { generateLiquidsoapConfig } = await setupModule();

    const CLASSICS_ID = "903e6a20-0dea-42b1-8dd5-86afbec496ac";
    makeDbChain([
      { id: CLASSICS_ID, name: "Classics", srsStreamName: "channel-classics", ownership: "platform", creatorId: null, role: "playout" },
      BROADCAST_ROW,
    ]);
    mockGetAllEditorialConfigs.mockResolvedValue({ ok: true, value: [broadcastConfig(CLASSICS_ID)] });

    const config = await generateLiquidsoapConfig();

    // Header comment
    expect(config).toContain("Auto-generated by S/NC Platform");

    // Channel block present
    expect(config).toContain("# ── Channel: Classics (playout) ──");

    // UUID with hyphens replaced by underscores, prefixed with underscore
    expect(config).toContain("_903e6a20_0dea_42b1_8dd5_86afbec496ac_queue");
    expect(config).toContain("_903e6a20_0dea_42b1_8dd5_86afbec496ac_source");

    // Harbor endpoints use the original UUID (with hyphens) in the URL path
    expect(config).toContain("/channels/903e6a20-0dea-42b1-8dd5-86afbec496ac/queue");
    expect(config).toContain("/channels/903e6a20-0dea-42b1-8dd5-86afbec496ac/skip");
    expect(config).toContain("/channels/903e6a20-0dea-42b1-8dd5-86afbec496ac/now-playing");

    // output.url with srsStreamName
    expect(config).toContain("channel-classics");

    // Static sections
    expect(config).toContain("harbor.http.register(port=8888, method=\"GET\", \"/health\"");
    expect(config).toContain("harbor.http.register(port=8888, method=\"POST\", \"/admin/shutdown\"");

    // S/NC TV now renders as a generated broadcast block (not the static tail):
    // a broadcast channel block, its :1936 live input, and the fallback telemetry.
    expect(config).toContain("# ── Channel: S/NC TV (broadcast) ──");
    expect(config).toContain("input.rtmp(listen=true, \"rtmp://0.0.0.0:1936/live/stream\")");
    expect(config).toContain("live/snc-tv?key=");
    // Carries the first playout channel as its channel-as-source fallback.
    expect(config).toContain("_903e6a20_0dea_42b1_8dd5_86afbec496ac_source");
    // No static snc_tv block remains.
    expect(config).not.toContain("snc_tv = fallback");
  });

  it("renders the broadcast channel's fallback telemetry (notify_switch) and enum-order transitions", async () => {
    const { generateLiquidsoapConfig } = await setupModule();

    const CLASSICS_ID = "903e6a20-0dea-42b1-8dd5-86afbec496ac";
    makeDbChain([
      { id: CLASSICS_ID, name: "Classics", srsStreamName: "channel-classics", ownership: "platform", creatorId: null, role: "playout" },
      BROADCAST_ROW,
    ]);
    mockGetAllEditorialConfigs.mockResolvedValue({ ok: true, value: [broadcastConfig(CLASSICS_ID)] });

    const config = await generateLiquidsoapConfig();

    expect(config).toContain("def notify_switch(name)");
    expect(config).toContain(
      'transitions=[notify_switch("live"), notify_switch("queue"), notify_switch("fallback"), notify_switch("blank")]',
    );
    expect(config).toContain("/api/playout/broadcast/input-switch");
  });

  it("generates config with no channels — empty channel set, no static S/NC TV block", async () => {
    const { generateLiquidsoapConfig } = await setupModule();

    makeDbChain([]);

    const config = await generateLiquidsoapConfig();

    expect(config).toContain("Auto-generated by S/NC Platform");
    // With no channels (not even broadcast), there is no snc_tv static block anymore —
    // S/NC TV is a DB-driven generated channel; absent from the rows → absent from the config.
    expect(config).not.toContain("snc_tv = fallback");
    expect(config).not.toContain("def notify_switch");
    // No channel blocks
    expect(config).not.toContain("request.queue(id=\"channel-");
  });

  it("generates config with multiple channels", async () => {
    const { generateLiquidsoapConfig } = await setupModule();

    makeDbChain([
      { id: "aaaaaaaa-0000-0000-0000-000000000001", name: "Channel A", srsStreamName: "channel-a", ownership: "platform", creatorId: null, role: "playout" },
      { id: "bbbbbbbb-0000-0000-0000-000000000002", name: "Channel B", srsStreamName: "channel-b", ownership: "platform", creatorId: null, role: "playout" },
    ]);

    const config = await generateLiquidsoapConfig();

    expect(config).toContain("# ── Channel: Channel A (playout) ──");
    expect(config).toContain("# ── Channel: Channel B (playout) ──");
    expect(config).toContain("_aaaaaaaa_0000_0000_0000_000000000001_queue");
    expect(config).toContain("_bbbbbbbb_0000_0000_0000_000000000002_queue");
  });

  it("excludes creator live-ingest channels by default", async () => {
    const { generateLiquidsoapConfig } = await setupModule();

    makeDbChain([
      { id: "aaaaaaaa-0000-0000-0000-000000000001", name: "Channel A", srsStreamName: "channel-a", ownership: "platform", creatorId: null, role: "playout" },
      CREATOR_CHANNEL_ROW,
    ]);

    const config = await generateLiquidsoapConfig();

    expect(config).toContain("# ── Channel: Channel A (playout) ──");
    expect(config).not.toContain("# ── Channel: Live: Maya");
    expect(config).not.toContain("creator-maya");
    expect(config).not.toContain("_cccccccc_0000_0000_0000_000000000003_queue");
  });

  it("includes creator live-ingest channels in the explicit e2e profile without rendering a live RTMP listener", async () => {
    const { generateLiquidsoapConfig } = await setupModule({ AUTH_RATE_LIMIT_PROFILE: "e2e" });

    makeDbChain([CREATOR_CHANNEL_ROW]);
    mockGetAllEditorialConfigs.mockResolvedValue({ ok: true, value: [creatorConfig()] });

    const config = await generateLiquidsoapConfig();

    expect(config).toContain("# ── Channel: Live: Maya (playout) ──");
    expect(config).toContain("ch_cccccccc_0000_0000_0000_000000000003_queue = request.queue");
    expect(config).toContain("ch_cccccccc_0000_0000_0000_000000000003_pool = request.dynamic");
    expect(config).toContain("live/creator-maya?key=");
    expect(config).toContain(`/api/playout/channels/${CREATOR_CHANNEL_ID}/track-event`);
    expect(config).not.toContain("input.rtmp");
  });

  it("escapes channel names with special characters in comments", async () => {
    const { generateLiquidsoapConfig } = await setupModule();

    makeDbChain([
      { id: "aaaaaaaa-0000-0000-0000-000000000001", name: 'Channel "Special" \\ Test', srsStreamName: "channel-special", ownership: "platform", creatorId: null },
    ]);

    const config = await generateLiquidsoapConfig();

    // Name is escaped for use in Liquidsoap string context
    expect(config).toContain('Channel \\"Special\\" \\\\ Test');
  });

  it("includes shutdown endpoint", async () => {
    const { generateLiquidsoapConfig } = await setupModule();

    makeDbChain([]);

    const config = await generateLiquidsoapConfig();

    expect(config).toContain("/admin/shutdown");
    expect(config).toContain("shutdown()");
  });
});

// ── Golden Output ──
//
// Byte-for-byte characterization of the generated .liq for canonical inputs.
// These snapshots are the verification spine for the topology/render refactor:
// any change to them is a behavior change and must be rejected in review.
// Output is environment-independent — the generator interpolates no render-time
// config, only DB rows and editorial configs.
//
// snctv-composition (2026-06-18): S/NC TV is now a generated broadcast channel,
// not a static tail. The "with-broadcast" goldens include the broadcast row + its
// 3-tier config; the diff vs the prior static-tail snapshots is the equivalence
// evidence reviewed in the topology story.

describe("golden output", () => {
  const CLASSICS_ID = "903e6a20-0dea-42b1-8dd5-86afbec496ac";

  it("zero channels (no playout, no broadcast)", async () => {
    const { generateLiquidsoapConfig } = await setupModule();
    makeDbChain([]);

    await expect(await generateLiquidsoapConfig()).toMatchFileSnapshot(
      "./__snapshots__/playout-0ch.liq",
    );
  });

  it("one playout channel + S/NC TV broadcast", async () => {
    const { generateLiquidsoapConfig } = await setupModule();
    makeDbChain([
      { id: CLASSICS_ID, name: "Classics", srsStreamName: "channel-classics", ownership: "platform", creatorId: null, role: "playout" },
      BROADCAST_ROW,
    ]);
    mockGetAllEditorialConfigs.mockResolvedValue({ ok: true, value: [broadcastConfig(CLASSICS_ID)] });

    await expect(await generateLiquidsoapConfig()).toMatchFileSnapshot(
      "./__snapshots__/playout-1ch.liq",
    );
  });

  it("two playout channels + S/NC TV broadcast (carries the first)", async () => {
    const { generateLiquidsoapConfig } = await setupModule();
    makeDbChain([
      { id: "aaaaaaaa-0000-0000-0000-000000000001", name: "Channel A", srsStreamName: "channel-a", ownership: "platform", creatorId: null, role: "playout" },
      { id: "bbbbbbbb-0000-0000-0000-000000000002", name: "Channel B", srsStreamName: "channel-b", ownership: "platform", creatorId: null, role: "playout" },
      BROADCAST_ROW,
    ]);
    mockGetAllEditorialConfigs.mockResolvedValue({
      ok: true,
      value: [broadcastConfig("aaaaaaaa-0000-0000-0000-000000000001")],
    });

    await expect(await generateLiquidsoapConfig()).toMatchFileSnapshot(
      "./__snapshots__/playout-2ch.liq",
    );
  });

  it("special characters in channel name", async () => {
    const { generateLiquidsoapConfig } = await setupModule();
    makeDbChain([
      { id: "aaaaaaaa-0000-0000-0000-000000000001", name: 'Channel "Special" \\ Test', srsStreamName: "channel-special", ownership: "platform", creatorId: null, role: "playout" },
    ]);

    await expect(await generateLiquidsoapConfig()).toMatchFileSnapshot(
      "./__snapshots__/playout-special-chars.liq",
    );
  });
});

describe("regenerateAndRestart", () => {
  it("returns err when writeFile fails", async () => {
    // Mock fs/promises to throw
    vi.doMock("node:fs/promises", () => ({
      writeFile: vi.fn().mockRejectedValue(new Error("EACCES: permission denied")),
    }));

    const { regenerateAndRestart } = await setupModule();
    makeDbChain([]);

    const result = await regenerateAndRestart();

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("CONFIG_WRITE_FAILED");
      expect(result.error.statusCode).toBe(500);
    }
  });

  it("returns ok and skips restart when LIQUIDSOAP_API_URL is not set", async () => {
    vi.doMock("node:fs/promises", () => ({
      writeFile: vi.fn().mockResolvedValue(undefined),
    }));

    const { regenerateAndRestart } = await setupModule({ LIQUIDSOAP_API_URL: undefined });
    makeDbChain([]);

    const result = await regenerateAndRestart();

    expect(result.ok).toBe(true);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("returns ok when Liquidsoap shuts down (connection reset)", async () => {
    vi.doMock("node:fs/promises", () => ({
      writeFile: vi.fn().mockResolvedValue(undefined),
    }));

    mockFetch.mockRejectedValue(new Error("fetch failed: ECONNRESET"));

    const { regenerateAndRestart } = await setupModule({
      LIQUIDSOAP_API_URL: "http://localhost:8888",
    });
    makeDbChain([]);

    const result = await regenerateAndRestart();

    expect(result.ok).toBe(true);
  });

  it("returns ok when Liquidsoap responds with 200", async () => {
    vi.doMock("node:fs/promises", () => ({
      writeFile: vi.fn().mockResolvedValue(undefined),
    }));

    mockFetch.mockResolvedValue({ ok: true, status: 200 });

    const { regenerateAndRestart } = await setupModule({
      LIQUIDSOAP_API_URL: "http://localhost:8888",
    });
    makeDbChain([]);

    const result = await regenerateAndRestart();

    expect(result.ok).toBe(true);
  });

  it("publishes playout.engine-restarted on successful restart", async () => {
    vi.doMock("node:fs/promises", () => ({
      writeFile: vi.fn().mockResolvedValue(undefined),
    }));

    mockFetch.mockResolvedValue({ ok: true, status: 200 });

    const { regenerateAndRestart } = await setupModule({
      LIQUIDSOAP_API_URL: "http://localhost:8888",
    });
    makeDbChain([]);

    await regenerateAndRestart();

    expect(mockPublish).toHaveBeenCalledWith({ type: "playout.engine-restarted" });
  });

  it("does not publish when LIQUIDSOAP_API_URL is not set (no restart occurred)", async () => {
    vi.doMock("node:fs/promises", () => ({
      writeFile: vi.fn().mockResolvedValue(undefined),
    }));

    const { regenerateAndRestart } = await setupModule({ LIQUIDSOAP_API_URL: undefined });
    makeDbChain([]);

    await regenerateAndRestart();

    expect(mockPublish).not.toHaveBeenCalled();
  });
});

describe("waitForHealth", () => {
  it("returns true when LIQUIDSOAP_API_URL is not configured", async () => {
    const { waitForHealth } = await setupModule({ LIQUIDSOAP_API_URL: undefined });

    const result = await waitForHealth(1, 0);
    expect(result).toBe(true);
  });

  it("returns true when health check succeeds on first attempt", async () => {
    mockFetch.mockResolvedValue({ ok: true, status: 200 });

    const { waitForHealth } = await setupModule({
      LIQUIDSOAP_API_URL: "http://localhost:8888",
    });

    const result = await waitForHealth(3, 0);
    expect(result).toBe(true);
  });

  it("returns false when health check never succeeds", async () => {
    mockFetch.mockRejectedValue(new Error("ECONNREFUSED"));

    const { waitForHealth } = await setupModule({
      LIQUIDSOAP_API_URL: "http://localhost:8888",
    });

    const result = await waitForHealth(2, 0);
    expect(result).toBe(false);
  });
});
