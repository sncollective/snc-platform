import { describe, it, expect } from "vitest";

import {
  buildPlayoutTopology,
  harborChannelPaths,
} from "../../src/services/playout-topology.js";
import type { EditorialConfigWithTiers } from "@snc/shared";

const ROW = {
  id: "903e6a20-0dea-42b1-8dd5-86afbec496ac",
  name: "Classics",
  srsStreamName: "channel-classics",
};

/** Convenience: a channel ID for use across tests. */
const ID_A = "aaaaaaaa-0000-0000-0000-000000000001";
const ID_B = "bbbbbbbb-0000-0000-0000-000000000002";
const ID_C = "cccccccc-0000-0000-0000-000000000003";

describe("harborChannelPaths", () => {
  it("builds the three control paths with the UUID verbatim", () => {
    expect(harborChannelPaths(ROW.id)).toEqual({
      queue: "/channels/903e6a20-0dea-42b1-8dd5-86afbec496ac/queue",
      skip: "/channels/903e6a20-0dea-42b1-8dd5-86afbec496ac/skip",
      nowPlaying: "/channels/903e6a20-0dea-42b1-8dd5-86afbec496ac/now-playing",
    });
  });
});

describe("buildPlayoutTopology — existing behavior (no editorial configs)", () => {
  it("derives per-channel naming from the row", () => {
    const topology = buildPlayoutTopology([ROW], []);

    expect(topology.channels).toHaveLength(1);
    const ch = topology.channels[0]!;
    expect(ch.liqVar).toBe("ch_903e6a20_0dea_42b1_8dd5_86afbec496ac");
    expect(ch.queueId).toBe("channel-903e6a20-0dea-42b1-8dd5-86afbec496ac");
    expect(ch.trackEventPath).toBe(
      "/api/playout/channels/903e6a20-0dea-42b1-8dd5-86afbec496ac/track-event",
    );
    expect(ch.srsStreamName).toBe("channel-classics");
  });

  it("selects the first channel's source as the broadcast fallback", () => {
    const topology = buildPlayoutTopology([
      { id: ID_A, name: "A", srsStreamName: "channel-a" },
      { id: ID_B, name: "B", srsStreamName: "channel-b" },
    ], []);

    expect(topology.broadcast.fallbackSourceVar).toBe(
      "ch_aaaaaaaa_0000_0000_0000_000000000001_source",
    );
  });

  it("falls back to silence when no playout channels exist", () => {
    const topology = buildPlayoutTopology([], []);

    expect(topology.channels).toHaveLength(0);
    expect(topology.broadcast.fallbackSourceVar).toBe("mksafe(blank())");
  });

  it("models runtime env as references with the .liq defaults", () => {
    const { env } = buildPlayoutTopology([], []);

    expect(env.srsHost).toEqual({ envVar: "SRS_RTMP_HOST", default: "snc-srs" });
    expect(env.apiHost).toEqual({ envVar: "API_CALLBACK_HOST", default: "snc-api" });
    expect(env.apiPort).toEqual({ envVar: "API_CALLBACK_PORT", default: "3000" });
    expect(env.playoutKey).toEqual({ envVar: "PLAYOUT_STREAM_KEY", default: "" });
    expect(env.callbackSecret).toEqual({ envVar: "PLAYOUT_CALLBACK_SECRET", default: "" });
    expect(env.awsEndpoint).toEqual({ envVar: "AWS_ENDPOINT", default: "http://snc-garage:3900" });
    expect(env.awsRegion).toEqual({ envVar: "AWS_DEFAULT_REGION", default: "garage" });
    // Default follows the canonical broadcast identity (SNC_TV_BROADCAST)
    expect(env.sncTvStream).toEqual({ envVar: "CHANNEL_SNCTV_STREAM", default: "snc-tv" });
  });

  it("keeps the broadcast queue id as its own datum", () => {
    expect(buildPlayoutTopology([], []).broadcast.queueId).toBe("snc-tv-queue");
  });

  it("pins the static ports", () => {
    const topology = buildPlayoutTopology([], []);
    expect(topology.harborPort).toBe(8888);
    expect(topology.srsRtmpPort).toBe(1935);
    expect(topology.broadcastInputPort).toBe(1936);
  });
});

// ── Helper for building test configs ──

const makeConfig = (
  channelId: string,
  overrides: Partial<EditorialConfigWithTiers> = {},
): EditorialConfigWithTiers => ({
  channelId,
  mode: "auto",
  manualTierId: null,
  updatedAt: "2026-06-16T00:00:00.000Z",
  tiers: [],
  ...overrides,
});

const makeTier = (
  id: string,
  channelId: string,
  tierType: string,
  priority: number,
  sourceChannelId: string | null = null,
) => ({
  id,
  channelId,
  tierType,
  priority,
  sourceChannelId,
});

describe("buildPlayoutTopology — config-less channel default", () => {
  it("applies queue-only auto default when no config exists for a channel", () => {
    const topology = buildPlayoutTopology([ROW], []);
    const ch = topology.channels[0]!;

    expect(ch.mode).toBe("auto");
    expect(ch.manualTierIndex).toBeNull();
    expect(ch.tiers).toHaveLength(1);
    expect(ch.tiers[0]).toEqual({ type: "queue", queueId: `channel-${ROW.id}` });
  });

  it("applies queue-only auto default when config exists but has empty tiers", () => {
    const topology = buildPlayoutTopology([ROW], [makeConfig(ROW.id, { tiers: [] })]);
    const ch = topology.channels[0]!;

    expect(ch.mode).toBe("auto");
    expect(ch.manualTierIndex).toBeNull();
    expect(ch.tiers).toHaveLength(1);
    expect(ch.tiers[0]).toEqual({ type: "queue", queueId: `channel-${ROW.id}` });
  });
});

describe("buildPlayoutTopology — tier type mapping", () => {
  it("maps a 'live' tier", () => {
    const configs = [makeConfig(ROW.id, {
      tiers: [makeTier("t1", ROW.id, "live", 0)],
    })];
    const ch = buildPlayoutTopology([ROW], configs).channels[0]!;
    expect(ch.tiers[0]).toEqual({ type: "live" });
  });

  it("maps a 'queue' tier using the channel's own queueId", () => {
    const configs = [makeConfig(ROW.id, {
      tiers: [makeTier("t1", ROW.id, "queue", 0)],
    })];
    const ch = buildPlayoutTopology([ROW], configs).channels[0]!;
    expect(ch.tiers[0]).toEqual({ type: "queue", queueId: `channel-${ROW.id}` });
  });

  it("maps a 'pool' tier using the channel's own queueId as poolQueueId", () => {
    const configs = [makeConfig(ROW.id, {
      tiers: [makeTier("t1", ROW.id, "pool", 0)],
    })];
    const ch = buildPlayoutTopology([ROW], configs).channels[0]!;
    expect(ch.tiers[0]).toEqual({ type: "pool", poolQueueId: `channel-${ROW.id}` });
  });

  it("maps a 'channel-as-source' tier to the referenced channel's _source var", () => {
    const rowA = { id: ID_A, name: "A", srsStreamName: "channel-a" };
    const rowB = { id: ID_B, name: "B", srsStreamName: "channel-b" };

    const configs = [
      makeConfig(ID_B, {
        tiers: [makeTier("t1", ID_B, "channel-as-source", 0, ID_A)],
      }),
    ];

    const topology = buildPlayoutTopology([rowA, rowB], configs);
    const chB = topology.channels.find((c) => c.id === ID_B)!;

    expect(chB.tiers[0]).toEqual({
      type: "channel-as-source",
      sourceLiqVar: "ch_aaaaaaaa_0000_0000_0000_000000000001_source",
    });
  });

  it("preserves priority order (0 = highest) from the config", () => {
    const configs = [makeConfig(ROW.id, {
      tiers: [
        makeTier("t0", ROW.id, "live", 0),
        makeTier("t1", ROW.id, "queue", 1),
        makeTier("t2", ROW.id, "pool", 2),
      ],
    })];
    const ch = buildPlayoutTopology([ROW], configs).channels[0]!;
    expect(ch.tiers).toHaveLength(3);
    expect(ch.tiers[0]!.type).toBe("live");
    expect(ch.tiers[1]!.type).toBe("queue");
    expect(ch.tiers[2]!.type).toBe("pool");
  });
});

describe("buildPlayoutTopology — mode + manualTierIndex", () => {
  it("carries mode = 'auto' through", () => {
    const configs = [makeConfig(ROW.id, {
      mode: "auto",
      tiers: [makeTier("t1", ROW.id, "queue", 0)],
    })];
    const ch = buildPlayoutTopology([ROW], configs).channels[0]!;
    expect(ch.mode).toBe("auto");
    expect(ch.manualTierIndex).toBeNull();
  });

  it("carries mode = 'manual' and resolves manualTierIndex", () => {
    const configs = [makeConfig(ROW.id, {
      mode: "manual",
      manualTierId: "t2",
      tiers: [
        makeTier("t1", ROW.id, "live", 0),
        makeTier("t2", ROW.id, "queue", 1),
      ],
    })];
    const ch = buildPlayoutTopology([ROW], configs).channels[0]!;
    expect(ch.mode).toBe("manual");
    expect(ch.manualTierIndex).toBe(1); // t2 is at index 1
  });

  it("sets manualTierIndex to null when manualTierId is null", () => {
    const configs = [makeConfig(ROW.id, {
      mode: "manual",
      manualTierId: null,
      tiers: [makeTier("t1", ROW.id, "queue", 0)],
    })];
    const ch = buildPlayoutTopology([ROW], configs).channels[0]!;
    expect(ch.manualTierIndex).toBeNull();
  });

  it("sets manualTierIndex to null when manualTierId does not match any tier", () => {
    const configs = [makeConfig(ROW.id, {
      mode: "manual",
      manualTierId: "nonexistent-id",
      tiers: [makeTier("t1", ROW.id, "queue", 0)],
    })];
    const ch = buildPlayoutTopology([ROW], configs).channels[0]!;
    expect(ch.manualTierIndex).toBeNull();
  });
});

describe("buildPlayoutTopology — topological ordering", () => {
  it("preserves input order exactly when no channel-as-source edges exist", () => {
    const rows = [
      { id: ID_A, name: "A", srsStreamName: "channel-a" },
      { id: ID_B, name: "B", srsStreamName: "channel-b" },
      { id: ID_C, name: "C", srsStreamName: "channel-c" },
    ];
    const topology = buildPlayoutTopology(rows, []);
    const ids = topology.channels.map((c) => c.id);
    expect(ids).toEqual([ID_A, ID_B, ID_C]);
  });

  it("places the referenced channel before the referencing channel", () => {
    // B carries A (B references A as a source) → A must come before B
    const rows = [
      { id: ID_B, name: "B", srsStreamName: "channel-b" }, // B listed first in input
      { id: ID_A, name: "A", srsStreamName: "channel-a" },
    ];
    const configs = [
      makeConfig(ID_B, {
        tiers: [makeTier("t1", ID_B, "channel-as-source", 0, ID_A)],
      }),
    ];
    const topology = buildPlayoutTopology(rows, configs);
    const ids = topology.channels.map((c) => c.id);

    const posA = ids.indexOf(ID_A);
    const posB = ids.indexOf(ID_B);
    expect(posA).toBeLessThan(posB);
  });

  it("handles a chain: C carries B, B carries A → order is A, B, C", () => {
    const rows = [
      { id: ID_C, name: "C", srsStreamName: "channel-c" },
      { id: ID_B, name: "B", srsStreamName: "channel-b" },
      { id: ID_A, name: "A", srsStreamName: "channel-a" },
    ];
    const configs = [
      makeConfig(ID_B, {
        tiers: [makeTier("t1", ID_B, "channel-as-source", 0, ID_A)],
      }),
      makeConfig(ID_C, {
        tiers: [makeTier("t2", ID_C, "channel-as-source", 0, ID_B)],
      }),
    ];
    const topology = buildPlayoutTopology(rows, configs);
    const ids = topology.channels.map((c) => c.id);

    const posA = ids.indexOf(ID_A);
    const posB = ids.indexOf(ID_B);
    const posC = ids.indexOf(ID_C);
    expect(posA).toBeLessThan(posB);
    expect(posB).toBeLessThan(posC);
  });
});

describe("buildPlayoutTopology — cycle detection", () => {
  it("throws when a self-loop is detected", () => {
    const rows = [{ id: ID_A, name: "A", srsStreamName: "channel-a" }];
    const configs = [
      makeConfig(ID_A, {
        tiers: [makeTier("t1", ID_A, "channel-as-source", 0, ID_A)],
      }),
    ];
    expect(() => buildPlayoutTopology(rows, configs)).toThrow();
  });

  it("throws when a 2-cycle is detected", () => {
    const rows = [
      { id: ID_A, name: "A", srsStreamName: "channel-a" },
      { id: ID_B, name: "B", srsStreamName: "channel-b" },
    ];
    const configs = [
      makeConfig(ID_A, {
        tiers: [makeTier("t1", ID_A, "channel-as-source", 0, ID_B)],
      }),
      makeConfig(ID_B, {
        tiers: [makeTier("t2", ID_B, "channel-as-source", 0, ID_A)],
      }),
    ];
    expect(() => buildPlayoutTopology(rows, configs)).toThrow();
  });

  it("throws on a channel-as-source referencing an unknown channel", () => {
    const rows = [{ id: ID_A, name: "A", srsStreamName: "channel-a" }];
    const configs = [
      makeConfig(ID_A, {
        tiers: [makeTier("t1", ID_A, "channel-as-source", 0, ID_B)], // ID_B not in rows
      }),
    ];
    expect(() => buildPlayoutTopology(rows, configs)).toThrow();
  });
});
