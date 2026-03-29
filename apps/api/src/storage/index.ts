import type { StorageProvider } from "@snc/shared";

import { config } from "../config.js";
import { createLocalStorage } from "./local-storage.js";
import { createS3Storage } from "./s3-storage.js";
import { createS3Multipart } from "./s3-multipart.js";
import type { S3MultipartService } from "./s3-multipart.js";
import { createS3Client, createStorageProvider } from "./provider.js";


export { createStorageProvider };

// ── Public API ──

// Share a single S3Client instance between storage and multipart services
const s3Client = config.STORAGE_TYPE === "s3" ? createS3Client(config) : null;

/** StorageProvider singleton — S3 when configured, local filesystem otherwise. */
export const storage: StorageProvider = s3Client
  ? createS3Storage({ client: s3Client, bucket: config.S3_BUCKET! })
  : createLocalStorage({ baseDir: config.STORAGE_LOCAL_DIR });

/** S3MultipartService singleton for large uploads; null when using local storage. */
export const s3Multipart: S3MultipartService | null = s3Client
  ? createS3Multipart({ client: s3Client, bucket: config.S3_BUCKET! })
  : null;
