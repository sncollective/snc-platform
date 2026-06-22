import { randomUUID } from "node:crypto";

import { and, eq, inArray } from "drizzle-orm";
import { ok, err, AppError } from "@snc/shared";
import type { Result, ChannelOwnership, ChannelRole, DprImage } from "@snc/shared";

import { db } from "../db/connection.js";
import { channels } from "../db/schema/streaming.schema.js";
import { creatorProfiles } from "../db/schema/creator.schema.js";
import { resolveCreatorUrls } from "../lib/creator-url.js";
import { config } from "../config.js";
import { rootLogger } from "../logging/logger.js";
import { eventBus } from "./event-bus.js";
import { dispatchChannelGoLive } from "./notify-dispatch.js";

// ── Public Types ──

export type ChannelInfo = {
  id: string;
  name: string;
  ownership: ChannelOwnership;
  role: ChannelRole;
  thumbnailUrl: string | null;
  srsStreamName: string;
  hlsUrl: string | null;
  creatorId: string | null;
  creator: {
    id: string;
    displayName: string;
    handle: string | null;
    avatarUrl: string | null;
    avatar: DprImage | null;
  } | null;
  isActive: boolean;
};

// ── Canonical Channel Identities ──

/**
 * S/NC TV broadcast channel identity — the single source for the seed script
 * and the generated Liquidsoap config (`CHANNEL_SNCTV_STREAM` env default).
 * Keeping one definition prevents silent drift between the DB-seeded channel
 * and the stream name Liquidsoap publishes to.
 *
 * `ownership` and `role` are explicit here so callers cannot accidentally
 * provision this with wrong identity facets.
 */
export const SNC_TV_BROADCAST = {
  name: "S/NC TV",
  srsStreamName: "snc-tv",
  ownership: "platform" as const,
  role: "broadcast" as const,
} as const;

// ── Channel Priority ──

/**
 * Default-channel selection priority, keyed on identity `role`.
 * Broadcast (S/NC TV) wins; an actively-ingesting creator channel ranks next;
 * playout pools last. Ordering preserves the legacy type-based priority
 * (broadcast > live > playout) under the role names.
 */
const ROLE_PRIORITY: Record<ChannelRole, number> = {
  broadcast: 0,
  "live-ingest": 1,
  playout: 2,
};

// ── Private Helpers ──

const buildHlsUrl = (srsStreamName: string): string | null => {
  const base = config.SRS_HLS_URL;
  if (!base) return null;
  return `${base}/${srsStreamName}.m3u8`;
};

// ── Public API ──

/** Get active channels, enriched with creator profiles, ordered by role priority. */
export const getActiveChannels = async (): Promise<ChannelInfo[]> => {
  const rows = await db
    .select()
    .from(channels)
    .where(eq(channels.isActive, true));

  // Batch-fetch all referenced creator profiles in a single query
  const creatorIds = rows
    .map((r) => r.creatorId)
    .filter((id): id is string => id !== null);

  const profileMap = new Map<string, ChannelInfo["creator"]>();
  if (creatorIds.length > 0) {
    const profiles = await db
      .select({
        id: creatorProfiles.id,
        displayName: creatorProfiles.displayName,
        handle: creatorProfiles.handle,
        avatarKey: creatorProfiles.avatarKey,
        bannerKey: creatorProfiles.bannerKey,
      })
      .from(creatorProfiles)
      .where(inArray(creatorProfiles.id, creatorIds));

    for (const profile of profiles) {
      const urls = resolveCreatorUrls(profile);
      profileMap.set(profile.id, {
        id: profile.id,
        displayName: profile.displayName,
        handle: profile.handle,
        avatarUrl: urls.avatarUrl,
        avatar: urls.avatar,
      });
    }
  }

  const result: ChannelInfo[] = rows.map((row) => ({
    id: row.id,
    name: row.name,
    ownership: row.ownership as ChannelOwnership,
    role: row.role as ChannelRole,
    thumbnailUrl: row.thumbnailUrl ?? null,
    srsStreamName: row.srsStreamName,
    hlsUrl: buildHlsUrl(row.srsStreamName),
    creatorId: row.creatorId,
    creator: row.creatorId !== null ? (profileMap.get(row.creatorId) ?? null) : null,
    isActive: row.isActive,
  }));

  // Sort by priority (lower number = higher priority)
  result.sort(
    (a, b) => ROLE_PRIORITY[a.role] - ROLE_PRIORITY[b.role],
  );

  return result;
};

/**
 * Select the default channel from a list of active channels.
 *
 * Picks from the highest-priority tier. Within the same tier, selection is
 * random to distribute load across equivalent channels.
 */
export const selectDefaultChannel = (
  activeChannels: ChannelInfo[],
): string | null => {
  if (activeChannels.length === 0) return null;
  const bestPriority = Math.min(
    ...activeChannels.map((c) => ROLE_PRIORITY[c.role]),
  );
  const topTier = activeChannels.filter(
    (c) => ROLE_PRIORITY[c.role] === bestPriority,
  );
  return topTier[Math.floor(Math.random() * topTier.length)]!.id;
};

/**
 * Read-only lookup of the creatorId for a creator-owned channel.
 *
 * Returns the `creatorId` when `ownership='creator'`, or `null` when the
 * channel is platform-owned or does not exist. Used by queue-transition
 * publishers to decide whether to emit `content.playout-changed`.
 *
 * A DB error propagates (it does not catch). The queue-transition publisher
 * calls this inside its fire-and-forget wrapper, which swallows the throw so a
 * lookup failure degrades to "no creator emit this tick" without failing the
 * transition. A non-fire-and-forget caller must handle the throw itself.
 */
export const findChannelCreatorId = async (
  channelId: string,
): Promise<string | null> => {
  const [row] = await db
    .select({ ownership: channels.ownership, creatorId: channels.creatorId })
    .from(channels)
    .where(eq(channels.id, channelId));
  if (!row || row.ownership !== "creator") return null;
  return row.creatorId;
};

/**
 * Read-only lookup of a creator's persistent channel id.
 *
 * Returns the channel id when the `ownership='creator'` / `role='live-ingest'`
 * row exists, or `null` when the channel has not yet been provisioned.
 * Never creates a row — use `ensureCreatorChannel` for provisioning.
 */
export const findCreatorChannelId = async (
  creatorId: string,
): Promise<string | null> => {
  const [row] = await db
    .select({ id: channels.id })
    .from(channels)
    .where(
      and(
        eq(channels.creatorId, creatorId),
        eq(channels.ownership, "creator"),
        eq(channels.role, "live-ingest"),
      ),
    );
  return row?.id ?? null;
};

/**
 * Idempotently provision a persistent creator channel.
 *
 * Creates a single `ownership='creator'` / `role='live-ingest'` row for the
 * creator if none exists, then returns the channel ID.  When multiple rows
 * exist (backfill artefacts from the old temp-row system), they are deduped
 * to the earliest-created row and the duplicates are deleted.
 *
 * Called from `createStreamKey` — this is the lazy-provisioning trigger.
 * The channel starts inactive (`isActive: false`); it is activated on publish
 * via `activateLiveChannel`.
 */
export const ensureCreatorChannel = async (
  creatorId: string,
  creatorName: string,
): Promise<Result<{ channelId: string }, AppError>> => {
  try {
    const existing = await db
      .select({ id: channels.id, createdAt: channels.createdAt })
      .from(channels)
      .where(
        and(
          eq(channels.creatorId, creatorId),
          eq(channels.ownership, "creator"),
          eq(channels.role, "live-ingest"),
        ),
      );

    if (existing.length === 0) {
      // No channel yet — provision one.  The placeholder srsStreamName is a
      // deterministic, creator-scoped value; it is overwritten on first publish
      // with the actual SRS stream name.
      const channelId = randomUUID();
      await db.insert(channels).values({
        id: channelId,
        name: `${creatorName}'s Stream`,
        ownership: "creator",
        role: "live-ingest",
        srsStreamName: `creator-${creatorId}`,
        creatorId,
        isActive: false,
      });
      return ok({ channelId });
    }

    // Sort ascending by createdAt so the oldest row survives dedup.
    const sorted = [...existing].sort(
      (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
    );
    const canonical = sorted[0]!;

    if (sorted.length > 1) {
      // Dedupe: delete all duplicate rows, keeping the oldest.
      const dupeIds = sorted.slice(1).map((r) => r.id);
      rootLogger.warn(
        { creatorId, canonical: canonical.id, dupeIds },
        "Deduping duplicate creator live-ingest channel rows",
      );
      for (const dupeId of dupeIds) {
        await db.delete(channels).where(eq(channels.id, dupeId));
      }
    }

    return ok({ channelId: canonical.id });
  } catch (e) {
    rootLogger.error({ err: e }, "Failed to ensure creator channel");
    return err(
      new AppError(
        "CHANNEL_ENSURE_ERROR",
        "Failed to ensure creator channel",
        500,
      ),
    );
  }
};

/**
 * Activate a creator's persistent channel when they start streaming.
 *
 * Finds the existing `ownership='creator'` / `role='live-ingest'` row by
 * `creatorId` and updates it in-place: sets `isActive`, `streamSessionId`,
 * and `srsStreamName` (to the real SRS stream name from the on_publish
 * callback, so HLS URL resolution stays correct).  Never inserts a new row —
 * `ensureCreatorChannel` is the only provisioning path.
 *
 * If the persistent row is missing (race between stream-key creation and
 * first publish), a new row is created as a self-healing fallback.
 *
 * Duplicate on_publish retries that fire `live: true` again are intentional
 * (notification semantics).  Called from `ensureLiveChannelWithChat`.
 */
export const activateLiveChannel = async (opts: {
  creatorId: string;
  creatorName: string;
  streamSessionId: string;
  srsStreamName: string;
}): Promise<Result<{ channelId: string }, AppError>> => {
  try {
    const [channel] = await db
      .select({ id: channels.id })
      .from(channels)
      .where(
        and(
          eq(channels.creatorId, opts.creatorId),
          eq(channels.ownership, "creator"),
          eq(channels.role, "live-ingest"),
        ),
      );

    if (!channel) {
      // Persistent channel missing — provision one on-the-fly so the publish
      // path is never blocked.  Self-heals if stream-key creation raced.
      const channelId = randomUUID();
      await db.insert(channels).values({
        id: channelId,
        name: `Live: ${opts.creatorName}`,
        ownership: "creator",
        role: "live-ingest",
        srsStreamName: opts.srsStreamName,
        creatorId: opts.creatorId,
        streamSessionId: opts.streamSessionId,
        isActive: true,
      });
      rootLogger.warn(
        { creatorId: opts.creatorId, channelId },
        "Creator channel missing at publish time — provisioned on-the-fly",
      );
      eventBus.publish({ type: "channel.live-state-changed", channelId, live: true });
      void dispatchChannelGoLive(channelId);
      return ok({ channelId });
    }

    await db
      .update(channels)
      .set({
        name: `Live: ${opts.creatorName}`,
        srsStreamName: opts.srsStreamName,
        streamSessionId: opts.streamSessionId,
        isActive: true,
        updatedAt: new Date(),
      })
      .where(eq(channels.id, channel.id));

    eventBus.publish({ type: "channel.live-state-changed", channelId: channel.id, live: true });
    void dispatchChannelGoLive(channel.id);
    return ok({ channelId: channel.id });
  } catch (e) {
    rootLogger.error({ err: e }, "Failed to activate live channel");
    return err(
      new AppError(
        "CHANNEL_ACTIVATE_ERROR",
        "Failed to activate live channel",
        500,
      ),
    );
  }
};

/**
 * Deactivate a live channel when a creator stops streaming.
 * Called from the on_unpublish callback.
 */
export const deactivateLiveChannel = async (
  streamSessionId: string,
): Promise<Result<{ channelId: string } | null, AppError>> => {
  try {
    const [channel] = await db
      .select({ id: channels.id })
      .from(channels)
      .where(
        and(
          eq(channels.streamSessionId, streamSessionId),
          eq(channels.isActive, true),
        ),
      );

    if (!channel) {
      return ok(null);
    }

    await db
      .update(channels)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(channels.id, channel.id));

    eventBus.publish({ type: "channel.live-state-changed", channelId: channel.id, live: false });
    return ok({ channelId: channel.id });
  } catch (e) {
    rootLogger.error({ err: e }, "Failed to deactivate live channel");
    return err(
      new AppError(
        "CHANNEL_DEACTIVATE_ERROR",
        "Failed to deactivate live channel",
        500,
      ),
    );
  }
};

/**
 * Ensure a broadcast channel exists. Idempotent — creates on first call,
 * updates name and activates if inactive.
 */
export const ensureBroadcast = async (opts: {
  name: string;
  srsStreamName: string;
  defaultPlayoutChannelId?: string;
}): Promise<Result<{ channelId: string }, AppError>> => {
  try {
    const [existing] = await db
      .select({ id: channels.id, isActive: channels.isActive })
      .from(channels)
      .where(eq(channels.srsStreamName, opts.srsStreamName));

    if (existing) {
      await db
        .update(channels)
        .set({
          name: opts.name,
          isActive: true,
          defaultPlayoutChannelId: opts.defaultPlayoutChannelId ?? null,
          updatedAt: new Date(),
        })
        .where(eq(channels.id, existing.id));
      return ok({ channelId: existing.id });
    }

    const channelId = randomUUID();

    await db.insert(channels).values({
      id: channelId,
      name: opts.name,
      ownership: "platform",
      role: "broadcast",
      srsStreamName: opts.srsStreamName,
      isActive: true,
      defaultPlayoutChannelId: opts.defaultPlayoutChannelId ?? null,
    });

    return ok({ channelId });
  } catch (e) {
    rootLogger.error({ err: e }, "Failed to ensure broadcast channel");
    return err(
      new AppError(
        "CHANNEL_ENSURE_ERROR",
        "Failed to ensure broadcast channel",
        500,
      ),
    );
  }
};

/**
 * Ensure a playout channel exists. Idempotent — creates on first call, activates if inactive.
 * Called from seed script or server startup.
 */
export const ensurePlayout = async (opts: {
  name: string;
  srsStreamName: string;
}): Promise<Result<{ channelId: string }, AppError>> => {
  try {
    const [existing] = await db
      .select({ id: channels.id, isActive: channels.isActive })
      .from(channels)
      .where(eq(channels.srsStreamName, opts.srsStreamName));

    if (existing) {
      await db
        .update(channels)
        .set({ name: opts.name, isActive: true, updatedAt: new Date() })
        .where(eq(channels.id, existing.id));
      return ok({ channelId: existing.id });
    }

    const channelId = randomUUID();

    await db.insert(channels).values({
      id: channelId,
      name: opts.name,
      ownership: "platform",
      role: "playout",
      srsStreamName: opts.srsStreamName,
      isActive: true,
    });

    return ok({ channelId });
  } catch (e) {
    rootLogger.error({ err: e }, "Failed to ensure playout channel");
    return err(
      new AppError(
        "CHANNEL_ENSURE_ERROR",
        "Failed to ensure playout channel",
        500,
      ),
    );
  }
};
