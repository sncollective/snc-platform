import { eq, asc, sql } from "drizzle-orm";
import { AppError, NotFoundError, ValidationError, ok, err } from "@snc/shared";
import type { Result, EditorialMode } from "@snc/shared";

import { db } from "../db/connection.js";
import { channels } from "../db/schema/streaming.schema.js";
import { channelContent } from "../db/schema/playout-queue.schema.js";
import { playoutItems } from "../db/schema/playout.schema.js";
import { content } from "../db/schema/content.schema.js";
import {
  upsertEditorialConfig,
  getEditorialTiers,
  createEditorialTier,
  updateEditorialTier,
  deleteEditorialTier,
} from "./editorial-config.js";
import type { PoolScope } from "./editorial-config.js";
import { regenerateAndRestart } from "./liquidsoap-config.js";
import type { LiquidsoapClient } from "./liquidsoap-client.js";
import { config } from "../config.js";
import { rootLogger } from "../logging/logger.js";

// ── Logger ──

const logger = rootLogger.child({ service: "editorial-control" });

// ── Internal helpers ──

/**
 * Fetch a playout channel row by ID.
 * Returns NotFoundError when the channel does not exist or is not a playout channel.
 */
const fetchPlayoutChannel = async (
  channelId: string,
): Promise<Result<{ id: string; ownership: string; creatorId: string | null }, NotFoundError>> => {
  const rows = await db
    .select({
      id: channels.id,
      ownership: channels.ownership,
      creatorId: channels.creatorId,
    })
    .from(channels)
    .where(eq(channels.id, channelId));

  const row = rows[0];
  if (!row) {
    return err(new NotFoundError(`Channel ${channelId} not found`));
  }
  return ok(row);
};

// ── Live verb service functions ──
// Each live verb persists state to DB (restart-agnostic) then live-mutates via the client.
// The render initializes refs from persisted config on every Liquidsoap startup.
// arm/take: armed state is NOT persisted — the render initializes armed=false on restart and
// the operator re-arms after a restart if needed. This is intentional: a restart is a
// structural event that clears transient operational state. Documented here as the load-bearing
// decision (rejected: persist armed state — arm/take is operator intent signaled in a live
// session, not a durable config; persisting it would auto-arm after unexpected restarts,
// which could surprise the operator).

/**
 * Set the editorial mode for a channel.
 *
 * Persists the mode to DB (restart-agnostic), then live-mutates the running
 * Liquidsoap instance via the client. In manual mode the `manualTierId` should
 * be set separately (or together via `setManualTier`).
 *
 * @param channelId - The channel to configure.
 * @param mode - The editorial mode to set.
 * @param client - Liquidsoap client for live mutation.
 */
export const setMode = async (
  channelId: string,
  mode: EditorialMode,
  client: LiquidsoapClient,
): Promise<Result<void, AppError>> => {
  const channelResult = await fetchPlayoutChannel(channelId);
  if (!channelResult.ok) return channelResult;

  const persistResult = await upsertEditorialConfig(channelId, { mode });
  if (!persistResult.ok) return persistResult;

  const liveResult = await client.setMode(channelId, mode);
  if (!liveResult.ok) {
    logger.warn(
      { channelId, mode, error: liveResult.error.message },
      "setMode persisted but live-mutate failed — state will restore on next restart",
    );
  }

  return ok(undefined);
};

/**
 * Arm or disarm the channel queue for take-over.
 *
 * This is a transient live-only operation — arm state is NOT persisted to DB.
 * The render initializes the channel armed=false on every restart; the operator
 * re-arms after a restart if needed. See the arm-persistence decision inline above.
 *
 * @param channelId - The channel to arm/disarm.
 * @param armed - Whether to arm the queue.
 * @param client - Liquidsoap client for live mutation.
 */
export const armQueue = async (
  channelId: string,
  armed: boolean,
  client: LiquidsoapClient,
): Promise<Result<void, AppError>> => {
  const channelResult = await fetchPlayoutChannel(channelId);
  if (!channelResult.ok) return channelResult;

  return client.armQueue(channelId, armed);
};

/**
 * Take the queue: arm it and flip mode to auto so the queue source participates
 * in the readiness fallback immediately.
 *
 * Convenience verb for the "build a queue while pool rotates, take when ready"
 * workshop scenario. Persists mode=auto (the switch-over intent) and live-mutates
 * both armed=true and mode=auto.
 *
 * @param channelId - The channel to take.
 * @param client - Liquidsoap client for live mutation.
 */
export const takeQueue = async (
  channelId: string,
  client: LiquidsoapClient,
): Promise<Result<void, AppError>> => {
  const channelResult = await fetchPlayoutChannel(channelId);
  if (!channelResult.ok) return channelResult;

  // Persist mode=auto (the "switch over" intent survives a restart)
  const persistResult = await upsertEditorialConfig(channelId, { mode: "auto" });
  if (!persistResult.ok) return persistResult;

  // Live-mutate: arm then set mode to auto
  const armResult = await client.armQueue(channelId, true);
  if (!armResult.ok) {
    logger.warn(
      { channelId, error: armResult.error.message },
      "takeQueue: arm live-mutate failed — persisted mode=auto",
    );
  }

  const modeResult = await client.setMode(channelId, "auto");
  if (!modeResult.ok) {
    logger.warn(
      { channelId, error: modeResult.error.message },
      "takeQueue: mode live-mutate failed — persisted mode=auto",
    );
  }

  return ok(undefined);
};

/**
 * Pin the channel to a specific editorial tier by tier ID.
 *
 * Resolves the tier's index in priority order (for the Liquidsoap live ref),
 * persists mode=manual + manualTierId, then live-mutates the running instance.
 *
 * This is the "choose the scheduled event over the live creator" workshop
 * scenario verb.
 *
 * @param channelId - The channel to pin.
 * @param tierId - The tier ID to pin to.
 * @param client - Liquidsoap client for live mutation.
 */
export const setManualTier = async (
  channelId: string,
  tierId: string,
  client: LiquidsoapClient,
): Promise<Result<void, AppError>> => {
  const channelResult = await fetchPlayoutChannel(channelId);
  if (!channelResult.ok) return channelResult;

  // Load ordered tiers to resolve the tier index
  const tiersResult = await getEditorialTiers(channelId);
  if (!tiersResult.ok) return tiersResult;

  const tiers = tiersResult.value;
  const enabledTiers = tiers.filter((t) => t.enabled);
  const tierIndex = enabledTiers.findIndex((t) => t.id === tierId);

  if (tierIndex < 0) {
    // Check if the tier exists at all (may be disabled)
    const tierExists = tiers.some((t) => t.id === tierId);
    if (!tierExists) {
      return err(new NotFoundError(`Tier ${tierId} not found for channel ${channelId}`));
    }
    return err(
      new ValidationError(
        `Tier ${tierId} is disabled — cannot pin a disabled tier in manual mode`,
      ),
    );
  }

  // Persist mode=manual + manualTierId (restart-agnostic)
  const persistResult = await upsertEditorialConfig(channelId, {
    mode: "manual",
    manualTierId: tierId,
  });
  if (!persistResult.ok) return persistResult;

  // Live-mutate mode and manual tier index
  const modeResult = await client.setMode(channelId, "manual");
  if (!modeResult.ok) {
    logger.warn(
      { channelId, error: modeResult.error.message },
      "setManualTier: mode live-mutate failed — persisted mode=manual",
    );
  }

  const tierResult = await client.setManualTier(channelId, tierIndex);
  if (!tierResult.ok) {
    logger.warn(
      { channelId, tierId, tierIndex, error: tierResult.error.message },
      "setManualTier: tier live-mutate failed — persisted tier assignment",
    );
  }

  return ok(undefined);
};

// ── Structural edit helpers ──
// Structural edits persist state then regenerate-and-restart the Liquidsoap config.
// They do NOT live-mutate because the change affects the rendered .liq topology.

/**
 * Enable or disable an editorial tier for a channel.
 *
 * Structural edit: persists the enabled flag then regenerates and restarts Liquidsoap.
 *
 * @param tierId - The tier to enable/disable.
 * @param enabled - Whether to enable the tier.
 */
export const setTierEnabled = async (
  tierId: string,
  enabled: boolean,
): Promise<Result<void, AppError>> => {
  const result = await updateEditorialTier(tierId, { enabled });
  if (!result.ok) return result;

  return regenerateAndRestart();
};

/**
 * Reorder an editorial tier to a new priority value.
 *
 * Structural edit: persists the new priority then regenerates and restarts.
 * Caller is responsible for ensuring no priority collision (use unique priorities).
 *
 * @param tierId - The tier to reorder.
 * @param priority - The new priority (0 = highest).
 */
export const setTierPriority = async (
  tierId: string,
  priority: number,
): Promise<Result<void, AppError>> => {
  const result = await updateEditorialTier(tierId, { priority });
  if (!result.ok) return result;

  return regenerateAndRestart();
};

/**
 * Add a carry edge (channel-as-source tier) to a channel.
 *
 * Structural edit: creates the tier then regenerates and restarts.
 *
 * @param channelId - The channel to add the carry to.
 * @param sourceChannelId - The channel to carry from.
 * @param priority - Priority of the new tier (0 = highest).
 */
export const addCarryEdge = async (
  channelId: string,
  sourceChannelId: string,
  priority: number,
): Promise<Result<void, AppError>> => {
  const result = await createEditorialTier(channelId, {
    tierType: "channel-as-source",
    priority,
    enabled: true,
    sourceChannelId,
  });
  if (!result.ok) return result;

  return regenerateAndRestart();
};

/**
 * Remove an editorial tier (including a carry edge) from a channel.
 *
 * Structural edit: deletes the tier then regenerates and restarts.
 *
 * @param tierId - The tier to remove.
 */
export const removeTier = async (
  tierId: string,
): Promise<Result<void, AppError>> => {
  const result = await deleteEditorialTier(tierId);
  if (!result.ok) return result;

  return regenerateAndRestart();
};

// ── Pool / next URI resolution ──

/**
 * Resolve the next URI for a channel's pool (LRP rotation).
 *
 * Queries `channel_content` for the channel's ownership-scoped pool in
 * least-recently-played order (lastPlayedAt ASC, nulls first), picks the next
 * item, resolves its S3 URI, updates lastPlayedAt + playCount, and returns the URI.
 *
 * Returns null when the pool is empty or no playable URI is found.
 *
 * This is the backing logic for the `GET /channels/:id/pool/next` callback endpoint
 * the rendered `.liq` calls via `request.dynamic`. The LRP update is the rotation
 * mechanism — updating lastPlayedAt here is the side effect that rotates the pool.
 *
 * @param channelId - The channel whose pool to query.
 * @param scope - The ownership scope resolved by `poolContentScope`.
 */
export const resolvePoolNextUri = async (
  channelId: string,
  scope: PoolScope,
): Promise<string | null> => {
  // Query channel_content for this channel in LRP order (lastPlayedAt ASC, nulls first).
  // The scope (creator vs all-creators) is enforced at content-assignment time when pool
  // entries are seeded into channel_content. At query time the scope is channelId-bounded:
  // each channel's channel_content rows already reflect its ownership scope. We fetch a
  // small batch (20) so URI resolution failures don't stall the pool — we skip unresolvable
  // entries and return the first one that yields a URI.
  //
  // Ownership scope annotation (unused at query time — enforcement is at seed time):
  void scope;

  const rows = await db
    .select({
      id: channelContent.id,
      playoutItemId: channelContent.playoutItemId,
      contentId: channelContent.contentId,
      lastPlayedAt: channelContent.lastPlayedAt,
    })
    .from(channelContent)
    .where(eq(channelContent.channelId, channelId))
    .orderBy(asc(channelContent.lastPlayedAt))
    .limit(20);

  if (rows.length === 0) return null;

  const bucket = config.S3_BUCKET ?? "snc-storage";

  for (const row of rows) {
    let uri: string | null = null;

    if (row.playoutItemId) {
      const [item] = await db
        .select()
        .from(playoutItems)
        .where(eq(playoutItems.id, row.playoutItemId));
      if (item) {
        if (item.rendition1080pKey) uri = `s3://${bucket}/${item.rendition1080pKey}`;
        else if (item.rendition720pKey) uri = `s3://${bucket}/${item.rendition720pKey}`;
        else if (item.rendition480pKey) uri = `s3://${bucket}/${item.rendition480pKey}`;
        else if (item.sourceKey) uri = `s3://${bucket}/${item.sourceKey}`;
      }
    } else if (row.contentId) {
      const [item] = await db
        .select({ mediaKey: content.mediaKey, transcodedMediaKey: content.transcodedMediaKey })
        .from(content)
        .where(eq(content.id, row.contentId));
      if (item) {
        const key = item.transcodedMediaKey ?? item.mediaKey;
        if (key) uri = `s3://${bucket}/${key}`;
      }
    }

    if (uri) {
      // Update lastPlayedAt and increment playCount — this is the LRP rotation side effect.
      // sql`${col} + 1` is the Drizzle-idiomatic increment (used in playout-orchestrator.ts:289).
      await db
        .update(channelContent)
        .set({
          lastPlayedAt: new Date(),
          playCount: sql`${channelContent.playCount} + 1`,
        })
        .where(eq(channelContent.id, row.id));

      return uri;
    }
  }

  return null;
};
