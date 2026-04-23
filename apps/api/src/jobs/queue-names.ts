/**
 * Canonical pg-boss queue names for media, playout, and notification jobs.
 *
 * This file is intentionally dependency-free so services can import
 * `JOB_QUEUES` without pulling in the full worker-registration chain
 * (handlers, orchestrator init, Liquidsoap config). Keep it that way —
 * do not add imports here.
 */
export const JOB_QUEUES = {
  PROBE_CODEC: "media/probe-codec",
  TRANSCODE: "media/transcode",
  EXTRACT_THUMBNAIL: "media/extract-thumbnail",
  VOD_REMUX: "media/vod-remux",
  PLAYOUT_INGEST: "playout/ingest",
  NOTIFICATION_SEND: "notification/send",
  CLEANUP_INCOMPLETE_UPLOADS: "storage/cleanup-incomplete-uploads",
} as const;
