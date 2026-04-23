import type { Job } from "pg-boss";

import { rootLogger } from "../../logging/logger.js";
import { config } from "../../config.js";

// ── Public Types ──

export interface CleanupIncompleteUploadsJobData {
  /** Age threshold in seconds. Uploads older than this are cleaned up. */
  readonly olderThanSecs: number;
}

// ── Private Constants ──

const GARAGE_ADMIN_URL = "http://snc-garage:3903";

// ── Public API ──

/**
 * Clean up incomplete multipart uploads in Garage older than the configured
 * threshold. Prefers Garage's Admin API (single call across buckets); falls
 * back to S3 ListMultipartUploads + AbortMultipartUpload per bucket if the
 * Admin API is unreachable.
 */
export async function handleCleanupIncompleteUploads(
  jobs: [Job<CleanupIncompleteUploadsJobData>],
): Promise<void> {
  const [job] = jobs;
  const { olderThanSecs } = job.data;
  const logger = rootLogger.child({ job: "cleanup-incomplete-uploads" });

  try {
    const response = await fetch(
      `${GARAGE_ADMIN_URL}/v2/CleanupIncompleteUploads`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.GARAGE_ADMIN_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ olderThanSecs }),
      },
    );

    if (response.ok) {
      const result = (await response.json()) as { uploadsCleaned?: number };
      logger.info(
        { uploadsCleaned: result.uploadsCleaned ?? 0, olderThanSecs },
        "Incomplete multipart uploads cleaned up via Garage Admin API",
      );
      return;
    }

    logger.warn(
      { status: response.status, statusText: response.statusText },
      "Garage Admin API cleanup failed, falling back to S3 API",
    );
  } catch (err) {
    logger.warn(
      { error: err instanceof Error ? err.message : String(err) },
      "Garage Admin API unreachable, falling back to S3 API",
    );
  }

  await cleanupViaS3Api(olderThanSecs, logger);
}

type CleanupLogger = {
  info(obj: object, msg: string): void;
  warn(obj: object | string, msg?: string): void;
  debug(obj: object, msg: string): void;
};

async function cleanupViaS3Api(
  olderThanSecs: number,
  logger: CleanupLogger,
): Promise<void> {
  const { ListMultipartUploadsCommand, AbortMultipartUploadCommand } = await import("@aws-sdk/client-s3");
  const { s3Client, s3Bucket } = await import("../../storage/index.js");

  if (!s3Client || !s3Bucket) {
    logger.warn("S3 not configured, skipping cleanup");
    return;
  }

  const cutoff = new Date(Date.now() - olderThanSecs * 1000);
  let cleaned = 0;

  const listResponse = await s3Client.send(
    new ListMultipartUploadsCommand({ Bucket: s3Bucket }),
  );

  for (const upload of listResponse.Uploads ?? []) {
    if (upload.Initiated && upload.Initiated < cutoff && upload.UploadId && upload.Key) {
      await s3Client.send(
        new AbortMultipartUploadCommand({
          Bucket: s3Bucket,
          Key: upload.Key,
          UploadId: upload.UploadId,
        }),
      );
      cleaned++;
      logger.debug(
        { key: upload.Key, uploadId: upload.UploadId, initiated: upload.Initiated.toISOString() },
        "Aborted incomplete multipart upload",
      );
    }
  }

  logger.info({ cleaned, olderThanSecs }, "Incomplete multipart uploads cleaned up via S3 API");
}
