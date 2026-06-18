import { SNC_TV_BROADCAST } from "./channels.js";
import { detectChannelSourceCycles } from "./editorial-graph.js";
import type { ChannelSourceEdge } from "./editorial-graph.js";
import { ValidationError } from "@snc/shared";
import type { EditorialConfigWithTiers, EditorialMode } from "@snc/shared";

// ── Pool scope ──

/**
 * Descriptor for the ownership-scoped pool of content a channel draws from.
 *
 * - `{ creatorId }` — the channel belongs to a specific creator; pool is
 *   restricted to that creator's content.
 * - `{ allCreators: true }` — the channel is platform-owned; pool spans all
 *   creators' content.
 *
 * Kept local to this module (rather than imported from editorial-config) to
 * preserve the pure no-DB nature of playout-topology — editorial-config.ts
 * has a top-level DB import that would break topology unit tests.
 */
export type PoolScope =
  | { readonly creatorId: string }
  | { readonly allCreators: true };

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
 * - `queue` — request.queue + pool auto-fill as one unified program source.
 *   `queueId` is the operator request.queue id; `poolScope` scopes the pool feed
 *   (creator-scoped or all-creators).
 * - `channel-as-source` — another channel's rendered `_source` var (carry model).
 *   `sourceLiqVar` is the fully-resolved Liquidsoap variable (e.g. `ch_<uuid>_source`),
 *   NOT the raw channel ID.
 *
 * Rejected: a separate `pool` variant — queue and pool are one continuous program
 * source (the operator queue plays track-by-track; when empty it falls through to
 * the pool auto-fill). The unified-program model dissolves the auto-semantics
 * ambiguity that a split-tier model creates.
 */
export type PlayoutEditorialTier =
  | { readonly type: "live" }
  | { readonly type: "queue"; readonly queueId: string; readonly poolScope: PoolScope }
  | { readonly type: "channel-as-source"; readonly sourceLiqVar: string };

/** Input row shape — deliberately local so callers pass plain data, not Drizzle rows.
 * Carries ownership + creatorId so buildPlayoutTopology can resolve poolScope without
 * a second DB call. */
export interface PlayoutChannelRow {
  readonly id: string;
  readonly name: string;
  readonly srsStreamName: string;
  /** Ownership class: "creator" | "platform" (or other future values). */
  readonly ownership: string;
  /** Creator ID when ownership === "creator"; null for platform-owned channels. */
  readonly creatorId: string | null;
  /**
   * Channel role: "playout" | "broadcast". The broadcast channel (S/NC TV) renders its
   * editorial source as a `fallback(transitions=[…])` with the `:1936` live input + switch
   * telemetry. Defaults to "playout" when absent (the query is widened to include the
   * broadcast role in the `topology` story).
   */
  readonly role?: string;
}

/** Per-channel topology facts derived from a DB channel row. */
export interface PlayoutChannelTopology {
  readonly id: string;
  readonly name: string;
  readonly srsStreamName: string;
  /**
   * Channel role: `"playout"` for ordinary content channels, `"broadcast"` for S/NC TV.
   * The broadcast channel renders its editorial source as a `fallback(transitions=[…])`
   * (source-switch telemetry + the `:1936` live input), where playout channels render the
   * generic `switch()` readiness fallback. See `renderChannelBlock`.
   */
  readonly role: string;
  /** Liquidsoap variable base: `ch_<uuid with hyphens → underscores>`. */
  readonly liqVar: string;
  /** Liquidsoap request.queue id: `channel-<uuid>`. */
  readonly queueId: string;
  /**
   * Harbor HTTP control paths registered in the .liq (UUID verbatim, hyphens kept).
   *
   * `mode` and `manual` are intentionally absent (B1 downgrade, 2026-06-17): mode
   * and manual-pin are render-time-static — they apply via regenerate-and-restart, not
   * via live harbor mutation. The `/mode` and `/manual` endpoints are not emitted.
   * `arm` is the only live editorial-control path; it remains here.
   */
  readonly harborPaths: {
    readonly queue: string;
    readonly skip: string;
    readonly nowPlaying: string;
    readonly arm: string;
  };
  /** API callback path the channel posts track events to. */
  readonly trackEventPath: string;
  /** Editorial control mode. `"auto"` by default when no config exists. */
  readonly mode: EditorialMode;
  /**
   * Index into the **enabled** `tiers` array for the pinned manual tier when
   * `mode === "manual"`; null otherwise. Resolved from the config's `manualTierId`.
   *
   * B2 fix (2026-06-17): this index is computed over the enabled-tier filtered array
   * (the same array `tiers` contains), NOT over `config.tiers` (the full unfiltered
   * array). A disabled tier before the pinned tier would have produced an out-of-range
   * index against `tierVarNames`, silently pinning to `mksafe(blank())` on restart.
   */
  readonly manualTierIndex: number | null;
  /**
   * Editorial source tiers in priority order (index 0 = highest priority).
   * Only **enabled** tiers are included — disabled tiers are not part of the
   * auto readiness fallback. Channels without editorial config default to a
   * single queue tier.
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

/**
 * Build the harbor control paths for a playout channel (UUID verbatim).
 *
 * `mode` and `manual` are NOT included (B1 downgrade, 2026-06-17): those endpoints
 * are removed from the rendered .liq because mode/manual-pin are now render-time-static
 * (applied via regenerate-and-restart). Only `arm` remains as the live editorial verb.
 */
export const harborChannelPaths = (
  channelId: string,
): PlayoutChannelTopology["harborPaths"] => ({
  queue: `/channels/${channelId}/queue`,
  skip: `/channels/${channelId}/skip`,
  nowPlaying: `/channels/${channelId}/now-playing`,
  arm: `/channels/${channelId}/arm`,
});

// ── Private: Editorial tier resolution ──

/**
 * Map a single editorial tier config entry to a resolved `PlayoutEditorialTier`.
 * `channel-as-source` tiers resolve the source channel's liqVar-derived `_source`
 * variable; the caller must supply a lookup function for this.
 *
 * Returns null and logs a warning for an unknown `channel-as-source` source channel —
 * dropping a single bad carry tier is safer than failing the entire render. The FK
 * cascade on `sourceChannelId` makes this a defense-in-depth guard (dangling refs
 * should not occur in practice).
 *
 * @throws {ValidationError} For unrecognized tier types (build-time invariant violation).
 */
const resolveEditorialTier = (
  tier: { tierType: string; queueId?: string; sourceChannelId?: string | null; priority: number },
  channelQueueId: string,
  poolScope: PoolScope,
  resolveSourceVar: (sourceChannelId: string) => string | null,
): PlayoutEditorialTier | null => {
  switch (tier.tierType) {
    case "live":
      return { type: "live" };
    case "queue":
      return { type: "queue", queueId: channelQueueId, poolScope };
    case "channel-as-source": {
      const sourceId = tier.sourceChannelId;
      if (!sourceId) {
        throw new ValidationError(
          `channel-as-source tier has no sourceChannelId (priority ${tier.priority})`,
        );
      }
      const sourceLiqVar = resolveSourceVar(sourceId);
      if (sourceLiqVar === null) {
        // Unknown referenced channel — drop this carry tier + warn (finding 6).
        // A bad tier fails only itself, not the whole render.
        console.warn(
          `[playout-topology] channel-as-source references unknown channel ${sourceId} ` +
          `(priority ${tier.priority}) — dropping tier, render continues`,
        );
        return null;
      }
      return { type: "channel-as-source", sourceLiqVar };
    }
    default:
      throw new ValidationError(`Unknown editorial tier type: ${tier.tierType}`);
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
 * Edges are passed directly from `buildPlayoutTopology` (which has them from the
 * config at tier-resolution time) rather than reverse-mapped from the rendered
 * `sourceLiqVar` string. This avoids the fragile string-strip round-trip that
 * previously reconstructed channelId from `ch_<uuid>_source` (finding 4).
 *
 * @throws {ValidationError} If a cycle is detected (defense-in-depth; config-schema
 *   rejects cycles on write, so a cycle here is a build-time invariant violation).
 */
const topoSort = (
  channels: PlayoutChannelTopology[],
  edges: ChannelSourceEdge[],
): PlayoutChannelTopology[] => {
  // Fast path: no edges → preserve input order exactly
  if (edges.length === 0) return channels;

  // Defensive cycle check (config-schema should have already rejected these)
  const cycleResult = detectChannelSourceCycles(edges);
  if (!cycleResult.ok) {
    throw new ValidationError(
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
 * Disabled tiers (`enabled === false`) are excluded from the resolved tier list — they are
 * not included in the auto readiness fallback.
 *
 * Channel blocks are emitted in topological order so any referenced `_source` variable is
 * defined before the channel that references it. When no channel-as-source edges exist
 * (the current state), input row order is preserved exactly.
 *
 * @throws {ValidationError} If a cycle exists in the channel-as-source graph
 *   (build-time invariant violation).
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

  /**
   * Resolve a source channel's _source liqVar. Returns null when the channel
   * is unknown (carry tier is dropped + warning rather than failing the render).
   */
  const resolveSourceVar = (sourceChannelId: string): string | null => {
    const liqVar = channelLiqVars.get(sourceChannelId);
    if (!liqVar) return null;
    return `${liqVar}_source`;
  };

  // Collect channel-as-source edges as we resolve tiers (finding 4 fix: build edges
  // directly here rather than reverse-mapping sourceLiqVar back to a channelId later).
  const carryEdges: ChannelSourceEdge[] = [];

  // Map rows to unsorted channel topologies
  const unsorted: PlayoutChannelTopology[] = rows.map((row) => {
    const queueId = `channel-${row.id}`;
    const config = configByChannelId.get(row.id);
    // Resolve pool scope inline (mirrors poolContentScope in editorial-config.ts;
    // kept local to avoid pulling in that module's DB import in topology unit tests).
    const scope: PoolScope =
      row.ownership === "creator" && row.creatorId != null
        ? { creatorId: row.creatorId }
        : { allCreators: true };

    let mode: EditorialMode;
    let manualTierIndex: number | null;
    let tiers: readonly PlayoutEditorialTier[];

    if (!config || config.tiers.length === 0) {
      // Config-less default: queue-only, auto mode
      mode = "auto";
      manualTierIndex = null;
      tiers = [{ type: "queue", queueId, poolScope: scope }];
    } else {
      mode = config.mode;

      // Filter to enabled tiers only (disabled tiers are not in the fallback),
      // then resolve in priority order (already sorted ascending by the service).
      const enabledTiers = config.tiers.filter((t) => t.enabled !== false);

      const resolvedTiers = enabledTiers
        .map((tier) => resolveEditorialTier(tier, queueId, scope, resolveSourceVar))
        .filter((t): t is PlayoutEditorialTier => t !== null);

      // Build channel-as-source edges from the config (finding 4 fix: use the config
      // tier's sourceChannelId directly rather than reverse-mapping from the rendered
      // sourceLiqVar string later in topoSort). Only include edges for source channels
      // that are actually known — unknown refs were dropped by resolveEditorialTier
      // returning null, so they must not participate in topoSort.
      for (const tier of enabledTiers) {
        if (
          tier.tierType === "channel-as-source" &&
          tier.sourceChannelId != null &&
          channelLiqVars.has(tier.sourceChannelId)
        ) {
          carryEdges.push({ channelId: row.id, sourceChannelId: tier.sourceChannelId });
        }
      }

      tiers = resolvedTiers.length > 0
        ? resolvedTiers
        : [{ type: "queue", queueId, poolScope: scope }]; // degenerate: all tiers disabled

      // Resolve manualTierIndex: find the index among the ENABLED tiers (enabledTiers)
      // whose ID matches manualTierId.
      //
      // B2 fix (2026-06-17): previously used config.tiers.findIndex (full array), which
      // returns the wrong index when a disabled tier precedes the pinned tier — a disabled
      // tier at index 0 with the pinned tier at full-array index 1 would yield index 1,
      // but tierVarNames has the pinned tier at enabled-array index 0 → out-of-range →
      // mksafe(blank()) pinned on restart. Now indexed against enabledTiers to match
      // the tierVarNames array the render builds from the same filtered list.
      if (mode === "manual" && config.manualTierId != null) {
        const idx = enabledTiers.findIndex((t) => t.id === config.manualTierId);
        manualTierIndex = idx >= 0 ? idx : null;
      } else {
        manualTierIndex = null;
      }
    }

    return {
      id: row.id,
      name: row.name,
      srsStreamName: row.srsStreamName,
      role: row.role ?? "playout",
      liqVar: liqId(row.id),
      queueId,
      harborPaths: harborChannelPaths(row.id),
      trackEventPath: `/api/playout/channels/${row.id}/track-event`,
      mode,
      manualTierIndex,
      tiers,
    };
  });

  // Topologically sort channels so referenced _source vars are defined first.
  // Pass carryEdges directly (built above) — no string-stripping reverse-map needed.
  const channels = topoSort(unsorted, carryEdges);

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
