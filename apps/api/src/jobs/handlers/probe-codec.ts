import { PgBoss } from "pg-boss";
import type { Job } from "pg-boss";

import { requiresTranscode } from "@snc/shared";

import { probeMedia } from "../../services/media-processing.js";
import { getFileExtension } from "../../lib/file-utils.js";
import {
  createJob,
  updateJob,
  updateContentProcessing,
  getContentForJob,
  downloadToTemp,
  cleanupTemp,
} from "../../services/processing-jobs.js";
import { failContentJob } from "./job-error.js";
import { JOB_QUEUES } from "../register-workers.js";
import { rootLogger } from "../../logging/logger.js";

// ── Types ──

export type ProbeJobData = {
  readonly contentId: string;
};

// ── Handler ──

/** Handle a probe-codec job: download media, run ffprobe, store metadata, chain next jobs. */
export const handleProbeCodec = async (
  [job]: [Job<ProbeJobData>],
  boss: PgBoss,
): Promise<void> => {
  const { contentId } = job.data;
  const logger = rootLogger.child({ jobId: job.id, contentId, queue: JOB_QUEUES.PROBE_CODEC });

  const contentRow = await getContentForJob(contentId);
  if (!contentRow?.mediaKey) {
    logger.warn("Content or mediaKey not found — skipping probe");
    return;
  }

  const jobRecord = await createJob(contentId, "probe");
  await updateJob(jobRecord.id, { status: "processing" });

  let tempPath: string | null = null;

  try {
    const ext = getFileExtension(contentRow.mediaKey);
    const downloadResult = await downloadToTemp(contentRow.mediaKey, `probe.${ext}`);
    if (!downloadResult.ok) {
      await updateJob(jobRecord.id, { status: "failed", error: downloadResult.error.message });
      await updateContentProcessing(contentId, { processingStatus: "failed" });
      return;
    }
    tempPath = downloadResult.value;

    const probeResult = await probeMedia(tempPath);
    if (!probeResult.ok) {
      await updateJob(jobRecord.id, { status: "failed", error: probeResult.error.message });
      await updateContentProcessing(contentId, { processingStatus: "failed" });
      return;
    }

    const probe = probeResult.value;

    await updateContentProcessing(contentId, {
      videoCodec: probe.videoCodec,
      audioCodec: probe.audioCodec,
      width: probe.width,
      height: probe.height,
      duration: probe.duration,
      bitrate: probe.bitrate,
    });

    await updateJob(jobRecord.id, { status: "completed", progress: 100, completedAt: new Date() });

    if (requiresTranscode(probe.videoCodec)) {
      logger.info({ videoCodec: probe.videoCodec }, "Codec requires transcoding — queuing transcode job");
      await boss.send(JOB_QUEUES.TRANSCODE, { contentId });
    } else {
      await updateContentProcessing(contentId, { processingStatus: "ready" });
      logger.info("Codec compatible — marking ready");
    }

    if (!contentRow.thumbnailKey && (probe.videoCodec || contentRow.type === "video")) {
      await boss.send(JOB_QUEUES.EXTRACT_THUMBNAIL, { contentId });
    }
  } catch (e) {
    await failContentJob(jobRecord.id, contentId, e, logger, "Probe job");
  } finally {
    if (tempPath) await cleanupTemp(tempPath);
  }
};
