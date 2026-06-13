import { randomUUID } from "node:crypto";

import { and, eq, inArray, isNull } from "drizzle-orm";
import { ok, err, AppError } from "@snc/shared";
import type { Result, ChannelType, ChannelOwnership, ChannelRole, DprImage } from "@snc/shared";

import { db } from "../db/connection.js";
import { channels } from "../db/schema/streaming.schema.js";
import { creatorProfiles } from "../db/schema/creator.schema.js";
import { resolveCreatorUrls } from "../lib/creator-url.js";
import { config } from "../config.js";
import { rootLogger } from "../logging/logger.js";
import { eventBus } from "./event-bus.js";

// ── Public Types ──

export type ChannelInfo = {
  id: string;
  name: string;
  type: ChannelType; // legacy; dropped in the contract migration step
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
 */
export const SNC_TV_BROADCAST = {
  name: "S/NC TV",
  srsStreamName: "snc-tv",
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
    type: row.type as ChannelType,
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
 * Create or reactivate a live channel when a creator starts streaming.
 * If a deactivated channel with the same srsStreamName exists, reactivate it
 * with updated metadata. Otherwise create a new one.
 * Called from the on_publish callback after opening a session.
 */
export const createLiveChannel = async (opts: {
  creatorId: string;
  creatorName: string;
  streamSessionId: string;
  srsStreamName: string;
}): Promise<Result<{ channelId: string }, AppError>> => {
  try {
    const [existing] = await db
      .select({ id: channels.id })
      .from(channels)
      .where(eq(channels.srsStreamName, opts.srsStreamName));

    if (existing) {
      await db
        .update(channels)
        .set({
          name: `Live: ${opts.creatorName}`,
          type: "live",
          ownership: "creator",
          role: "live-ingest",
          creatorId: opts.creatorId,
          streamSessionId: opts.streamSessionId,
          isActive: true,
          updatedAt: new Date(),
        })
        .where(eq(channels.id, existing.id));
      // Duplicate live:true on SRS on_publish retries is intentional — notification semantics.
      eventBus.publish({ type: "channel.live-state-changed", channelId: existing.id, live: true });
      return ok({ channelId: existing.id });
    }

    const channelId = randomUUID();

    await db.insert(channels).values({
      id: channelId,
      name: `Live: ${opts.creatorName}`,
      type: "live",
      ownership: "creator",
      role: "live-ingest",
      srsStreamName: opts.srsStreamName,
      creatorId: opts.creatorId,
      streamSessionId: opts.streamSessionId,
      isActive: true,
    });

    eventBus.publish({ type: "channel.live-state-changed", channelId, live: true });
    return ok({ channelId });
  } catch (e) {
    rootLogger.error({ err: e }, "Failed to create live channel");
    return err(
      new AppError(
        "CHANNEL_CREATE_ERROR",
        "Failed to create live channel",
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
      type: "broadcast",
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
      type: "playout",
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
