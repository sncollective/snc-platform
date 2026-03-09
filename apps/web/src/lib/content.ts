import type { ContentResponse, CreateContent } from "@snc/shared";

import { apiMutate, apiUpload } from "./fetch-utils.js";

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
