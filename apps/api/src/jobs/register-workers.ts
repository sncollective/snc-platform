import { PgBoss } from "pg-boss";
import type { Job } from "pg-boss";

import { config } from "../config.js";
import { rootLogger } from "../logging/logger.js";
import { handleProbeCodec } from "./handlers/probe-codec.js";
import { handleTranscode } from "./handlers/transcode.js";
import { handleExtractThumbnail } from "./handlers/extract-thumbnail.js";
import { handlePlayoutIngest } from "./handlers/playout-ingest.js";
import { handleNotificationSend } from "./handlers/notification-send.js";
import type { ProbeJobData } from "./handlers/probe-codec.js";
import type { TranscodeJobData } from "./handlers/transcode.js";
import type { ThumbnailJobData } from "./handlers/extract-thumbnail.js";
import type { PlayoutIngestJobData } from "./handlers/playout-ingest.js";
import type { NotificationSendJobData } from "./handlers/notification-send.js";
import { orchestrator } from "../routes/playout-channels.init.js";

// ── Job Queue Names ──

/** Canonical pg-boss queue names for media, playout, and notification jobs. */
export const JOB_QUEUES = {
  PROBE_CODEC: "media/probe-codec",
  TRANSCODE: "media/transcode",
  EXTRACT_THUMBNAIL: "media/extract-thumbnail",
  VOD_REMUX: "media/vod-remux",
  PLAYOUT_INGEST: "playout/ingest",
  NOTIFICATION_SEND: "notification/send",
} as const;

// ── Public API ──

/**
 * Create queues and register all media processing workers with pg-boss.
 * Called after boss.start() during server initialization.
 */
export const registerWorkers = async (boss: PgBoss): Promise<void> => {
  const concurrency = config.MEDIA_FFMPEG_CONCURRENCY;

  // Create queues with per-queue options
  await boss.createQueue(JOB_QUEUES.PROBE_CODEC, {
    retryLimit: 2,
    expireInSeconds: 300,
    deleteAfterSeconds: 60 * 60 * 24 * 7,
  });

  await boss.createQueue(JOB_QUEUES.TRANSCODE, {
    retryLimit: 1,
    expireInSeconds: 7200,
    heartbeatSeconds: 60,
    deleteAfterSeconds: 60 * 60 * 24 * 7,
  });

  await boss.createQueue(JOB_QUEUES.EXTRACT_THUMBNAIL, {
    retryLimit: 2,
    expireInSeconds: 300,
    deleteAfterSeconds: 60 * 60 * 24 * 7,
  });

  // Register workers
  await boss.work<ProbeJobData>(
    JOB_QUEUES.PROBE_CODEC,
    { localConcurrency: concurrency },
    (jobs) => handleProbeCodec(jobs as [Job<ProbeJobData>], boss),
  );

  await boss.work<TranscodeJobData>(
    JOB_QUEUES.TRANSCODE,
    { localConcurrency: concurrency },
    (jobs) => handleTranscode(jobs as [Job<TranscodeJobData>]),
  );

  await boss.work<ThumbnailJobData>(
    JOB_QUEUES.EXTRACT_THUMBNAIL,
    { localConcurrency: concurrency },
    (jobs) => handleExtractThumbnail(jobs as [Job<ThumbnailJobData>]),
  );

  await boss.createQueue(JOB_QUEUES.PLAYOUT_INGEST, {
    retryLimit: 1,
    expireInSeconds: 21600, // 6 hours — downloads source + transcodes all renditions sequentially
    heartbeatSeconds: 120,
    deleteAfterSeconds: 60 * 60 * 24 * 7,
  });

  await boss.work<PlayoutIngestJobData>(
    JOB_QUEUES.PLAYOUT_INGEST,
    { localConcurrency: 1 },
    (jobs) => handlePlayoutIngest(jobs as [Job<PlayoutIngestJobData>]),
  );

  await boss.createQueue(JOB_QUEUES.NOTIFICATION_SEND, {
    retryLimit: 3,
    retryDelay: 60, // 1 min between retries
    expireInSeconds: 120,
    deleteAfterSeconds: 60 * 60 * 24 * 30, // Keep 30 days for audit
  });

  await boss.work<NotificationSendJobData>(
    JOB_QUEUES.NOTIFICATION_SEND,
    { localConcurrency: 3 },
    (jobs) => handleNotificationSend(jobs as [Job<NotificationSendJobData>]),
  );

  rootLogger.info(
    { concurrency, queues: Object.values(JOB_QUEUES) },
    "Media processing workers registered",
  );

  await orchestrator.initialize();
  rootLogger.info("Playout orchestrator initialized");
};
