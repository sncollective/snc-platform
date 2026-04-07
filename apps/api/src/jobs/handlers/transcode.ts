import { join } from "node:path";
import { randomUUID } from "node:crypto";

import type { Job } from "pg-boss";

import { transcodeToH264 } from "../../services/media-processing.js";
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
import { failContentJob } from "./job-error.js";
import { config } from "../../config.js";
import { JOB_QUEUES } from "../register-workers.js";
import { rootLogger } from "../../logging/logger.js";

// ── Types ──

export type TranscodeJobData = {
  readonly contentId: string;
  readonly isHdr?: boolean;
  readonly sourceHeight?: number | null;
};

// ── Handler ──

/** Handle a transcode job: download original, transcode to H.264+AAC, upload transcoded, update content. */
export const handleTranscode = async (
  [job]: [Job<TranscodeJobData>],
): Promise<void> => {
  const { contentId } = job.data;
  const logger = rootLogger.child({ jobId: job.id, contentId, queue: JOB_QUEUES.TRANSCODE });

  const contentRow = await getContentForJob(contentId);
  if (!contentRow?.mediaKey) {
    logger.warn("Content or mediaKey not found — skipping transcode");
    return;
  }

  const jobRecord = await createJob(contentId, "transcode");
  await updateJob(jobRecord.id, { status: "processing" });

  let inputPath: string | null = null;
  let outputPath: string | null = null;

  try {
    const ext = getFileExtension(contentRow.mediaKey);
    const downloadResult = await downloadToTemp(contentRow.mediaKey, `transcode-in.${ext}`);
    if (!downloadResult.ok) {
      await updateJob(jobRecord.id, { status: "failed", error: downloadResult.error.message });
      await updateContentProcessing(contentId, { processingStatus: "failed" });
      return;
    }
    inputPath = downloadResult.value;

    outputPath = join(config.MEDIA_TEMP_DIR, `${randomUUID()}-transcode-out.mp4`);

    const transcodeResult = await transcodeToH264(inputPath, outputPath, {
      onProgress: (percent) => {
        void updateJob(jobRecord.id, { progress: percent });
      },
      ...(job.data.isHdr !== undefined ? { isHdr: job.data.isHdr } : {}),
      ...(job.data.sourceHeight != null ? { maxHeight: job.data.sourceHeight } : {}),
    });

    if (!transcodeResult.ok) {
      await updateJob(jobRecord.id, { status: "failed", error: transcodeResult.error.message });
      await updateContentProcessing(contentId, { processingStatus: "failed" });
      return;
    }

    const transcodedKey = contentRow.mediaKey.replace(/\.[^.]+$/, "-transcoded.mp4");
    const uploadResult = await uploadFromTemp(outputPath, transcodedKey, "video/mp4");
    if (!uploadResult.ok) {
      await updateJob(jobRecord.id, { status: "failed", error: uploadResult.error.message });
      await updateContentProcessing(contentId, { processingStatus: "failed" });
      return;
    }

    await updateContentProcessing(contentId, {
      transcodedMediaKey: transcodedKey,
      processingStatus: "ready",
    });

    await updateJob(jobRecord.id, { status: "completed", progress: 100, completedAt: new Date() });
    logger.info({ transcodedKey }, "Transcode complete");
  } catch (e) {
    await failContentJob(jobRecord.id, contentId, e, logger, "Transcode job");
  } finally {
    if (inputPath) await cleanupTemp(inputPath);
    if (outputPath) await cleanupTemp(outputPath);
  }
};
