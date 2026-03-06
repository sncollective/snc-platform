import type { ContentResponse, CreateContent, FeedResponse } from "@snc/shared";

import { apiGet, apiMutate, apiUpload } from "./fetch-utils.js";

// ── Public API ──

export async function createContent(
  data: CreateContent,
): Promise<ContentResponse> {
  return apiMutate<ContentResponse>("/api/content", { body: data });
}

export async function uploadContentFile(
  contentId: string,
  field: "media" | "thumbnail" | "coverArt",
  file: File,
): Promise<ContentResponse> {
  const formData = new FormData();
  formData.append("file", file);
  return apiUpload<ContentResponse>(
    `/api/content/${contentId}/upload?field=${field}`,
    formData,
  );
}

export async function fetchMyContent(
  creatorId: string,
  cursor?: string,
): Promise<FeedResponse> {
  return apiGet<FeedResponse>("/api/content", {
    creatorId,
    limit: 12,
    cursor,
  });
}
