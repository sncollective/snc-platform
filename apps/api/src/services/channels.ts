import { randomUUID } from "node:crypto";

import { and, eq, inArray, isNull } from "drizzle-orm";
import { ok, err, AppError } from "@snc/shared";
import type { Result, ChannelType } from "@snc/shared";

import { db } from "../db/connection.js";
import { channels } from "../db/schema/streaming.schema.js";
import { creatorProfiles } from "../db/schema/creator.schema.js";
import { resolveCreatorUrls } from "../lib/creator-url.js";
import { config } from "../config.js";

// ── Public Types ──

export type ChannelInfo = {
  id: string;
  name: string;
  type: ChannelType;
  thumbnailUrl: string | null;
  srsStreamName: string;
  hlsUrl: string | null;
  creatorId: string | null;
  creator: {
    id: string;
    displayName: string;
    handle: string | null;
    avatarUrl: string | null;
  } | null;
  isActive: boolean;
};

// ── Channel Priority ──

const CHANNEL_PRIORITY: Record<ChannelType, number> = {
  broadcast: 0,
  scheduled: 1,
  live: 2,
  playout: 3,
};

// ── Private Helpers ──

const buildHlsUrl = (srsStreamName: string): string | null => {
  const base = config.SRS_HLS_URL;
  if (!base) return null;
  return `${base}/${srsStreamName}.m3u8`;
};

// ── Public API ──

/** Get active channels, enriched with creator profiles, ordered by type priority. */
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
      });
    }
  }

  const result: ChannelInfo[] = rows.map((row) => ({
    id: row.id,
    name: row.name,
    type: row.type as ChannelType,
    thumbnailUrl: row.thumbnailUrl ?? null,
    srsStreamName: row.srsStreamName,
    hlsUrl: buildHlsUrl(row.srsStreamName),
    creatorId: row.creatorId,
    creator: row.creatorId !== null ? (profileMap.get(row.creatorId) ?? null) : null,
    isActive: row.isActive,
  }));

  // Sort by priority (lower number = higher priority)
  result.sort(
    (a, b) => CHANNEL_PRIORITY[a.type] - CHANNEL_PRIORITY[b.type],
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
    ...activeChannels.map((c) => CHANNEL_PRIORITY[c.type]),
  );
  const topTier = activeChannels.filter(
    (c) => CHANNEL_PRIORITY[c.type] === bestPriority,
  );
  return topTier[Math.floor(Math.random() * topTier.length)]!.id;
};

/**
 * Create a live channel when a creator starts streaming.
 * Called from the on_publish callback after opening a session.
 */
export const createLiveChannel = async (opts: {
  creatorId: string;
  creatorName: string;
  streamSessionId: string;
  srsStreamName: string;
}): Promise<Result<{ channelId: string }, AppError>> => {
  try {
    const channelId = randomUUID();

    await db.insert(channels).values({
      id: channelId,
      name: `Live: ${opts.creatorName}`,
      type: "live",
      srsStreamName: opts.srsStreamName,
      creatorId: opts.creatorId,
      streamSessionId: opts.streamSessionId,
      isActive: true,
    });

    return ok({ channelId });
  } catch (e) {
    return err(
      new AppError(
        "CHANNEL_CREATE_ERROR",
        e instanceof Error ? e.message : "Failed to create live channel",
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

    return ok({ channelId: channel.id });
  } catch (e) {
    return err(
      new AppError(
        "CHANNEL_DEACTIVATE_ERROR",
        e instanceof Error ? e.message : "Failed to deactivate live channel",
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
      srsStreamName: opts.srsStreamName,
      isActive: true,
      defaultPlayoutChannelId: opts.defaultPlayoutChannelId ?? null,
    });

    return ok({ channelId });
  } catch (e) {
    return err(
      new AppError(
        "CHANNEL_ENSURE_ERROR",
        e instanceof Error ? e.message : "Failed to ensure broadcast channel",
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
      srsStreamName: opts.srsStreamName,
      isActive: true,
    });

    return ok({ channelId });
  } catch (e) {
    return err(
      new AppError(
        "CHANNEL_ENSURE_ERROR",
        e instanceof Error ? e.message : "Failed to ensure playout channel",
        500,
      ),
    );
  }
};
