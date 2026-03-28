import type { Job } from "pg-boss";

import { probeMedia } from "../../services/media-processing.js";
import {
  downloadToTemp,
  cleanupTemp,
} from "../../services/processing-jobs.js";
import { db } from "../../db/connection.js";
import { playoutItems } from "../../db/schema/playout.schema.js";
import { eq } from "drizzle-orm";
import { regeneratePlaylist } from "../../services/playout.js";
import { JOB_QUEUES } from "../register-workers.js";
import { rootLogger } from "../../logging/logger.js";

// ── Types ──

export type PlayoutIngestJobData = {
  readonly playoutItemId: string;
};

// ── Handler ──

/**
 * Handle a playout ingest job: download source, probe for metadata,
 * mark ready, and regenerate playlist. Liquidsoap reads the source
 * file directly — no rendition transcoding needed.
 */
export const handlePlayoutIngest = async (
  [job]: [Job<PlayoutIngestJobData>],
): Promise<void> => {
  const { playoutItemId } = job.data;
  const logger = rootLogger.child({
    jobId: job.id,
    playoutItemId,
    queue: JOB_QUEUES.PLAYOUT_INGEST,
  });

  const [item] = await db
    .select()
    .from(playoutItems)
    .where(eq(playoutItems.id, playoutItemId));

  if (!item?.sourceKey) {
    logger.warn("Playout item or sourceKey not found — skipping");
    return;
  }

  await db
    .update(playoutItems)
    .set({ processingStatus: "processing", updatedAt: new Date() })
    .where(eq(playoutItems.id, playoutItemId));

  let tempPath: string | null = null;

  try {
    // ── Download source ──
    const ext = item.sourceKey.split(".").pop() ?? "bin";
    const downloadResult = await downloadToTemp(item.sourceKey, `playout-source.${ext}`);
    if (!downloadResult.ok) {
      await markFailed(playoutItemId, downloadResult.error.message);
      return;
    }
    tempPath = downloadResult.value;

    // ── Probe for metadata ──
    const probeResult = await probeMedia(tempPath);
    if (!probeResult.ok) {
      await markFailed(playoutItemId, probeResult.error.message);
      return;
    }

    const probe = probeResult.value;

    await db
      .update(playoutItems)
      .set({
        sourceWidth: probe.width,
        sourceHeight: probe.height,
        duration: probe.duration,
        updatedAt: new Date(),
      })
      .where(eq(playoutItems.id, playoutItemId));

    // ── Mark ready + regenerate playlist ──
    await db
      .update(playoutItems)
      .set({ processingStatus: "ready", updatedAt: new Date() })
      .where(eq(playoutItems.id, playoutItemId));
    await regeneratePlaylist();
    logger.info("Playout item ready");
  } catch (e) {
    logger.error({ error: e instanceof Error ? e.message : String(e) }, "Playout ingest failed");
    await markFailed(playoutItemId, e instanceof Error ? e.message : "Unknown error");
  } finally {
    if (tempPath) await cleanupTemp(tempPath);
  }
};

// ── Private Helpers ──

const markFailed = async (itemId: string, error: string): Promise<void> => {
  await db
    .update(playoutItems)
    .set({ processingStatus: "failed", updatedAt: new Date() })
    .where(eq(playoutItems.id, itemId));
  rootLogger.error({ itemId, error }, "Playout ingest failed");
};
