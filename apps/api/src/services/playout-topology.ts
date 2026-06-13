import { SNC_TV_BROADCAST } from "./channels.js";

// ── Types ──

/**
 * A value Liquidsoap resolves at .liq runtime via `environment.get` — never
 * resolved at render time. Resolving these in the API process would silently
 * change behavior under container env.
 */
export interface EnvRef {
  readonly envVar: string;
  readonly default: string;
}

/** Input row shape — deliberately local so the topology module imports no DB code. */
export interface PlayoutChannelRow {
  readonly id: string;
  readonly name: string;
  readonly srsStreamName: string;
}

/** Per-channel topology facts derived from a DB channel row. */
export interface PlayoutChannelTopology {
  readonly id: string;
  readonly name: string;
  readonly srsStreamName: string;
  /** Liquidsoap variable base: `ch_<uuid with hyphens → underscores>`. */
  readonly liqVar: string;
  /** Liquidsoap request.queue id: `channel-<uuid>`. */
  readonly queueId: string;
  /** Harbor HTTP control paths registered in the .liq (UUID verbatim, hyphens kept). */
  readonly harborPaths: {
    readonly queue: string;
    readonly skip: string;
    readonly nowPlaying: string;
  };
  /** API callback path the channel posts track events to. */
  readonly trackEventPath: string;
}

/**
 * The full playout topology: everything the generated playout.liq depends on,
 * as one typed document. Channels come from DB state; `env` entries are
 * runtime references the render emits as `environment.get(...)`.
 */
export interface PlayoutTopology {
  readonly harborPort: number;
  readonly srsRtmpPort: number;
  readonly broadcastInputPort: number;
  readonly env: {
    readonly awsEndpoint: EnvRef;
    readonly awsRegion: EnvRef;
    readonly playoutKey: EnvRef;
    readonly srsHost: EnvRef;
    readonly apiHost: EnvRef;
    readonly apiPort: EnvRef;
    readonly callbackSecret: EnvRef;
    readonly sncTvStream: EnvRef;
  };
  readonly channels: readonly PlayoutChannelTopology[];
  readonly broadcast: {
    /**
     * Own datum, NOT derived from the stream name: CHANNEL_SNCTV_STREAM can
     * override the stream name at .liq runtime, but the queue id is baked at
     * render time and does not follow it.
     */
    readonly queueId: string;
    /** Liquidsoap source expression S/NC TV falls back to when live + queue are silent. */
    readonly fallbackSourceVar: string;
  };
}

// ── Private Helpers ──

/** Convert a UUID to a valid Liquidsoap identifier (replace hyphens with underscores, prefix with `ch_`). */
const liqId = (id: string): string => `ch_${id.replaceAll("-", "_")}`;

// ── Public API ──

/**
 * Legacy broadcast now-playing path (S/NC TV) — registered in the rendered
 * .liq and called by the API-side wrapper. One constant on both sides of the
 * harbor contract.
 */
export const HARBOR_LEGACY_NOW_PLAYING = "/now-playing";

/** Build the harbor control paths for a playout channel (UUID verbatim). */
export const harborChannelPaths = (
  channelId: string,
): PlayoutChannelTopology["harborPaths"] => ({
  queue: `/channels/${channelId}/queue`,
  skip: `/channels/${channelId}/skip`,
  nowPlaying: `/channels/${channelId}/now-playing`,
});

/**
 * Assemble the playout topology from DB channel rows. Pure — no DB, no
 * filesystem, no config reads; the only external input is the row list.
 *
 * The broadcast fallback is the first playout channel's source (static
 * selection for now), or silence when no playout channels exist.
 */
export const buildPlayoutTopology = (
  rows: readonly PlayoutChannelRow[],
): PlayoutTopology => {
  const channels = rows.map(
    (row): PlayoutChannelTopology => ({
      id: row.id,
      name: row.name,
      srsStreamName: row.srsStreamName,
      liqVar: liqId(row.id),
      queueId: `channel-${row.id}`,
      harborPaths: harborChannelPaths(row.id),
      trackEventPath: `/api/playout/channels/${row.id}/track-event`,
    }),
  );

  const defaultPlayout = channels[0];

  return {
    harborPort: 8888,
    srsRtmpPort: 1935,
    broadcastInputPort: 1936,
    env: {
      awsEndpoint: { envVar: "AWS_ENDPOINT", default: "http://snc-garage:3900" },
      awsRegion: { envVar: "AWS_DEFAULT_REGION", default: "garage" },
      playoutKey: { envVar: "PLAYOUT_STREAM_KEY", default: "" },
      srsHost: { envVar: "SRS_RTMP_HOST", default: "snc-srs" },
      apiHost: { envVar: "API_CALLBACK_HOST", default: "snc-api" },
      apiPort: { envVar: "API_CALLBACK_PORT", default: "3000" },
      callbackSecret: { envVar: "PLAYOUT_CALLBACK_SECRET", default: "" },
      sncTvStream: {
        envVar: "CHANNEL_SNCTV_STREAM",
        default: SNC_TV_BROADCAST.srsStreamName,
      },
    },
    channels,
    broadcast: {
      queueId: "snc-tv-queue",
      fallbackSourceVar: defaultPlayout
        ? `${defaultPlayout.liqVar}_source`
        : "mksafe(blank())",
    },
  };
};
