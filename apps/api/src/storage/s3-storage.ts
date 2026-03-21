import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import { ok, err } from "@snc/shared";
import { AppError, NotFoundError } from "@snc/shared";
import type {
  StorageProvider,
  UploadMetadata,
  UploadResult,
  DownloadResult,
  Result,
} from "@snc/shared";

// ── Public Types ──

export type S3StorageOptions = {
  client: S3Client;
  bucket: string;
};

// ── Private Helpers ──

const wrapS3Error = (e: unknown): AppError => {
  const message = e instanceof Error ? e.message : String(e);
  return new AppError("S3_ERROR", message, 502);
};

const isNoSuchKey = (e: unknown): boolean =>
  e instanceof Error && "name" in e && e.name === "NoSuchKey";

// ── Public API ──

export const createS3Storage = (options: S3StorageOptions): StorageProvider => {
  const { client, bucket } = options;

  const upload = async (
    key: string,
    stream: ReadableStream<Uint8Array>,
    metadata?: UploadMetadata,
  ): Promise<Result<UploadResult, AppError>> => {
    try {
      const body = await new Response(stream).arrayBuffer();
      const command = new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: new Uint8Array(body),
        ContentType: metadata?.contentType,
      });
      await client.send(command);

      const headResponse = await client.send(
        new HeadObjectCommand({ Bucket: bucket, Key: key }),
      );
      return ok({ key, size: headResponse.ContentLength ?? body.byteLength });
    } catch (e) {
      return err(wrapS3Error(e));
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
      return err(wrapS3Error(e));
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
      return err(wrapS3Error(e));
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
      return err(wrapS3Error(e));
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
      return err(wrapS3Error(e));
    }
  };

  const getPresignedUploadUrl = async (
    key: string,
    contentType: string,
    expiresInSeconds: number,
  ): Promise<Result<string, AppError>> => {
    try {
      const command = new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        ContentType: contentType,
      });
      const url = await getSignedUrl(client, command, { expiresIn: expiresInSeconds });
      return ok(url);
    } catch (e) {
      return err(wrapS3Error(e));
    }
  };

  return {
    upload,
    download,
    delete: deleteFile,
    getSignedUrl: getSignedUrlFn,
    head,
    getPresignedUploadUrl,
  };
};
