import type {
  PresignRequest,
  PresignResponse,
  CreateMultipartRequest,
  CreateMultipartResponse,
  CompleteUploadRequest,
} from "@snc/shared";

import { apiGet, apiMutate } from "./fetch-utils.js";

/** Obtain a presigned URL for a single-part upload. */
export async function presignUpload(
  request: PresignRequest,
): Promise<PresignResponse> {
  return apiMutate<PresignResponse>("/api/uploads/presign", {
    body: request,
  });
}

/** Initiate a multipart upload and return the upload ID and key. */
export async function createMultipartUpload(
  request: CreateMultipartRequest,
): Promise<CreateMultipartResponse> {
  return apiMutate<CreateMultipartResponse>("/api/uploads/s3/multipart", {
    body: request,
  });
}

/** Obtain a presigned URL for a single part of a multipart upload. */
export async function signPart(
  uploadId: string,
  partNumber: number,
  key: string,
): Promise<{ url: string }> {
  return apiGet<{ url: string }>(
    `/api/uploads/s3/multipart/${uploadId}/${partNumber}`,
    { key },
  );
}

/** Finalize a multipart upload by submitting the completed parts manifest. */
export async function completeMultipartUpload(
  uploadId: string,
  key: string,
  parts: Array<{ PartNumber: number; ETag: string }>,
): Promise<void> {
  await apiMutate<void>(`/api/uploads/s3/multipart/${uploadId}/complete`, {
    body: { key, parts },
  });
}

/** Abort a multipart upload and discard uploaded parts. */
export async function abortMultipartUpload(
  uploadId: string,
  key: string,
): Promise<void> {
  await apiMutate<void>(
    `/api/uploads/s3/multipart/${uploadId}?key=${encodeURIComponent(key)}`,
    {
      method: "DELETE",
    },
  );
}

/** List already-uploaded parts for a multipart upload (used for resumption). */
export async function listParts(
  uploadId: string,
  key: string,
): Promise<Array<{ PartNumber: number; Size: number; ETag: string }>> {
  return apiGet<Array<{ PartNumber: number; Size: number; ETag: string }>>(`/api/uploads/s3/multipart/${uploadId}`, { key });
}

/** Notify the API that a file upload is complete and ready for processing. */
export async function completeUpload(
  request: CompleteUploadRequest,
): Promise<void> {
  await apiMutate<void>("/api/uploads/complete", { body: request });
}

/** Retry an async function with exponential backoff, throwing the last error on exhaustion. */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxAttempts: number,
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (e) {
      lastError = e;
      if (attempt < maxAttempts - 1) {
        const BASE_RETRY_DELAY_MS = 1000;
        await new Promise((r) => setTimeout(r, BASE_RETRY_DELAY_MS * 2 ** attempt));
      }
    }
  }
  throw lastError;
}
