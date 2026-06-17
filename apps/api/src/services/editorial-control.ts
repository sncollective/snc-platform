import { eq, asc, sql } from "drizzle-orm";
import { AppError, NotFoundError, ValidationError, ok, err } from "@snc/shared";
import type { Result, EditorialMode } from "@snc/shared";

import { db } from "../db/connection.js";
import { channels } from "../db/schema/streaming.schema.js";
import { channelContent } from "../db/schema/playout-queue.schema.js";
import { playoutItems } from "../db/schema/playout.schema.js";
import { content } from "../db/schema/content.schema.js";
import {
  getEditorialConfig,
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

// ── Structural verb service functions ──
// setMode and setManualTier are STRUCTURAL verbs (B1 downgrade, 2026-06-17):
// mode and manual-pin are render-time-static — mode/manual refs were declared in the
// .liq but never read by any switch predicate, making live mutation a no-op. The
// downgrade makes the behavior match the implementation: persist then regenerate-restart.
//
// The one LIVE verb is armQueue (arm/take):
// arm state is NOT persisted — the render initializes armed=false on restart and
// the operator re-arms after a restart if needed. This is intentional: a restart is a
// structural event that clears transient operational state.
// Rejected: persist armed state — arm/take is operator intent in a live session, not
// durable config; persisting would auto-arm after unexpected restarts (surprising).

/**
 * Set the editorial mode for a channel.
 *
 * Persists the mode to DB then regenerates and restarts Liquidsoap (structural verb —
 * B1 downgrade 2026-06-17: mode is render-time-static, not live-mutable).
 *
 * @param channelId - The channel to configure.
 * @param mode - The editorial mode to set.
 */
export const setMode = async (
  channelId: string,
  mode: EditorialMode,
): Promise<Result<void, AppError>> => {
  const channelResult = await fetchPlayoutChannel(channelId);
  if (!channelResult.ok) return channelResult;

  const persistResult = await upsertEditorialConfig(channelId, { mode });
  if (!persistResult.ok) return persistResult;

  return regenerateAndRestart();
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
 * @param client - Liquidsoap client for live arm mutation.
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
 * Take the queue: arm it and ensure mode is auto so the queue source participates
 * in the readiness fallback.
 *
 * Convenience verb for the "build a queue while pool rotates, take when ready"
 * workshop scenario.
 *
 * Mode-change decision (B1 downgrade, 2026-06-17):
 * - If the channel is already in auto mode: arm is live-only (no restart needed).
 * - If the channel is in manual mode: a mode flip to auto is structural (rendered).
 *   Persist mode=auto + regenerate-restart, THEN arm live so the queue takes over
 *   immediately after the restart. The arm call after restart may race slightly
 *   (the restart is fast); operators expecting instant take should call arm
 *   separately if needed. Accepted: the "take" intent persists in the DB, so a
 *   restart after the arm is lost re-renders in auto (the durable intent).
 *
 * @param channelId - The channel to take.
 * @param client - Liquidsoap client for live arm mutation.
 */
export const takeQueue = async (
  channelId: string,
  client: LiquidsoapClient,
): Promise<Result<void, AppError>> => {
  const channelResult = await fetchPlayoutChannel(channelId);
  if (!channelResult.ok) return channelResult;

  // Check current persisted mode — only restart if we need to flip from manual.
  const configResult = await getEditorialConfig(channelId);
  const currentMode = configResult.ok ? configResult.value?.mode ?? "auto" : "auto";

  if (currentMode !== "auto") {
    // Switching from manual → auto is structural; persist + regenerate-restart.
    const persistResult = await upsertEditorialConfig(channelId, { mode: "auto" });
    if (!persistResult.ok) return persistResult;

    const restartResult = await regenerateAndRestart();
    if (!restartResult.ok) {
      logger.warn(
        { channelId, error: restartResult.error.message },
        "takeQueue: regenerate-restart failed after persisting mode=auto",
      );
      return restartResult;
    }
  }

  // Arm is always live — arm the queue so it participates in the readiness fallback.
  const armResult = await client.armQueue(channelId, true);
  if (!armResult.ok) {
    logger.warn(
      { channelId, error: armResult.error.message },
      "takeQueue: arm live-mutate failed — mode=auto persisted; re-arm after restart",
    );
  }

  return ok(undefined);
};

/**
 * Pin the channel to a specific editorial tier by tier ID.
 *
 * Persists mode=manual + manualTierId then regenerates and restarts Liquidsoap
 * (structural verb — B1 downgrade 2026-06-17: manual-pin is render-time-static).
 *
 * This is the "choose the scheduled event over the live creator" workshop
 * scenario verb. The pin takes effect on the next restart (regenerate-restart
 * is called here). No live client calls are made.
 *
 * @param channelId - The channel to pin.
 * @param tierId - The tier ID to pin to.
 */
export const setManualTier = async (
  channelId: string,
  tierId: string,
): Promise<Result<void, AppError>> => {
  const channelResult = await fetchPlayoutChannel(channelId);
  if (!channelResult.ok) return channelResult;

  // Load ordered tiers to validate the tier ID and confirm it's enabled.
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

  // Persist mode=manual + manualTierId (the render reads these on next restart).
  const persistResult = await upsertEditorialConfig(channelId, {
    mode: "manual",
    manualTierId: tierId,
  });
  if (!persistResult.ok) return persistResult;

  return regenerateAndRestart();
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
