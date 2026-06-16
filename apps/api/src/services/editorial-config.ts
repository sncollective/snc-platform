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
import { detectChannelSourceCycles } from "./editorial-graph.js";
import type { ChannelSourceEdge } from "./editorial-graph.js";

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
 * @param channelId - The channel to configure.
 * @param data - Mode and optional manualTierId.
 */
export const upsertEditorialConfig = async (
  channelId: string,
  data: UpsertEditorialConfig,
): Promise<Result<EditorialConfig>> => {
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
 * Delete the editorial config for a channel (and all its tiers via cascade).
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
 * Validates sourceChannelId/tierType consistency and cycle-freedom on any
 * change that adds or modifies a channel-as-source edge.
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
