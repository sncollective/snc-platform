import { PgBoss } from "pg-boss";
import type { Job } from "pg-boss";

import { config } from "../config.js";
import { rootLogger } from "../logging/logger.js";
import { handleProbeCodec } from "./handlers/probe-codec.js";
import { handleTranscode } from "./handlers/transcode.js";
import { handleExtractThumbnail } from "./handlers/extract-thumbnail.js";
import { handlePlayoutIngest } from "./handlers/playout-ingest.js";
import { handleNotificationSend } from "./handlers/notification-send.js";
import { handleEventReminderDispatch } from "./handlers/event-reminder.js";
import { handlePlayoutQueueCleanup } from "./handlers/playout-queue-cleanup.js";
import { handleCleanupIncompleteUploads } from "./handlers/cleanup-incomplete-uploads.js";
import type { ProbeJobData } from "./handlers/probe-codec.js";
import type { TranscodeJobData } from "./handlers/transcode.js";
import type { ThumbnailJobData } from "./handlers/extract-thumbnail.js";
import type { PlayoutIngestJobData } from "./handlers/playout-ingest.js";
import type { NotificationSendJobData } from "./handlers/notification-send.js";
import type { CleanupIncompleteUploadsJobData } from "./handlers/cleanup-incomplete-uploads.js";
import { orchestrator } from "../routes/playout-channels.init.js";
import { writeConfigOnly, waitForHealth } from "../services/liquidsoap-config.js";
import { JOB_QUEUES } from "./queue-names.js";

// ── Job Queue Names ──

// JOB_QUEUES lives in ./queue-names.ts so services can reference it without
// pulling in this file's handler imports. Re-exported here for backward
// compatibility with existing consumers and tests that mock register-workers.
export { JOB_QUEUES };

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

  await boss.createQueue(JOB_QUEUES.CLEANUP_INCOMPLETE_UPLOADS, {
    retryLimit: 2,
    expireInSeconds: 300,
    deleteAfterSeconds: 60 * 60 * 24 * 7,
  });

  await boss.work<CleanupIncompleteUploadsJobData>(
    JOB_QUEUES.CLEANUP_INCOMPLETE_UPLOADS,
    { localConcurrency: 1 },
    (jobs) => handleCleanupIncompleteUploads(jobs as [Job<CleanupIncompleteUploadsJobData>]),
  );

  await boss.schedule(
    JOB_QUEUES.CLEANUP_INCOMPLETE_UPLOADS,
    "0 3 * * *",
    { olderThanSecs: 86400 },
  );

  rootLogger.info(
    { concurrency, queues: Object.values(JOB_QUEUES) },
    "Media processing workers registered",
  );

  // Event reminder cron — dispatch notifications every 5 minutes
  const REMINDER_INTERVAL_MS = 5 * 60 * 1000;
  setInterval(() => {
    handleEventReminderDispatch().catch((err) =>
      rootLogger.error(
        { error: err instanceof Error ? err.message : String(err) },
        "Event reminder dispatch failed",
      ),
    );
  }, REMINDER_INTERVAL_MS);
  rootLogger.info("Event reminder cron registered (every 5 minutes)");

  // Playout queue cleanup cron — trim `played` rows to per-channel cap every hour
  const PLAYOUT_CLEANUP_INTERVAL_MS = 60 * 60 * 1000;
  setInterval(() => {
    handlePlayoutQueueCleanup().catch((err) =>
      rootLogger.error(
        { error: err instanceof Error ? err.message : String(err) },
        "Playout queue cleanup failed",
      ),
    );
  }, PLAYOUT_CLEANUP_INTERVAL_MS);
  rootLogger.info("Playout queue cleanup cron registered (every hour)");

  // Write Liquidsoap config from DB state before orchestrator starts
  // No restart signal — Liquidsoap reads the file on its own startup
  await writeConfigOnly();

  // Wait for Liquidsoap to be healthy before pushing tracks
  const healthy = await waitForHealth(15, 2000);
  if (!healthy) {
    rootLogger.warn("Liquidsoap not healthy after 30s — orchestrator will initialize without prefetch");
  }

  await orchestrator.initialize();
  rootLogger.info("Playout orchestrator initialized");
};
