import { randomUUID } from "node:crypto";
import { createWriteStream, createReadStream } from "node:fs";
import { mkdir, unlink, stat } from "node:fs/promises";
import { join } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

import { Upload } from "@aws-sdk/lib-storage";

import { eq } from "drizzle-orm";
import { AppError, ok, err } from "@snc/shared";
import type { Result, ProcessingJobType, ProcessingJobStatus, ProcessingStatus } from "@snc/shared";

import { db } from "../db/connection.js";
import { processingJobs } from "../db/schema/processing.schema.js";
import { content } from "../db/schema/content.schema.js";
import { storage, s3Client, s3Bucket } from "../storage/index.js";
import { config } from "../config.js";
import { rootLogger } from "../logging/logger.js";

// ── Public Types ──

export type ProcessingJobRow = typeof processingJobs.$inferSelect;

// ── Constants ──

const MULTIPART_THRESHOLD = 100 * 1024 * 1024; // 100 MB

// ── Public API ──

/**
 * Create a processing job record in the database with "queued" status.
 */
export const createJob = async (
  contentId: string,
  type: ProcessingJobType,
): Promise<ProcessingJobRow> => {
  const [job] = await db
    .insert(processingJobs)
    .values({
      id: randomUUID(),
      contentId,
      type,
      status: "queued",
    })
    .returning();
  return job!;
};

/**
 * Update a processing job's status and optional progress/error fields.
 */
export const updateJob = async (
  jobId: string,
  updates: {
    status?: ProcessingJobStatus;
    progress?: number;
    error?: string;
    completedAt?: Date;
  },
): Promise<void> => {
  await db
    .update(processingJobs)
    .set({ ...updates, updatedAt: new Date() })
    .where(eq(processingJobs.id, jobId));
};

/**
 * Update processing-related columns on the content table.
 */
export const updateContentProcessing = async (
  contentId: string,
  updates: Partial<{
    videoCodec: string | null;
    audioCodec: string | null;
    width: number | null;
    height: number | null;
    duration: number | null;
    bitrate: number | null;
    processingStatus: ProcessingStatus;
    transcodedMediaKey: string | null;
    thumbnailKey: string | null;
  }>,
): Promise<void> => {
  await db
    .update(content)
    .set({ ...updates, updatedAt: new Date() })
    .where(eq(content.id, contentId));
};

/**
 * Get the content row for a processing job by content ID.
 */
export const getContentForJob = async (
  contentId: string,
): Promise<typeof content.$inferSelect | null> => {
  const [row] = await db
    .select()
    .from(content)
    .where(eq(content.id, contentId));
  return row ?? null;
};

/**
 * Download a storage key to a local temp file. Returns the temp file path.
 * Creates the temp directory if it doesn't exist.
 *
 * @returns err(AppError) when download fails or storage is unreachable
 */
export const downloadToTemp = async (
  storageKey: string,
  filename: string,
): Promise<Result<string, AppError>> => {
  try {
    await mkdir(config.MEDIA_TEMP_DIR, { recursive: true });
    const tempPath = join(config.MEDIA_TEMP_DIR, `${randomUUID()}-${filename}`);

    const downloadResult = await storage.download(storageKey);
    if (!downloadResult.ok) return err(downloadResult.error);

    const nodeReadable = Readable.fromWeb(downloadResult.value.stream as Parameters<typeof Readable.fromWeb>[0]);
    await pipeline(nodeReadable, createWriteStream(tempPath));
    return ok(tempPath);
  } catch (e) {
    rootLogger.error({ error: e instanceof Error ? e.message : String(e) }, "Failed to download to temp");
    return err(new AppError("PROCESSING_ERROR", "Failed to download media for processing", 500));
  }
};

/**
 * Upload a local file to storage. Returns ok on success.
 *
 * For files ≥100 MB on S3, uses multipart streaming upload via `@aws-sdk/lib-storage`
 * to avoid buffering the entire file in memory and to bypass the 5 GB single-PUT limit.
 * Smaller files and local storage use the StorageProvider path.
 *
 * @returns err(AppError) when upload fails or storage is unreachable
 */
export const uploadFromTemp = async (
  tempPath: string,
  storageKey: string,
  contentType: string,
): Promise<Result<void, AppError>> => {
  try {
    const fileStats = await stat(tempPath);

    if (s3Client && s3Bucket && fileStats.size >= MULTIPART_THRESHOLD) {
      const upload = new Upload({
        client: s3Client,
        params: {
          Bucket: s3Bucket,
          Key: storageKey,
          ContentType: contentType,
          Body: createReadStream(tempPath),
        },
      });
      await upload.done();
      return ok(undefined);
    }

    // Small files or local storage — use existing StorageProvider
    const nodeStream = createReadStream(tempPath);
    const webStream = Readable.toWeb(nodeStream) as ReadableStream<Uint8Array>;
    const uploadResult = await storage.upload(storageKey, webStream, {
      contentType,
      contentLength: fileStats.size,
    });
    if (!uploadResult.ok) return err(uploadResult.error);
    return ok(undefined);
  } catch (e) {
    rootLogger.error(
      { error: e instanceof Error ? e.message : String(e) },
      "Failed to upload from temp",
    );
    return err(
      new AppError("PROCESSING_ERROR", "Failed to upload processed media", 500),
    );
  }
};

/**
 * Clean up a temp file. Best-effort — logs errors but does not throw.
 */
export const cleanupTemp = async (tempPath: string): Promise<void> => {
  try {
    await unlink(tempPath);
  } catch {
    rootLogger.warn({ path: tempPath }, "Failed to clean up temp file");
  }
};
