import { describe, it, expect } from "vitest";

import {
  buildPlayoutTopology,
  harborChannelPaths,
} from "../../src/services/playout-topology.js";
import type { EditorialConfigWithTiers, EditorialTierType } from "@snc/shared";

// ── Test row fixtures ──

const ROW = {
  id: "903e6a20-0dea-42b1-8dd5-86afbec496ac",
  name: "Classics",
  srsStreamName: "channel-classics",
  ownership: "platform",
  creatorId: null,
};

/** Convenience: a channel ID for use across tests. */
const ID_A = "aaaaaaaa-0000-0000-0000-000000000001";
const ID_B = "bbbbbbbb-0000-0000-0000-000000000002";
const ID_C = "cccccccc-0000-0000-0000-000000000003";
const CREATOR_ID = "creator-uuid-1111";

const makeRow = (
  id: string,
  name: string,
  srsStreamName: string,
  ownership: "platform" | "creator" = "platform",
  creatorId: string | null = null,
) => ({ id, name, srsStreamName, ownership, creatorId });

describe("harborChannelPaths", () => {
  it("builds four control paths (queue, skip, nowPlaying, arm — B1 downgrade: no mode/manual/priority)", () => {
    // B1 downgrade (2026-06-17): mode and manual-pin are render-time-static; their
    // harbor endpoints are removed. arm is the only live editorial verb.
    expect(harborChannelPaths(ROW.id)).toEqual({
      queue: "/channels/903e6a20-0dea-42b1-8dd5-86afbec496ac/queue",
      skip: "/channels/903e6a20-0dea-42b1-8dd5-86afbec496ac/skip",
      nowPlaying: "/channels/903e6a20-0dea-42b1-8dd5-86afbec496ac/now-playing",
      arm: "/channels/903e6a20-0dea-42b1-8dd5-86afbec496ac/arm",
    });
  });

  it("does NOT include mode, manual, or priority paths", () => {
    const paths = harborChannelPaths(ROW.id);
    const keys = Object.keys(paths);
    expect(keys).not.toContain("mode");
    expect(keys).not.toContain("manual");
    expect(keys).not.toContain("priority");
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
      makeRow(ID_A, "A", "channel-a"),
      makeRow(ID_B, "B", "channel-b"),
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
  tierType: EditorialTierType,
  priority: number,
  sourceChannelId: string | null = null,
  enabled = true,
) => ({
  id,
  channelId,
  tierType,
  priority,
  sourceChannelId,
  enabled,
});

describe("buildPlayoutTopology — config-less channel default", () => {
  it("applies queue-only auto default when no config exists for a channel", () => {
    const topology = buildPlayoutTopology([ROW], []);
    const ch = topology.channels[0]!;

    expect(ch.mode).toBe("auto");
    expect(ch.manualTierIndex).toBeNull();
    expect(ch.tiers).toHaveLength(1);
    const tier = ch.tiers[0]!;
    expect(tier.type).toBe("queue");
    if (tier.type === "queue") {
      expect(tier.queueId).toBe(`channel-${ROW.id}`);
      // platform-owned with no creator → allCreators
      expect(tier.poolScope).toEqual({ allCreators: true });
    }
  });

  it("applies queue-only auto default when config exists but has empty tiers", () => {
    const topology = buildPlayoutTopology([ROW], [makeConfig(ROW.id, { tiers: [] })]);
    const ch = topology.channels[0]!;

    expect(ch.mode).toBe("auto");
    expect(ch.manualTierIndex).toBeNull();
    expect(ch.tiers).toHaveLength(1);
    expect(ch.tiers[0]!.type).toBe("queue");
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

  it("maps a 'queue' tier with queueId and poolScope", () => {
    const configs = [makeConfig(ROW.id, {
      tiers: [makeTier("t1", ROW.id, "queue", 0)],
    })];
    const ch = buildPlayoutTopology([ROW], configs).channels[0]!;
    expect(ch.tiers[0]).toEqual({
      type: "queue",
      queueId: `channel-${ROW.id}`,
      poolScope: { allCreators: true }, // platform-owned channel
    });
  });

  it("queue poolScope is creatorId-scoped for creator-owned channels", () => {
    const creatorRow = makeRow(ROW.id, ROW.name, ROW.srsStreamName, "creator", CREATOR_ID);
    const configs = [makeConfig(ROW.id, {
      tiers: [makeTier("t1", ROW.id, "queue", 0)],
    })];
    const ch = buildPlayoutTopology([creatorRow], configs).channels[0]!;
    const tier = ch.tiers[0]!;
    expect(tier.type).toBe("queue");
    if (tier.type === "queue") {
      expect(tier.poolScope).toEqual({ creatorId: CREATOR_ID });
    }
  });

  it("maps a 'channel-as-source' tier to the referenced channel's _source var", () => {
    const rowA = makeRow(ID_A, "A", "channel-a");
    const rowB = makeRow(ID_B, "B", "channel-b");

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

  it("preserves priority order (0 = highest) from the config — enabled tiers only", () => {
    const configs = [makeConfig(ROW.id, {
      tiers: [
        makeTier("t0", ROW.id, "live", 0),
        makeTier("t1", ROW.id, "queue", 1),
      ],
    })];
    const ch = buildPlayoutTopology([ROW], configs).channels[0]!;
    expect(ch.tiers).toHaveLength(2);
    expect(ch.tiers[0]!.type).toBe("live");
    expect(ch.tiers[1]!.type).toBe("queue");
  });
});

describe("buildPlayoutTopology — disabled tier filtering", () => {
  it("excludes disabled tiers from the resolved tier list", () => {
    const configs = [makeConfig(ROW.id, {
      tiers: [
        makeTier("t0", ROW.id, "live", 0, null, true),   // enabled
        makeTier("t1", ROW.id, "queue", 1, null, false),  // disabled
      ],
    })];
    const ch = buildPlayoutTopology([ROW], configs).channels[0]!;
    expect(ch.tiers).toHaveLength(1);
    expect(ch.tiers[0]!.type).toBe("live");
  });

  it("falls back to queue-only default when all tiers are disabled", () => {
    const configs = [makeConfig(ROW.id, {
      tiers: [
        makeTier("t0", ROW.id, "live", 0, null, false),  // disabled
        makeTier("t1", ROW.id, "queue", 1, null, false),  // disabled
      ],
    })];
    const ch = buildPlayoutTopology([ROW], configs).channels[0]!;
    // Degenerate fallback: queue-only (same as config-less)
    expect(ch.tiers).toHaveLength(1);
    expect(ch.tiers[0]!.type).toBe("queue");
  });

  it("includes all tiers when all are enabled", () => {
    const configs = [makeConfig(ROW.id, {
      tiers: [
        makeTier("t0", ROW.id, "live", 0, null, true),
        makeTier("t1", ROW.id, "queue", 1, null, true),
      ],
    })];
    const ch = buildPlayoutTopology([ROW], configs).channels[0]!;
    expect(ch.tiers).toHaveLength(2);
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

  it("B2 fix: computes manualTierIndex over enabled tiers — disabled tier before pinned does not shift index", () => {
    // B2 scenario: tier at full-array index 0 is disabled; pinned tier is at full-array
    // index 1. The enabled-array index of the pinned tier is 0 (it's the only enabled tier).
    // Before the B2 fix, config.tiers.findIndex returned 1 (full-array), but tierVarNames
    // has the pinned tier at index 0 → wrong tier (or out-of-range → blank) on restart.
    const configs = [makeConfig(ROW.id, {
      mode: "manual",
      manualTierId: "t-queue",
      tiers: [
        makeTier("t-live",  ROW.id, "live",  0, null, false), // disabled — excluded from enabled array
        makeTier("t-queue", ROW.id, "queue", 1, null, true),  // enabled — index 0 in enabled array
      ],
    })];
    const ch = buildPlayoutTopology([ROW], configs).channels[0]!;
    // Enabled array: [t-queue] → manualTierIndex should be 0, not 1
    expect(ch.manualTierIndex).toBe(0);
  });
});

describe("buildPlayoutTopology — topological ordering (edge-list, no string-stripping)", () => {
  it("preserves input order exactly when no channel-as-source edges exist", () => {
    const rows = [
      makeRow(ID_A, "A", "channel-a"),
      makeRow(ID_B, "B", "channel-b"),
      makeRow(ID_C, "C", "channel-c"),
    ];
    const topology = buildPlayoutTopology(rows, []);
    const ids = topology.channels.map((c) => c.id);
    expect(ids).toEqual([ID_A, ID_B, ID_C]);
  });

  it("places the referenced channel before the referencing channel", () => {
    // B carries A (B references A as a source) → A must come before B
    const rows = [
      makeRow(ID_B, "B", "channel-b"), // B listed first in input
      makeRow(ID_A, "A", "channel-a"),
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
      makeRow(ID_C, "C", "channel-c"),
      makeRow(ID_B, "B", "channel-b"),
      makeRow(ID_A, "A", "channel-a"),
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

  it("only edges from ENABLED carry tiers participate in the sort", () => {
    // B carries A, but the carry tier is disabled → input order preserved
    const rows = [
      makeRow(ID_B, "B", "channel-b"),
      makeRow(ID_A, "A", "channel-a"),
    ];
    const configs = [
      makeConfig(ID_B, {
        tiers: [makeTier("t1", ID_B, "channel-as-source", 0, ID_A, false)],
      }),
    ];
    const topology = buildPlayoutTopology(rows, configs);
    const ids = topology.channels.map((c) => c.id);
    // Disabled carry → no edge → input order preserved (B before A)
    expect(ids[0]).toBe(ID_B);
    expect(ids[1]).toBe(ID_A);
  });
});

describe("buildPlayoutTopology — cycle detection", () => {
  it("throws when a self-loop is detected", () => {
    const rows = [makeRow(ID_A, "A", "channel-a")];
    const configs = [
      makeConfig(ID_A, {
        tiers: [makeTier("t1", ID_A, "channel-as-source", 0, ID_A)],
      }),
    ];
    expect(() => buildPlayoutTopology(rows, configs)).toThrow();
  });

  it("throws when a 2-cycle is detected", () => {
    const rows = [
      makeRow(ID_A, "A", "channel-a"),
      makeRow(ID_B, "B", "channel-b"),
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

  it("drops carry tier and continues (does not throw) when sourceChannelId references unknown channel", () => {
    // Finding 6 fix: unknown carry reference drops that tier + warns, render continues.
    const rows = [makeRow(ID_A, "A", "channel-a")];
    const configs = [
      makeConfig(ID_A, {
        tiers: [
          makeTier("t1", ID_A, "channel-as-source", 0, ID_B), // ID_B not in rows
          makeTier("t2", ID_A, "queue", 1),                    // queue tier still present
        ],
      }),
    ];
    // Should NOT throw; bad carry tier is dropped, queue tier survives
    const topology = buildPlayoutTopology(rows, configs);
    const ch = topology.channels[0]!;
    // The carry tier was dropped; only the queue tier remains
    expect(ch.tiers).toHaveLength(1);
    expect(ch.tiers[0]!.type).toBe("queue");
  });
});
