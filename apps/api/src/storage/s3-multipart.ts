import {
  S3Client,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand,
  ListPartsCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import { ok, err } from "@snc/shared";
import { AppError } from "@snc/shared";
import { wrapS3Error } from "./s3-error";
import type { Result } from "@snc/shared";
import type { CompletedPart } from "@snc/shared";

// ── Public Types ──

export type S3MultipartOptions = {
  client: S3Client;
  bucket: string;
};

export type ListedPart = {
  PartNumber: number;
  Size: number;
  ETag: string;
};

export type S3MultipartService = {
  createMultipartUpload(
    key: string,
    contentType: string,
  ): Promise<Result<{ uploadId: string; key: string }, AppError>>;

  signPart(
    uploadId: string,
    key: string,
    partNumber: number,
    expiresInSeconds?: number,
  ): Promise<Result<string, AppError>>;

  completeMultipartUpload(
    uploadId: string,
    key: string,
    parts: CompletedPart[],
  ): Promise<Result<void, AppError>>;

  abortMultipartUpload(
    uploadId: string,
    key: string,
  ): Promise<Result<void, AppError>>;

  listParts(
    uploadId: string,
    key: string,
  ): Promise<Result<ListedPart[], AppError>>;
};

// ── Public API ──

/** Create an S3MultipartService for managing chunked uploads via presigned part URLs. */
export const createS3Multipart = (
  options: S3MultipartOptions,
): S3MultipartService => {
  const { client, bucket } = options;

  const createMultipartUpload = async (
    key: string,
    contentType: string,
  ): Promise<Result<{ uploadId: string; key: string }, AppError>> => {
    try {
      const response = await client.send(
        new CreateMultipartUploadCommand({
          Bucket: bucket,
          Key: key,
          ContentType: contentType,
        }),
      );
      if (!response.UploadId) {
        return err(new AppError("S3_MULTIPART_ERROR", "No UploadId returned", 502));
      }
      return ok({ uploadId: response.UploadId, key });
    } catch (e) {
      return err(wrapS3Error(e, "S3_MULTIPART_ERROR"));
    }
  };

  const signPart = async (
    uploadId: string,
    key: string,
    partNumber: number,
    expiresInSeconds = 3600,
  ): Promise<Result<string, AppError>> => {
    try {
      const command = new UploadPartCommand({
        Bucket: bucket,
        Key: key,
        UploadId: uploadId,
        PartNumber: partNumber,
      });
      const url = await getSignedUrl(client, command, {
        expiresIn: expiresInSeconds,
      });
      return ok(url);
    } catch (e) {
      return err(wrapS3Error(e, "S3_MULTIPART_ERROR"));
    }
  };

  const completeMultipartUpload = async (
    uploadId: string,
    key: string,
    parts: CompletedPart[],
  ): Promise<Result<void, AppError>> => {
    try {
      await client.send(
        new CompleteMultipartUploadCommand({
          Bucket: bucket,
          Key: key,
          UploadId: uploadId,
          MultipartUpload: {
            Parts: parts.map((p) => ({
              PartNumber: p.PartNumber,
              ETag: p.ETag,
            })),
          },
        }),
      );
      return ok(undefined);
    } catch (e) {
      return err(wrapS3Error(e, "S3_MULTIPART_ERROR"));
    }
  };

  const abortMultipartUpload = async (
    uploadId: string,
    key: string,
  ): Promise<Result<void, AppError>> => {
    try {
      await client.send(
        new AbortMultipartUploadCommand({
          Bucket: bucket,
          Key: key,
          UploadId: uploadId,
        }),
      );
      return ok(undefined);
    } catch (e) {
      return err(wrapS3Error(e, "S3_MULTIPART_ERROR"));
    }
  };

  const listParts = async (
    uploadId: string,
    key: string,
  ): Promise<Result<ListedPart[], AppError>> => {
    try {
      const response = await client.send(
        new ListPartsCommand({
          Bucket: bucket,
          Key: key,
          UploadId: uploadId,
        }),
      );
      const parts: ListedPart[] = (response.Parts ?? []).map((p) => ({
        PartNumber: p.PartNumber ?? 0,
        Size: p.Size ?? 0,
        ETag: p.ETag ?? "",
      }));
      return ok(parts);
    } catch (e) {
      return err(wrapS3Error(e, "S3_MULTIPART_ERROR"));
    }
  };

  return {
    createMultipartUpload,
    signPart,
    completeMultipartUpload,
    abortMultipartUpload,
    listParts,
  };
};
