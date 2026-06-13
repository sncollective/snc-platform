import { describe, it, expect } from "vitest";

import {
  buildPlayoutTopology,
  harborChannelPaths,
} from "../../src/services/playout-topology.js";

const ROW = {
  id: "903e6a20-0dea-42b1-8dd5-86afbec496ac",
  name: "Classics",
  srsStreamName: "channel-classics",
};

describe("harborChannelPaths", () => {
  it("builds the three control paths with the UUID verbatim", () => {
    expect(harborChannelPaths(ROW.id)).toEqual({
      queue: "/channels/903e6a20-0dea-42b1-8dd5-86afbec496ac/queue",
      skip: "/channels/903e6a20-0dea-42b1-8dd5-86afbec496ac/skip",
      nowPlaying: "/channels/903e6a20-0dea-42b1-8dd5-86afbec496ac/now-playing",
    });
  });
});

describe("buildPlayoutTopology", () => {
  it("derives per-channel naming from the row", () => {
    const topology = buildPlayoutTopology([ROW]);

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
      { id: "aaaaaaaa-0000-0000-0000-000000000001", name: "A", srsStreamName: "channel-a" },
      { id: "bbbbbbbb-0000-0000-0000-000000000002", name: "B", srsStreamName: "channel-b" },
    ]);

    expect(topology.broadcast.fallbackSourceVar).toBe(
      "ch_aaaaaaaa_0000_0000_0000_000000000001_source",
    );
  });

  it("falls back to silence when no playout channels exist", () => {
    const topology = buildPlayoutTopology([]);

    expect(topology.channels).toHaveLength(0);
    expect(topology.broadcast.fallbackSourceVar).toBe("mksafe(blank())");
  });

  it("models runtime env as references with the .liq defaults", () => {
    const { env } = buildPlayoutTopology([]);

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
    expect(buildPlayoutTopology([]).broadcast.queueId).toBe("snc-tv-queue");
  });

  it("pins the static ports", () => {
    const topology = buildPlayoutTopology([]);
    expect(topology.harborPort).toBe(8888);
    expect(topology.srsRtmpPort).toBe(1935);
    expect(topology.broadcastInputPort).toBe(1936);
  });
});
