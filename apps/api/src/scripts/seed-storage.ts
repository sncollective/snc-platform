import { S3Client } from "@aws-sdk/client-s3";

import type { StorageProvider } from "@snc/shared";

import { createLocalStorage } from "../storage/local-storage.js";
import { createS3Storage } from "../storage/s3-storage.js";

// ── Public API ──

/** Create a StorageProvider from environment variables, bypassing the full app config. */
export const createSeedStorage = (): StorageProvider => {
  const storageType = process.env["STORAGE_TYPE"] ?? "local";

  if (storageType === "s3") {
    const endpoint = process.env["S3_ENDPOINT"];
    const bucket = process.env["S3_BUCKET"];
    const accessKeyId = process.env["S3_ACCESS_KEY_ID"];
    const secretAccessKey = process.env["S3_SECRET_ACCESS_KEY"];
    const region = process.env["S3_REGION"] ?? "garage";

    if (!endpoint || !bucket || !accessKeyId || !secretAccessKey) {
      throw new Error(
        "S3 storage requires S3_ENDPOINT, S3_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY",
      );
    }

    const client = new S3Client({
      endpoint,
      region,
      credentials: { accessKeyId, secretAccessKey },
      forcePathStyle: true,
      requestChecksumCalculation: "WHEN_REQUIRED",
      responseChecksumValidation: "WHEN_REQUIRED",
    });

    return createS3Storage({ client, bucket });
  }

  const baseDir = process.env["STORAGE_LOCAL_DIR"] ?? "./uploads";
  return createLocalStorage({ baseDir });
};

/** Convert a Buffer to a ReadableStream for StorageProvider.upload(). */
export const bufferToStream = (buffer: Buffer): ReadableStream<Uint8Array> =>
  new ReadableStream({
    start(controller) {
      controller.enqueue(new Uint8Array(buffer));
      controller.close();
    },
  });
