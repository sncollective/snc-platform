import { SNC_TV_BROADCAST } from "./channels.js";
import { detectChannelSourceCycles } from "./editorial-graph.js";
import type { ChannelSourceEdge } from "./editorial-graph.js";
import type { EditorialConfigWithTiers, EditorialMode } from "@snc/shared";

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

/**
 * A resolved editorial tier ready for the playout render.
 *
 * - `live` — live RTMP ingest from the channel's live-ingest input.
 * - `queue` — request.queue playout (the armed, manually-ordered queue).
 * - `pool` — request.dynamic pool of channel_content items (auto-rotated).
 * - `channel-as-source` — another channel's rendered `_source` var (carry model).
 *   `sourceLiqVar` is the fully-resolved Liquidsoap variable (e.g. `ch_<uuid>_source`),
 *   NOT the raw channel ID.
 */
export type PlayoutEditorialTier =
  | { readonly type: "live" }
  | { readonly type: "queue"; readonly queueId: string }
  | { readonly type: "pool"; readonly poolQueueId: string }
  | { readonly type: "channel-as-source"; readonly sourceLiqVar: string };

/** Input row shape — deliberately local so callers pass plain data, not Drizzle rows.
 * (The module does transitively reach db via the SNC_TV_BROADCAST import from channels.ts;
 * buildPlayoutTopology itself never touches it.) */
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
  /** Editorial control mode. `"auto"` by default when no config exists. */
  readonly mode: EditorialMode;
  /**
   * Index into `tiers` for the pinned manual tier when `mode === "manual"`;
   * null otherwise. Resolved from the config's `manualTierId`.
   */
  readonly manualTierIndex: number | null;
  /**
   * Editorial source tiers in priority order (index 0 = highest priority).
   * Channels without editorial config default to a single queue tier.
   */
  readonly tiers: readonly PlayoutEditorialTier[];
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

/**
 * API path for the Liquidsoap input-switch webhook.
 * Liquidsoap posts here on every fallback transition; the same path is rendered
 * into the .liq template and registered in the API route.
 */
export const BROADCAST_INPUT_SWITCH_PATH = "/api/playout/broadcast/input-switch";

/** Build the harbor control paths for a playout channel (UUID verbatim). */
export const harborChannelPaths = (
  channelId: string,
): PlayoutChannelTopology["harborPaths"] => ({
  queue: `/channels/${channelId}/queue`,
  skip: `/channels/${channelId}/skip`,
  nowPlaying: `/channels/${channelId}/now-playing`,
});

// ── Private: Editorial tier resolution ──

/**
 * Map a single editorial tier config entry to a resolved `PlayoutEditorialTier`.
 * `channel-as-source` tiers resolve the source channel's liqVar-derived `_source`
 * variable; the caller must supply a lookup function for this.
 */
const resolveEditorialTier = (
  tier: { tierType: string; queueId?: string; sourceChannelId?: string | null; priority: number },
  channelQueueId: string,
  resolveSourceVar: (sourceChannelId: string) => string,
): PlayoutEditorialTier => {
  switch (tier.tierType) {
    case "live":
      return { type: "live" };
    case "queue":
      return { type: "queue", queueId: channelQueueId };
    case "pool":
      // Pool is fed via request.dynamic from channel_content; poolQueueId = channelQueueId
      return { type: "pool", poolQueueId: channelQueueId };
    case "channel-as-source": {
      const sourceId = tier.sourceChannelId;
      if (!sourceId) {
        throw new Error(
          `channel-as-source tier has no sourceChannelId (priority ${tier.priority})`,
        );
      }
      return { type: "channel-as-source", sourceLiqVar: resolveSourceVar(sourceId) };
    }
    default:
      throw new Error(`Unknown editorial tier type: ${tier.tierType}`);
  }
};

/**
 * Build a stable topological order of channel topology entries.
 *
 * Channels that are referenced as a channel-as-source by other channels must appear
 * BEFORE the referencing channel so the rendered `_source` variable is defined first.
 *
 * When there are no channel-as-source edges, the input order is preserved exactly
 * (stable sort guarantee — critical for render golden snapshots).
 *
 * Throws if a cycle is detected (defense-in-depth; config-schema rejects cycles on
 * write, so a cycle here is a build-time invariant violation).
 */
const topoSort = (
  channels: PlayoutChannelTopology[],
): PlayoutChannelTopology[] => {
  // Collect channel-as-source edges from the resolved tiers
  const edges: ChannelSourceEdge[] = [];
  for (const ch of channels) {
    for (const tier of ch.tiers) {
      if (tier.type === "channel-as-source") {
        // Resolve sourceLiqVar back to a channel ID for the cycle checker.
        // Format: `ch_<uuid_with_underscores>_source` → strip prefix/suffix, restore hyphens.
        const varName = tier.sourceLiqVar.replace(/_source$/, "").replace(/^ch_/, "");
        const sourceChannelId = varName.replaceAll("_", "-");
        edges.push({ channelId: ch.id, sourceChannelId });
      }
    }
  }

  // Fast path: no edges → preserve input order exactly
  if (edges.length === 0) return channels;

  // Defensive cycle check (config-schema should have already rejected these)
  const cycleResult = detectChannelSourceCycles(edges);
  if (!cycleResult.ok) {
    throw new Error(
      `buildPlayoutTopology: cannot sort channels — ${cycleResult.error.message}`,
    );
  }

  // Kahn's algorithm for topological sort (preserves input order within a level)
  const idToChannel = new Map(channels.map((ch) => [ch.id, ch]));

  // Build adjacency: referencing → [referenced] (referenced must come first)
  const dependsOn = new Map<string, Set<string>>(); // ch → set of channels it depends on
  const dependedOnBy = new Map<string, Set<string>>(); // ch → set of channels that depend on it

  for (const ch of channels) {
    if (!dependsOn.has(ch.id)) dependsOn.set(ch.id, new Set());
    if (!dependedOnBy.has(ch.id)) dependedOnBy.set(ch.id, new Set());
  }

  for (const { channelId, sourceChannelId } of edges) {
    // channelId references sourceChannelId → sourceChannelId must come first
    dependsOn.get(channelId)?.add(sourceChannelId);
    dependedOnBy.get(sourceChannelId)?.add(channelId);
  }

  // Initialize queue with channels that have no dependencies, in input order
  const inputOrder = new Map(channels.map((ch, i) => [ch.id, i]));
  const queue: string[] = channels
    .filter((ch) => (dependsOn.get(ch.id)?.size ?? 0) === 0)
    .map((ch) => ch.id);

  const result: PlayoutChannelTopology[] = [];
  const emitted = new Set<string>();

  while (queue.length > 0) {
    // Take from front (stable: queue is already in input order for ties)
    const id = queue.shift()!;
    if (emitted.has(id)) continue;
    emitted.add(id);
    result.push(idToChannel.get(id)!);

    // Collect newly-unblocked channels and re-sort by input order to maintain stability
    const unblocked: string[] = [];
    for (const dependerId of dependedOnBy.get(id) ?? []) {
      const deps = dependsOn.get(dependerId)!;
      deps.delete(id);
      if (deps.size === 0 && !emitted.has(dependerId)) {
        unblocked.push(dependerId);
      }
    }
    // Maintain input order among newly-unblocked items
    unblocked.sort((a, b) => (inputOrder.get(a) ?? 0) - (inputOrder.get(b) ?? 0));
    queue.push(...unblocked);
  }

  return result;
};

/**
 * Assemble the playout topology from DB channel rows and editorial configs. Pure — no DB,
 * no filesystem, no config reads; all external inputs are passed by the caller.
 *
 * Channels without an editorial config (or with empty tiers) default to `mode: "auto"` with
 * a single queue tier — preserving the current degenerate queue-only render behavior.
 *
 * Channel blocks are emitted in topological order so any referenced `_source` variable is
 * defined before the channel that references it. When no channel-as-source edges exist
 * (the current state), input row order is preserved exactly.
 *
 * @throws If a cycle exists in the channel-as-source graph (build-time invariant violation).
 *
 * The broadcast fallback is the first playout channel's source (after topo sort), or
 * silence when no playout channels exist.
 */
export const buildPlayoutTopology = (
  rows: readonly PlayoutChannelRow[],
  editorialConfigs: readonly EditorialConfigWithTiers[],
): PlayoutTopology => {
  // Index configs by channelId for O(1) lookup
  const configByChannelId = new Map(editorialConfigs.map((c) => [c.channelId, c]));

  // Build a liqVar lookup for resolving channel-as-source sourceLiqVar values.
  // We need this before resolving tiers, so build liqVars first.
  const channelLiqVars = new Map(rows.map((row) => [row.id, liqId(row.id)]));

  const resolveSourceVar = (sourceChannelId: string): string => {
    const liqVar = channelLiqVars.get(sourceChannelId);
    if (!liqVar) {
      throw new Error(
        `buildPlayoutTopology: channel-as-source references unknown channel ${sourceChannelId}`,
      );
    }
    return `${liqVar}_source`;
  };

  // Map rows to unsorted channel topologies
  const unsorted: PlayoutChannelTopology[] = rows.map((row) => {
    const queueId = `channel-${row.id}`;
    const config = configByChannelId.get(row.id);

    let mode: EditorialMode;
    let manualTierIndex: number | null;
    let tiers: readonly PlayoutEditorialTier[];

    if (!config || config.tiers.length === 0) {
      // Config-less default: queue-only, auto mode
      mode = "auto";
      manualTierIndex = null;
      tiers = [{ type: "queue", queueId }];
    } else {
      mode = config.mode;

      // Resolve tiers in priority order (already sorted ascending by the service)
      const resolvedTiers = config.tiers.map((tier) =>
        resolveEditorialTier(tier, queueId, resolveSourceVar),
      );
      tiers = resolvedTiers;

      // Resolve manualTierIndex: find the index of the tier whose ID matches manualTierId
      if (mode === "manual" && config.manualTierId != null) {
        const idx = config.tiers.findIndex((t) => t.id === config.manualTierId);
        manualTierIndex = idx >= 0 ? idx : null;
      } else {
        manualTierIndex = null;
      }
    }

    return {
      id: row.id,
      name: row.name,
      srsStreamName: row.srsStreamName,
      liqVar: liqId(row.id),
      queueId,
      harborPaths: harborChannelPaths(row.id),
      trackEventPath: `/api/playout/channels/${row.id}/track-event`,
      mode,
      manualTierIndex,
      tiers,
    };
  });

  // Topologically sort channels so referenced _source vars are defined first
  const channels = topoSort(unsorted);

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
