import type {
  PresignRequest,
  PresignResponse,
  CreateMultipartRequest,
  CreateMultipartResponse,
  CompleteUploadRequest,
} from "@snc/shared";

import { apiGet, apiMutate } from "./fetch-utils.js";

export async function presignUpload(
  request: PresignRequest,
): Promise<PresignResponse> {
  return apiMutate<PresignResponse>("/api/uploads/presign", {
    body: request,
  });
}

export async function createMultipartUpload(
  request: CreateMultipartRequest,
): Promise<CreateMultipartResponse> {
  return apiMutate<CreateMultipartResponse>("/api/uploads/s3/multipart", {
    body: request,
  });
}

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

export async function completeMultipartUpload(
  uploadId: string,
  key: string,
  parts: Array<{ PartNumber: number; ETag: string }>,
): Promise<void> {
  await apiMutate(`/api/uploads/s3/multipart/${uploadId}/complete`, {
    body: { key, parts },
  });
}

export async function abortMultipartUpload(
  uploadId: string,
  key: string,
): Promise<void> {
  await apiMutate(
    `/api/uploads/s3/multipart/${uploadId}?key=${encodeURIComponent(key)}`,
    {
      method: "DELETE",
    },
  );
}

export async function listParts(
  uploadId: string,
  key: string,
): Promise<Array<{ PartNumber: number; Size: number; ETag: string }>> {
  return apiGet(`/api/uploads/s3/multipart/${uploadId}`, { key });
}

export async function completeUpload(
  request: CompleteUploadRequest,
): Promise<void> {
  await apiMutate("/api/uploads/complete", { body: request });
}

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
        await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt));
      }
    }
  }
  throw lastError;
}
