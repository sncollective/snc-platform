import { S3Client } from "@aws-sdk/client-s3";

import type { StorageProvider } from "@snc/shared";
import { AppError } from "@snc/shared";

import type { Config } from "../config.js";
import { config } from "../config.js";
import { createLocalStorage } from "./local-storage.js";
import { createS3Storage } from "./s3-storage.js";
import { createS3Multipart } from "./s3-multipart.js";
import type { S3MultipartService } from "./s3-multipart.js";

// ── Private Helpers ──

const createS3Client = (cfg: Config): S3Client => {
  if (
    !cfg.S3_ENDPOINT ||
    !cfg.S3_BUCKET ||
    !cfg.S3_ACCESS_KEY_ID ||
    !cfg.S3_SECRET_ACCESS_KEY
  ) {
    throw new AppError(
      "STORAGE_CONFIG_ERROR",
      "S3 storage requires S3_ENDPOINT, S3_BUCKET, S3_ACCESS_KEY_ID, and S3_SECRET_ACCESS_KEY",
      500,
    );
  }
  return new S3Client({
    endpoint: cfg.S3_ENDPOINT,
    region: cfg.S3_REGION,
    credentials: {
      accessKeyId: cfg.S3_ACCESS_KEY_ID,
      secretAccessKey: cfg.S3_SECRET_ACCESS_KEY,
    },
    forcePathStyle: true,
  });
};

export const createStorageProvider = (cfg: Config): StorageProvider => {
  switch (cfg.STORAGE_TYPE) {
    case "local":
      return createLocalStorage({ baseDir: cfg.STORAGE_LOCAL_DIR });
    case "s3": {
      const client = createS3Client(cfg);
      return createS3Storage({ client, bucket: cfg.S3_BUCKET! });
    }
    default: {
      const exhaustive: never = cfg.STORAGE_TYPE;
      throw new AppError("STORAGE_CONFIG_ERROR", `Unknown storage type: ${exhaustive}`, 500);
    }
  }
};

// ── Public API ──

// Share a single S3Client instance between storage and multipart services
const s3Client = config.STORAGE_TYPE === "s3" ? createS3Client(config) : null;

export const storage: StorageProvider = s3Client
  ? createS3Storage({ client: s3Client, bucket: config.S3_BUCKET! })
  : createLocalStorage({ baseDir: config.STORAGE_LOCAL_DIR });

export const s3Multipart: S3MultipartService | null = s3Client
  ? createS3Multipart({ client: s3Client, bucket: config.S3_BUCKET! })
  : null;
