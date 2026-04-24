import { Readable, PassThrough } from "node:stream";

import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import { ok, err, AppError, NotFoundError } from "@snc/shared";
import type {
  StorageProvider,
  UploadMetadata,
  UploadResult,
  DownloadResult,
  RangeDownloadResult,
  Result,
} from "@snc/shared";

import { wrapS3Error } from "./s3-error.js";

// ── Public Types ──

export type S3StorageOptions = {
  client: S3Client;
  bucket: string;
};

// ── Private Helpers ──

const isNoSuchKey = (e: unknown): boolean =>
  e instanceof Error && "name" in e && e.name === "NoSuchKey";

// ── Public API ──

/** Create a StorageProvider backed by S3-compatible object storage. */
export const createS3Storage = (options: S3StorageOptions): StorageProvider => {
  const { client, bucket } = options;

  const upload = async (
    key: string,
    stream: ReadableStream<Uint8Array>,
    metadata?: UploadMetadata,
  ): Promise<Result<UploadResult, AppError>> => {
    try {
      const nodeReadable = Readable.fromWeb(
        stream as Parameters<typeof Readable.fromWeb>[0],
      );

      // Count bytes streaming through so we can report size without a HEAD
      // round-trip and without requiring callers to pass contentLength.
      let bytesStreamed = 0;
      const counter = new PassThrough();
      counter.on("data", (chunk: Buffer) => {
        bytesStreamed += chunk.length;
      });
      nodeReadable.pipe(counter);

      const uploader = new Upload({
        client,
        params: {
          Bucket: bucket,
          Key: key,
          Body: counter,
          ContentType: metadata?.contentType,
        },
      });
      await uploader.done();

      return ok({ key, size: metadata?.contentLength ?? bytesStreamed });
    } catch (e) {
      return err(wrapS3Error(e, "S3_ERROR"));
    }
  };

  const download = async (
    key: string,
  ): Promise<Result<DownloadResult, AppError>> => {
    try {
      const response = await client.send(
        new GetObjectCommand({ Bucket: bucket, Key: key }),
      );
      if (!response.Body) {
        return err(new NotFoundError("File not found"));
      }
      const webStream = response.Body.transformToWebStream() as ReadableStream<Uint8Array>;
      return ok({ stream: webStream, size: response.ContentLength ?? 0 });
    } catch (e) {
      if (isNoSuchKey(e)) {
        return err(new NotFoundError("File not found"));
      }
      return err(wrapS3Error(e, "S3_ERROR"));
    }
  };

  const downloadRange = async (
    key: string,
    start: number,
    end: number,
  ): Promise<Result<RangeDownloadResult, AppError>> => {
    try {
      const response = await client.send(
        new GetObjectCommand({
          Bucket: bucket,
          Key: key,
          Range: `bytes=${start}-${end}`,
        }),
      );
      if (!response.Body) {
        return err(new NotFoundError("File not found"));
      }

      const webStream =
        response.Body.transformToWebStream() as ReadableStream<Uint8Array>;

      // ContentRange format: "bytes start-end/total"
      const totalSize = response.ContentRange
        ? Number(response.ContentRange.split("/")[1])
        : 0;

      return ok({
        stream: webStream,
        contentLength: response.ContentLength ?? end - start + 1,
        totalSize,
        range: { start, end },
      });
    } catch (e) {
      if (isNoSuchKey(e)) {
        return err(new NotFoundError("File not found"));
      }
      return err(wrapS3Error(e, "S3_ERROR"));
    }
  };

  const deleteFile = async (
    key: string,
  ): Promise<Result<void, AppError>> => {
    try {
      await client.send(
        new DeleteObjectCommand({ Bucket: bucket, Key: key }),
      );
      return ok(undefined);
    } catch (e) {
      return err(wrapS3Error(e, "S3_ERROR"));
    }
  };

  const getSignedUrlFn = async (
    key: string,
    expiresInSeconds: number,
  ): Promise<Result<string, AppError>> => {
    try {
      const command = new GetObjectCommand({ Bucket: bucket, Key: key });
      const url = await getSignedUrl(client, command, { expiresIn: expiresInSeconds });
      return ok(url);
    } catch (e) {
      return err(wrapS3Error(e, "S3_ERROR"));
    }
  };

  const head = async (
    key: string,
  ): Promise<Result<{ size: number; contentType: string }, AppError>> => {
    try {
      const response = await client.send(
        new HeadObjectCommand({ Bucket: bucket, Key: key }),
      );
      return ok({
        size: response.ContentLength ?? 0,
        contentType: response.ContentType ?? "application/octet-stream",
      });
    } catch (e) {
      if (isNoSuchKey(e)) {
        return err(new NotFoundError("File not found"));
      }
      return err(wrapS3Error(e, "S3_ERROR"));
    }
  };

  const getPresignedUploadUrl = async (
    key: string,
    contentType: string,
    expiresInSeconds: number,
    contentLength: number,
  ): Promise<Result<string, AppError>> => {
    try {
      const command = new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        ContentType: contentType,
        ContentLength: contentLength,
      });
      const url = await getSignedUrl(client, command, { expiresIn: expiresInSeconds });
      return ok(url);
    } catch (e) {
      return err(wrapS3Error(e, "S3_ERROR"));
    }
  };

  return {
    upload,
    download,
    downloadRange,
    delete: deleteFile,
    getSignedUrl: getSignedUrlFn,
    head,
    getPresignedUploadUrl,
  };
};
