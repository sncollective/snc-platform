import { and, eq, isNull, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";

import {
  AppError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
  MAX_CREATOR_SIMULCAST_DESTINATIONS,
  ok,
  err,
} from "@snc/shared";
import type {
  SimulcastDestination,
  CreateSimulcastDestination,
  UpdateSimulcastDestination,
  Result,
} from "@snc/shared";

import { db } from "../db/connection.js";
import {
  channels,
  simulcastDestinations,
} from "../db/schema/streaming.schema.js";
import { creatorMembers } from "../db/schema/creator.schema.js";
import { config } from "../config.js";
import { toISO } from "../lib/response-helpers.js";
import { rootLogger } from "../logging/logger.js";

const logger = rootLogger.child({ service: "simulcast" });

// ── Response Transformer ──

function toDestinationResponse(
  row: typeof simulcastDestinations.$inferSelect,
): SimulcastDestination {
  return {
    id: row.id,
    platform: row.platform as SimulcastDestination["platform"],
    label: row.label,
    rtmpUrl: row.rtmpUrl,
    streamKeyPrefix: row.streamKey.slice(0, 8),
    isActive: row.isActive,
    creatorId: row.creatorId ?? null,
    createdAt: toISO(row.createdAt),
    updatedAt: toISO(row.updatedAt),
  };
}

// ── Private Helpers ──

/** Check that userId is an owner of the creator. Matches stream-keys.ts pattern. */
async function requireOwner(
  userId: string,
  creatorId: string,
): Promise<Result<void>> {
  const rows = await db
    .select({ role: creatorMembers.role })
    .from(creatorMembers)
    .where(
      and(
        eq(creatorMembers.userId, userId),
        eq(creatorMembers.creatorId, creatorId),
      ),
    );

  if (rows.length === 0 || rows[0]!.role !== "owner") {
    return err(
      new ForbiddenError("Only creator owners can manage simulcast destinations"),
    );
  }
  return ok(undefined);
}

// ── Admin CRUD ──

/** List platform-level simulcast destinations (admin). */
export async function listSimulcastDestinations(): Promise<
  Result<SimulcastDestination[]>
> {
  const rows = await db
    .select()
    .from(simulcastDestinations)
    .where(isNull(simulcastDestinations.creatorId));
  return ok(rows.map(toDestinationResponse));
}

/** Create a platform simulcast destination. Restarts playout forward. */
export async function createSimulcastDestination(
  input: CreateSimulcastDestination,
): Promise<Result<SimulcastDestination>> {
  const id = randomUUID();
  const [inserted] = await db
    .insert(simulcastDestinations)
    .values({
      id,
      platform: input.platform,
      label: input.label,
      rtmpUrl: input.rtmpUrl,
      streamKey: input.streamKey,
    })
    .returning();

  if (!inserted) return err(new AppError("INSERT_FAILED", "Failed to create destination", 500));

  await restartPlayoutForward();
  return ok(toDestinationResponse(inserted));
}

/** Update a platform simulcast destination. Restarts playout forward. */
export async function updateSimulcastDestination(
  id: string,
  input: UpdateSimulcastDestination,
): Promise<Result<SimulcastDestination>> {
  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (input.platform !== undefined) updates.platform = input.platform;
  if (input.label !== undefined) updates.label = input.label;
  if (input.rtmpUrl !== undefined) updates.rtmpUrl = input.rtmpUrl;
  if (input.streamKey !== undefined) updates.streamKey = input.streamKey;
  if (input.isActive !== undefined) updates.isActive = input.isActive;

  const [updated] = await db
    .update(simulcastDestinations)
    .set(updates)
    .where(eq(simulcastDestinations.id, id))
    .returning();

  if (!updated) return err(new NotFoundError("Simulcast destination not found"));

  await restartPlayoutForward();
  return ok(toDestinationResponse(updated));
}

/** Delete a platform simulcast destination. Restarts playout forward. */
export async function deleteSimulcastDestination(
  id: string,
): Promise<Result<void>> {
  const [deleted] = await db
    .delete(simulcastDestinations)
    .where(eq(simulcastDestinations.id, id))
    .returning({ id: simulcastDestinations.id });

  if (!deleted) return err(new NotFoundError("Simulcast destination not found"));

  await restartPlayoutForward();
  return ok(undefined);
}

// ── Creator-Scoped CRUD ──

/** List simulcast destinations for a creator (owner only). */
export async function listCreatorSimulcastDestinations(
  userId: string,
  creatorId: string,
): Promise<Result<SimulcastDestination[]>> {
  const ownerCheck = await requireOwner(userId, creatorId);
  if (!ownerCheck.ok) return ownerCheck;

  const rows = await db
    .select()
    .from(simulcastDestinations)
    .where(eq(simulcastDestinations.creatorId, creatorId));
  return ok(rows.map(toDestinationResponse));
}

/** Create a simulcast destination for a creator (owner only, max 5). */
export async function createCreatorSimulcastDestination(
  userId: string,
  creatorId: string,
  input: CreateSimulcastDestination,
): Promise<Result<SimulcastDestination>> {
  const ownerCheck = await requireOwner(userId, creatorId);
  if (!ownerCheck.ok) return ownerCheck;

  // Enforce per-creator cap
  const countRows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(simulcastDestinations)
    .where(eq(simulcastDestinations.creatorId, creatorId));
  const count = countRows[0]?.count ?? 0;

  if (count >= MAX_CREATOR_SIMULCAST_DESTINATIONS) {
    return err(
      new ValidationError(
        `Maximum of ${MAX_CREATOR_SIMULCAST_DESTINATIONS} simulcast destinations per creator`,
      ),
    );
  }

  const id = randomUUID();
  const [inserted] = await db
    .insert(simulcastDestinations)
    .values({
      id,
      platform: input.platform,
      label: input.label,
      rtmpUrl: input.rtmpUrl,
      streamKey: input.streamKey,
      creatorId,
    })
    .returning();

  if (!inserted)
    return err(new AppError("INSERT_FAILED", "Failed to create destination", 500));

  // Creator forward changes apply on next stream — no SRS restart needed.
  // SRS on_forward fires per-publish, and kicking a creator's OBS would be disruptive.
  return ok(toDestinationResponse(inserted));
}

/** Update a creator's simulcast destination (owner only). */
export async function updateCreatorSimulcastDestination(
  userId: string,
  creatorId: string,
  destId: string,
  input: UpdateSimulcastDestination,
): Promise<Result<SimulcastDestination>> {
  const ownerCheck = await requireOwner(userId, creatorId);
  if (!ownerCheck.ok) return ownerCheck;

  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (input.platform !== undefined) updates.platform = input.platform;
  if (input.label !== undefined) updates.label = input.label;
  if (input.rtmpUrl !== undefined) updates.rtmpUrl = input.rtmpUrl;
  if (input.streamKey !== undefined) updates.streamKey = input.streamKey;
  if (input.isActive !== undefined) updates.isActive = input.isActive;

  const [updated] = await db
    .update(simulcastDestinations)
    .set(updates)
    .where(
      and(
        eq(simulcastDestinations.id, destId),
        eq(simulcastDestinations.creatorId, creatorId),
      ),
    )
    .returning();

  if (!updated) return err(new NotFoundError("Simulcast destination not found"));

  return ok(toDestinationResponse(updated));
}

/** Delete a creator's simulcast destination (owner only). */
export async function deleteCreatorSimulcastDestination(
  userId: string,
  creatorId: string,
  destId: string,
): Promise<Result<void>> {
  const ownerCheck = await requireOwner(userId, creatorId);
  if (!ownerCheck.ok) return ownerCheck;

  const [deleted] = await db
    .delete(simulcastDestinations)
    .where(
      and(
        eq(simulcastDestinations.id, destId),
        eq(simulcastDestinations.creatorId, creatorId),
      ),
    )
    .returning({ id: simulcastDestinations.id });

  if (!deleted) return err(new NotFoundError("Simulcast destination not found"));

  return ok(undefined);
}

// ── on_forward Query ──

/**
 * Return composed RTMP URLs for active simulcast destinations.
 * No creatorId = platform destinations (playout on_forward).
 * With creatorId = creator destinations (creator on_forward).
 */
export async function getActiveSimulcastUrls(
  creatorId?: string,
): Promise<string[]> {
  const conditions = [eq(simulcastDestinations.isActive, true)];

  if (creatorId !== undefined) {
    conditions.push(eq(simulcastDestinations.creatorId, creatorId));
  } else {
    conditions.push(isNull(simulcastDestinations.creatorId));
  }

  const rows = await db
    .select({
      rtmpUrl: simulcastDestinations.rtmpUrl,
      streamKey: simulcastDestinations.streamKey,
    })
    .from(simulcastDestinations)
    .where(and(...conditions));

  return rows.map((r) => `${r.rtmpUrl}/${r.streamKey}`);
}

// ── SRS Forward Restart ──

/**
 * Restart SRS forward for playout streams by kicking their publishers.
 *
 * SRS on_forward fires once per publish and is not re-triggered by config reload.
 * Kicking the publisher causes Liquidsoap to auto-reconnect (~1-2s), which
 * fires a fresh on_forward that picks up the latest simulcast destinations.
 */
async function restartPlayoutForward(): Promise<void> {
  const srsApiUrl = config.SRS_API_URL;
  if (!srsApiUrl) return;

  try {
    // Get playout stream names from the channels table (data-driven, matches isPlayoutStream)
    const playoutChannels = await db
      .select({ srsStreamName: channels.srsStreamName })
      .from(channels)
      .where(eq(channels.isActive, true));

    const playoutStreams = new Set(
      playoutChannels.map((c) => c.srsStreamName),
    );

    if (playoutStreams.size === 0) return;

    const res = await fetch(`${srsApiUrl}/api/v1/streams?count=100`, {
      signal: AbortSignal.timeout(5_000),
    });
    if (!res.ok) return;

    const data = (await res.json()) as {
      streams?: Array<{
        name: string;
        publish?: { active?: boolean; cid?: string };
      }>;
    };

    for (const stream of data.streams ?? []) {
      if (
        playoutStreams.has(stream.name) &&
        stream.publish?.active &&
        stream.publish.cid
      ) {
        logger.info({ stream: stream.name }, "Kicking playout publisher to restart forward");
        await fetch(`${srsApiUrl}/api/v1/clients/${stream.publish.cid}`, {
          method: "DELETE",
          signal: AbortSignal.timeout(5_000),
        });
      }
    }
  } catch (e) {
    logger.warn(
      { error: e instanceof Error ? e.message : String(e) },
      "Failed to restart playout forward — destinations won't update until next publish",
    );
  }
}
