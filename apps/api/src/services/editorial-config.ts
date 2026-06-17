import { randomUUID } from "node:crypto";

import { eq, asc } from "drizzle-orm";
import {
  ok,
  err,
  NotFoundError,
  ValidationError,
  ConflictError,
} from "@snc/shared";
import type {
  Result,
  EditorialConfig,
  EditorialTier,
  EditorialConfigWithTiers,
  UpsertEditorialConfig,
  CreateEditorialTier,
  UpdateEditorialTier,
} from "@snc/shared";

import { db } from "../db/connection.js";
import {
  channelEditorialConfig,
  channelEditorialTiers,
} from "../db/schema/editorial.schema.js";
import { channels } from "../db/schema/streaming.schema.js";
import { detectChannelSourceCycles } from "./editorial-graph.js";
import type { ChannelSourceEdge } from "./editorial-graph.js";

// ── Pool scope ──

/**
 * Descriptor for the ownership-scoped pool of content a channel draws from.
 *
 * - `{ creatorId }` — the channel belongs to a specific creator; pool is
 *   restricted to that creator's content.
 * - `{ allCreators: true }` — the channel is platform-owned; pool spans all
 *   creators' content.
 *
 * The actual content query is the render/topology's job. This descriptor is
 * pure derivation from a channel row and carries no DB access of its own.
 */
export type PoolScope =
  | { readonly creatorId: string }
  | { readonly allCreators: true };

/**
 * Resolve the pool content scope for a channel by ownership.
 *
 * Creator-owned channels scope their pool to that creator's content.
 * Platform-owned (admin) channels draw from all creators' content.
 *
 * @param channel - A partial channel row carrying `ownership` and `creatorId`.
 */
export const poolContentScope = (channel: {
  ownership: string;
  creatorId: string | null;
}): PoolScope => {
  if (channel.ownership === "creator" && channel.creatorId != null) {
    return { creatorId: channel.creatorId };
  }
  return { allCreators: true };
};

// ── Row → Response transformers ──

const toConfig = (
  row: typeof channelEditorialConfig.$inferSelect,
): EditorialConfig => ({
  channelId: row.channelId,
  mode: row.mode,
  manualTierId: row.manualTierId,
  updatedAt: row.updatedAt.toISOString(),
});

const toTier = (
  row: typeof channelEditorialTiers.$inferSelect,
): EditorialTier => ({
  id: row.id,
  channelId: row.channelId,
  tierType: row.tierType,
  priority: row.priority,
  enabled: row.enabled,
  sourceChannelId: row.sourceChannelId ?? null,
});

// ── Internal helpers ──

/**
 * Validate that sourceChannelId is set if and only if tierType is
 * "channel-as-source". Returns err(ValidationError) on violation.
 */
const validateSourceConstraint = (
  tierType: string,
  sourceChannelId: string | null | undefined,
): Result<void, ValidationError> => {
  const isCarry = tierType === "channel-as-source";
  const hasSource = sourceChannelId != null && sourceChannelId !== "";

  if (isCarry && !hasSource) {
    return err(
      new ValidationError(
        "sourceChannelId must be set when tierType is 'channel-as-source'",
      ),
    );
  }
  if (!isCarry && hasSource) {
    return err(
      new ValidationError(
        "sourceChannelId must be null when tierType is not 'channel-as-source'",
      ),
    );
  }
  return ok(undefined);
};

/**
 * Validate ownership constraints for a tier write.
 *
 * Per-channel constraints (design decision, 2026-06-17):
 * - Creator-owned channels: may only have `live` (own key) + `queue` tiers.
 *   `channel-as-source` is rejected (no carry for creator channels).
 * - Platform/admin channels: `live` and `channel-as-source` are mutually
 *   exclusive (a config-time choice; switch key↔carry requires disable+add, not
 *   simultaneous ownership). `queue` is permitted alongside either.
 *
 * @param ownership - The channel's ownership value ("creator" | "platform").
 * @param tierType - The tier type being written.
 * @param existingTiers - Current tiers for the channel (to detect live/carry coexistence).
 * @param excludeTierId - Tier being updated (exclude from coexistence check).
 */
const validateOwnershipConstraint = (
  ownership: string,
  tierType: string,
  existingTiers: Array<{ tierType: string; id: string }>,
  excludeTierId?: string,
): Result<void, ValidationError> => {
  if (ownership === "creator") {
    if (tierType === "channel-as-source") {
      return err(
        new ValidationError(
          "Creator-owned channels may not have a 'channel-as-source' tier",
        ),
      );
    }
    return ok(undefined);
  }

  // Platform/admin channel: live XOR channel-as-source (queue is always OK)
  const otherTiers = existingTiers.filter((t) => t.id !== excludeTierId);
  if (tierType === "live") {
    const hasCarry = otherTiers.some((t) => t.tierType === "channel-as-source");
    if (hasCarry) {
      return err(
        new ValidationError(
          "Admin channels may not have both 'live' and 'channel-as-source' tiers — they are mutually exclusive",
        ),
      );
    }
  }
  if (tierType === "channel-as-source") {
    const hasLive = otherTiers.some((t) => t.tierType === "live");
    if (hasLive) {
      return err(
        new ValidationError(
          "Admin channels may not have both 'live' and 'channel-as-source' tiers — they are mutually exclusive",
        ),
      );
    }
  }
  return ok(undefined);
};

/**
 * Fetch all channel-as-source edges from the tiers table to build the current
 * carry graph for cycle detection.
 */
const fetchAllCarryEdges = async (): Promise<ChannelSourceEdge[]> => {
  const rows = await db
    .select({
      channelId: channelEditorialTiers.channelId,
      sourceChannelId: channelEditorialTiers.sourceChannelId,
    })
    .from(channelEditorialTiers)
    .where(eq(channelEditorialTiers.tierType, "channel-as-source"));

  return rows
    .filter((r): r is { channelId: string; sourceChannelId: string } =>
      r.sourceChannelId !== null,
    )
    .map((r) => ({ channelId: r.channelId, sourceChannelId: r.sourceChannelId }));
};

/**
 * Fetch a channel row (ownership + creatorId). Returns NotFoundError if
 * the channel does not exist.
 */
const fetchChannel = async (
  channelId: string,
): Promise<Result<{ ownership: string; creatorId: string | null }, NotFoundError>> => {
  const rows = await db
    .select({ ownership: channels.ownership, creatorId: channels.creatorId })
    .from(channels)
    .where(eq(channels.id, channelId));

  const row = rows[0];
  if (!row) {
    return err(new NotFoundError(`Channel ${channelId} not found`));
  }
  return ok(row);
};

// ── Config CRUD ──

/**
 * Retrieve the editorial config for a single channel.
 * Returns NotFoundError if no config exists for the channel.
 */
export const getEditorialConfig = async (
  channelId: string,
): Promise<Result<EditorialConfig, NotFoundError>> => {
  const rows = await db
    .select()
    .from(channelEditorialConfig)
    .where(eq(channelEditorialConfig.channelId, channelId));

  const row = rows[0];
  if (!row) {
    return err(new NotFoundError(`No editorial config for channel ${channelId}`));
  }
  return ok(toConfig(row));
};

/**
 * Retrieve all channel editorial configs with their ordered tiers.
 *
 * Shaped for the topology builder: each entry carries the config plus
 * tiers sorted ascending by priority (0 = highest).
 */
export const getAllEditorialConfigs = async (): Promise<
  Result<EditorialConfigWithTiers[]>
> => {
  const [configs, tiers] = await Promise.all([
    db.select().from(channelEditorialConfig),
    db
      .select()
      .from(channelEditorialTiers)
      .orderBy(asc(channelEditorialTiers.priority)),
  ]);

  const tiersByChannel = new Map<string, EditorialTier[]>();
  for (const tier of tiers) {
    const existing = tiersByChannel.get(tier.channelId) ?? [];
    existing.push(toTier(tier));
    tiersByChannel.set(tier.channelId, existing);
  }

  const result: EditorialConfigWithTiers[] = configs.map((cfg) => ({
    ...toConfig(cfg),
    tiers: tiersByChannel.get(cfg.channelId) ?? [],
  }));

  return ok(result);
};

/**
 * Create or update the editorial config for a channel.
 *
 * If no config row exists, one is created with the provided values.
 * If a config row already exists, it is updated in place.
 *
 * Validates that `manualTierId`, when provided, belongs to the same channel —
 * the FK on `manualTierId` guarantees it points at *some* tier, but not
 * necessarily one of this channel's tiers. A cross-channel pin would silently
 * mis-resolve in the render/control plane.
 *
 * @param channelId - The channel to configure.
 * @param data - Mode and optional manualTierId.
 */
export const upsertEditorialConfig = async (
  channelId: string,
  data: UpsertEditorialConfig,
): Promise<Result<EditorialConfig>> => {
  // Validate manualTierId belongs to the same channel
  if (data.manualTierId != null) {
    const tierRows = await db
      .select({ channelId: channelEditorialTiers.channelId })
      .from(channelEditorialTiers)
      .where(eq(channelEditorialTiers.id, data.manualTierId));

    const tierRow = tierRows[0];
    if (!tierRow) {
      return err(
        new ValidationError(
          `manualTierId '${data.manualTierId}' does not reference an existing tier`,
        ),
      );
    }
    if (tierRow.channelId !== channelId) {
      return err(
        new ValidationError(
          `manualTierId '${data.manualTierId}' belongs to channel '${tierRow.channelId}', not '${channelId}'`,
        ),
      );
    }
  }

  const now = new Date();
  const rows = await db
    .insert(channelEditorialConfig)
    .values({
      channelId,
      mode: data.mode,
      manualTierId: data.manualTierId ?? null,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: channelEditorialConfig.channelId,
      set: {
        mode: data.mode,
        manualTierId: data.manualTierId ?? null,
        updatedAt: now,
      },
    })
    .returning();

  const row = rows[0];
  if (!row) {
    return err(
      new ValidationError("Upsert returned no row — channel may not exist"),
    );
  }
  return ok(toConfig(row));
};

/**
 * Delete the editorial config for a channel.
 *
 * Semantics: deleting the config row does NOT cascade to tiers. The
 * `channel_editorial_tiers.channelId` FK references `channels.id` (not
 * the config row), so tiers are only removed when the channel itself is
 * deleted. Deleting the config alone leaves tiers in place — they become
 * orphaned from `getAllEditorialConfigs` (which maps over configs) but are
 * recoverable by re-creating a config for the channel.
 *
 * If full cleanup is required, call `deleteChannel` (which cascades both
 * the config and all tiers) rather than this function.
 *
 * Returns NotFoundError if no config exists.
 */
export const deleteEditorialConfig = async (
  channelId: string,
): Promise<Result<void>> => {
  const rows = await db
    .delete(channelEditorialConfig)
    .where(eq(channelEditorialConfig.channelId, channelId))
    .returning({ channelId: channelEditorialConfig.channelId });

  if (rows.length === 0) {
    return err(new NotFoundError(`No editorial config for channel ${channelId}`));
  }
  return ok(undefined);
};

// ── Tier CRUD ──

/**
 * Create an editorial tier for a channel.
 *
 * Validates:
 * - sourceChannelId is non-null iff tierType is "channel-as-source".
 * - Ownership constraint: creator channels may not have 'channel-as-source';
 *   admin channels may not simultaneously have 'live' and 'channel-as-source'.
 * - Adding this tier does not create a cycle in the channel-as-source graph.
 *
 * Returns ConflictError if the (channelId, priority) pair is already in use.
 */
export const createEditorialTier = async (
  channelId: string,
  data: CreateEditorialTier,
): Promise<Result<EditorialTier>> => {
  const constraint = validateSourceConstraint(
    data.tierType,
    data.sourceChannelId,
  );
  if (!constraint.ok) return constraint;

  // Ownership validation
  const channelResult = await fetchChannel(channelId);
  if (!channelResult.ok) return channelResult;
  const channel = channelResult.value;

  const existingTiersRows = await db
    .select({ id: channelEditorialTiers.id, tierType: channelEditorialTiers.tierType })
    .from(channelEditorialTiers)
    .where(eq(channelEditorialTiers.channelId, channelId));

  const ownershipCheck = validateOwnershipConstraint(
    channel.ownership,
    data.tierType,
    existingTiersRows,
  );
  if (!ownershipCheck.ok) return ownershipCheck;

  // Cycle detection: if this is a channel-as-source edge, check for cycles
  if (data.tierType === "channel-as-source" && data.sourceChannelId) {
    const existingEdges = await fetchAllCarryEdges();
    const proposedEdges: ChannelSourceEdge[] = [
      ...existingEdges,
      { channelId, sourceChannelId: data.sourceChannelId },
    ];
    const cycleCheck = detectChannelSourceCycles(proposedEdges);
    if (!cycleCheck.ok) return cycleCheck;
  }

  try {
    const rows = await db
      .insert(channelEditorialTiers)
      .values({
        id: randomUUID(),
        channelId,
        tierType: data.tierType,
        priority: data.priority,
        enabled: data.enabled ?? true,
        sourceChannelId: data.sourceChannelId ?? null,
      })
      .returning();

    const row = rows[0];
    if (!row) {
      return err(new ValidationError("Insert returned no row"));
    }
    return ok(toTier(row));
  } catch (e: unknown) {
    // unique constraint on (channelId, priority)
    if (
      e instanceof Error &&
      e.message.includes("channel_editorial_tiers_channel_priority_idx")
    ) {
      return err(
        new ConflictError(
          `Priority ${data.priority} is already in use for channel ${channelId}`,
        ),
      );
    }
    throw e;
  }
};

/**
 * Update an existing editorial tier.
 *
 * Validates sourceChannelId/tierType consistency, ownership constraints, and
 * cycle-freedom on any change that adds or modifies a channel-as-source edge.
 */
export const updateEditorialTier = async (
  tierId: string,
  data: UpdateEditorialTier,
): Promise<Result<EditorialTier>> => {
  // Fetch current state to merge with updates
  const currentRows = await db
    .select()
    .from(channelEditorialTiers)
    .where(eq(channelEditorialTiers.id, tierId));

  const current = currentRows[0];
  if (!current) {
    return err(new NotFoundError(`Editorial tier ${tierId} not found`));
  }

  const newTierType = data.tierType ?? current.tierType;
  const newSourceChannelId =
    data.sourceChannelId !== undefined
      ? data.sourceChannelId
      : current.sourceChannelId;

  const constraint = validateSourceConstraint(newTierType, newSourceChannelId);
  if (!constraint.ok) return constraint;

  // Ownership validation (only when tierType changes)
  if (data.tierType !== undefined && data.tierType !== current.tierType) {
    const channelResult = await fetchChannel(current.channelId);
    if (!channelResult.ok) return channelResult;
    const channel = channelResult.value;

    const existingTiersRows = await db
      .select({ id: channelEditorialTiers.id, tierType: channelEditorialTiers.tierType })
      .from(channelEditorialTiers)
      .where(eq(channelEditorialTiers.channelId, current.channelId));

    const ownershipCheck = validateOwnershipConstraint(
      channel.ownership,
      newTierType,
      existingTiersRows,
      tierId,
    );
    if (!ownershipCheck.ok) return ownershipCheck;
  }

  // Cycle detection when channel-as-source edge is added or changed
  const isCarryEdge = newTierType === "channel-as-source";
  const edgeChanged =
    isCarryEdge &&
    (data.tierType !== undefined || data.sourceChannelId !== undefined);

  if (isCarryEdge && edgeChanged && newSourceChannelId) {
    const existingEdges = await fetchAllCarryEdges();
    // Replace the existing edge from this tier (if any) with the new one
    const filteredEdges = existingEdges.filter(
      (e) => !(e.channelId === current.channelId && e.sourceChannelId === current.sourceChannelId),
    );
    const proposedEdges: ChannelSourceEdge[] = [
      ...filteredEdges,
      { channelId: current.channelId, sourceChannelId: newSourceChannelId },
    ];
    const cycleCheck = detectChannelSourceCycles(proposedEdges);
    if (!cycleCheck.ok) return cycleCheck;
  }

  const rows = await db
    .update(channelEditorialTiers)
    .set({
      ...(data.tierType !== undefined ? { tierType: data.tierType } : {}),
      ...(data.priority !== undefined ? { priority: data.priority } : {}),
      ...(data.enabled !== undefined ? { enabled: data.enabled } : {}),
      ...(data.sourceChannelId !== undefined
        ? { sourceChannelId: data.sourceChannelId }
        : {}),
    })
    .where(eq(channelEditorialTiers.id, tierId))
    .returning();

  const row = rows[0];
  if (!row) {
    return err(new NotFoundError(`Editorial tier ${tierId} not found`));
  }
  return ok(toTier(row));
};

/**
 * Delete an editorial tier by ID.
 *
 * Returns NotFoundError if the tier does not exist.
 * The manualTierId FK on channel_editorial_config uses onDelete: "set null",
 * so deleting a pinned tier automatically unpins it.
 */
export const deleteEditorialTier = async (
  tierId: string,
): Promise<Result<void>> => {
  const rows = await db
    .delete(channelEditorialTiers)
    .where(eq(channelEditorialTiers.id, tierId))
    .returning({ id: channelEditorialTiers.id });

  if (rows.length === 0) {
    return err(new NotFoundError(`Editorial tier ${tierId} not found`));
  }
  return ok(undefined);
};

/**
 * Return all tiers for a channel, sorted ascending by priority (0 = highest).
 */
export const getEditorialTiers = async (
  channelId: string,
): Promise<Result<EditorialTier[]>> => {
  const rows = await db
    .select()
    .from(channelEditorialTiers)
    .where(eq(channelEditorialTiers.channelId, channelId))
    .orderBy(asc(channelEditorialTiers.priority));

  return ok(rows.map(toTier));
};
