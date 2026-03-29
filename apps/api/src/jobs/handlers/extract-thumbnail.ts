import { join } from "node:path";
import { randomUUID } from "node:crypto";

import type { Job } from "pg-boss";

import { extractThumbnail } from "../../services/media-processing.js";
import { getFileExtension } from "../../lib/file-utils.js";
import {
  createJob,
  updateJob,
  updateContentProcessing,
  getContentForJob,
  downloadToTemp,
  uploadFromTemp,
  cleanupTemp,
} from "../../services/processing-jobs.js";
import { config } from "../../config.js";
import { JOB_QUEUES } from "../register-workers.js";
import { rootLogger } from "../../logging/logger.js";

// ── Types ──

export type ThumbnailJobData = {
  readonly contentId: string;
};

// ── Handler ──

/** Handle a thumbnail extraction job: download media, extract frame, upload thumbnail. */
export const handleExtractThumbnail = async (
  [job]: [Job<ThumbnailJobData>],
): Promise<void> => {
  const { contentId } = job.data;
  const logger = rootLogger.child({ jobId: job.id, contentId, queue: JOB_QUEUES.EXTRACT_THUMBNAIL });

  const contentRow = await getContentForJob(contentId);
  if (!contentRow?.mediaKey) {
    logger.warn("Content or mediaKey not found — skipping thumbnail");
    return;
  }

  if (contentRow.thumbnailKey) {
    logger.info("Custom thumbnail already exists — skipping");
    return;
  }

  const jobRecord = await createJob(contentId, "thumbnail");
  await updateJob(jobRecord.id, { status: "processing" });

  let inputPath: string | null = null;
  let outputPath: string | null = null;

  try {
    const ext = getFileExtension(contentRow.mediaKey);
    const downloadResult = await downloadToTemp(contentRow.mediaKey, `thumb-in.${ext}`);
    if (!downloadResult.ok) {
      await updateJob(jobRecord.id, { status: "failed", error: downloadResult.error.message });
      return;
    }
    inputPath = downloadResult.value;

    outputPath = join(config.MEDIA_TEMP_DIR, `${randomUUID()}-thumbnail.jpg`);

    const thumbResult = await extractThumbnail(inputPath, outputPath);
    if (!thumbResult.ok) {
      await updateJob(jobRecord.id, { status: "failed", error: thumbResult.error.message });
      return;
    }

    const thumbnailKey = contentRow.mediaKey.replace(/\.[^.]+$/, "-thumb.jpg");
    const uploadResult = await uploadFromTemp(outputPath, thumbnailKey, "image/jpeg");
    if (!uploadResult.ok) {
      await updateJob(jobRecord.id, { status: "failed", error: uploadResult.error.message });
      return;
    }

    await updateContentProcessing(contentId, { thumbnailKey });
    await updateJob(jobRecord.id, { status: "completed", progress: 100, completedAt: new Date() });
    logger.info({ thumbnailKey }, "Thumbnail extracted");
  } catch (e) {
    logger.error({ error: e instanceof Error ? e.message : String(e) }, "Thumbnail job failed");
    await updateJob(jobRecord.id, { status: "failed", error: e instanceof Error ? e.message : "Unknown error" });
  } finally {
    if (inputPath) await cleanupTemp(inputPath);
    if (outputPath) await cleanupTemp(outputPath);
  }
};
