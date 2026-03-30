import { eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";

import { AppError, NotFoundError } from "@snc/shared";
import type {
  SimulcastDestination,
  CreateSimulcastDestination,
  UpdateSimulcastDestination,
} from "@snc/shared";
import type { Result } from "@snc/shared";
import { ok, err } from "@snc/shared";

import { db } from "../db/connection.js";
import { simulcastDestinations } from "../db/schema/streaming.schema.js";
import { config } from "../config.js";
import { toISO } from "../lib/response-helpers.js";

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
    createdAt: toISO(row.createdAt),
    updatedAt: toISO(row.updatedAt),
  };
}

// ── CRUD ──

/** List all simulcast destinations. */
export async function listSimulcastDestinations(): Promise<
  Result<SimulcastDestination[]>
> {
  const rows = await db.select().from(simulcastDestinations);
  return ok(rows.map(toDestinationResponse));
}

/** Create a new simulcast destination. Triggers SRS reload. */
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

  await reloadSrs();
  return ok(toDestinationResponse(inserted));
}

/** Update an existing simulcast destination. Triggers SRS reload. */
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

  await reloadSrs();
  return ok(toDestinationResponse(updated));
}

/** Delete a simulcast destination. Triggers SRS reload. */
export async function deleteSimulcastDestination(
  id: string,
): Promise<Result<void>> {
  const [deleted] = await db
    .delete(simulcastDestinations)
    .where(eq(simulcastDestinations.id, id))
    .returning({ id: simulcastDestinations.id });

  if (!deleted) return err(new NotFoundError("Simulcast destination not found"));

  await reloadSrs();
  return ok(undefined);
}

// ── on_forward Query ──

/** Return composed RTMP URLs for all active simulcast destinations. */
export async function getActiveSimulcastUrls(): Promise<string[]> {
  const rows = await db
    .select({
      rtmpUrl: simulcastDestinations.rtmpUrl,
      streamKey: simulcastDestinations.streamKey,
    })
    .from(simulcastDestinations)
    .where(eq(simulcastDestinations.isActive, true));

  return rows.map((r) => `${r.rtmpUrl}/${r.streamKey}`);
}

// ── SRS Reload ──

/** Trigger SRS config reload so on_forward re-evaluates destinations. Best-effort. */
async function reloadSrs(): Promise<void> {
  const srsApiUrl = config.SRS_API_URL;
  if (!srsApiUrl) return;

  try {
    await fetch(`${srsApiUrl}/api/v1/raw?rpc=reload`, {
      method: "GET",
      signal: AbortSignal.timeout(5_000),
    });
  } catch {
    // Best-effort — log warning but don't fail the operation
    // SRS reload failure means destinations won't take effect until next stream publish
  }
}
