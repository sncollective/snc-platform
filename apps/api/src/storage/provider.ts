import { S3Client } from "@aws-sdk/client-s3";

import type { StorageProvider } from "@snc/shared";
import { AppError } from "@snc/shared";

import type { Config } from "../config.js";
import { createLocalStorage } from "./local-storage.js";
import { createS3Storage } from "./s3-storage.js";

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
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
  });
};

/** Create a StorageProvider from config, selecting local or S3 based on STORAGE_TYPE. */
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

export { createS3Client };
