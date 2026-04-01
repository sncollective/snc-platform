import type { Job } from "pg-boss";
import { eq } from "drizzle-orm";

import { probeMedia, remuxPlayoutSource } from "../../services/media-processing.js";
import { getFileExtension } from "../../lib/file-utils.js";
import {
  downloadToTemp,
  uploadFromTemp,
  cleanupTemp,
} from "../../services/processing-jobs.js";
import { db } from "../../db/connection.js";
import { playoutItems } from "../../db/schema/playout.schema.js";
import { JOB_QUEUES } from "../register-workers.js";
import { rootLogger } from "../../logging/logger.js";

// ── Types ──

export type PlayoutIngestJobData = {
  readonly playoutItemId: string;
};

// ── Handler ──

/**
 * Handle a playout ingest job: download source, remux, probe for metadata,
 * and mark ready. The item sits in the content pool; auto-fill picks it up
 * when the queue needs filling — no playlist to regenerate.
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
  let remuxedPath: string | null = null;

  try {
    // ── Download source ──
    const ext = getFileExtension(item.sourceKey);
    const downloadResult = await downloadToTemp(item.sourceKey, `playout-source.${ext}`);
    if (!downloadResult.ok) {
      await markFailed(playoutItemId, downloadResult.error.message);
      return;
    }
    tempPath = downloadResult.value;

    // ── Remux: strip non-AV streams ──
    // Data tracks (timecode, camera telemetry, chapter markers) cause
    // Liquidsoap's FFmpeg decoder to hang. Codec-copy remux is fast.
    remuxedPath = tempPath.replace(/(\.\w+)$/, "-remuxed$1");
    const remuxResult = await remuxPlayoutSource(tempPath, remuxedPath);
    if (!remuxResult.ok) {
      await markFailed(playoutItemId, remuxResult.error.message);
      return;
    }

    // ── Upload clean source back to S3 ──
    const uploadResult = await uploadFromTemp(remuxedPath, item.sourceKey, "video/mp4");
    if (!uploadResult.ok) {
      await markFailed(playoutItemId, uploadResult.error.message);
      return;
    }

    // ── Probe for metadata ──
    const probeResult = await probeMedia(remuxedPath);
    if (!probeResult.ok) {
      await markFailed(playoutItemId, probeResult.error.message);
      return;
    }

    const probe = probeResult.value;
    if (probe.dataStreamCount > 0) {
      logger.info({ dataStreamCount: probe.dataStreamCount }, "Stripped non-AV streams from source");
    }

    await db
      .update(playoutItems)
      .set({
        sourceWidth: probe.width,
        sourceHeight: probe.height,
        duration: probe.duration,
        updatedAt: new Date(),
      })
      .where(eq(playoutItems.id, playoutItemId));

    // ── Mark ready ──
    // Item is now in the content pool. Auto-fill picks it up when the queue needs filling.
    await db
      .update(playoutItems)
      .set({ processingStatus: "ready", updatedAt: new Date() })
      .where(eq(playoutItems.id, playoutItemId));
    logger.info("Playout item ready");
  } catch (e) {
    logger.error({ error: e instanceof Error ? e.message : String(e) }, "Playout ingest failed");
    await markFailed(playoutItemId, e instanceof Error ? e.message : "Unknown error");
  } finally {
    if (tempPath) await cleanupTemp(tempPath);
    if (remuxedPath) await cleanupTemp(remuxedPath);
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
