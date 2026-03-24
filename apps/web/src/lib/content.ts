import type { ContentResponse, CreateContent, UpdateContent } from "@snc/shared";

import { apiGet, apiMutate, apiUpload } from "./fetch-utils.js";

// ── Public API ──

export async function createContent(
  data: CreateContent,
): Promise<ContentResponse> {
  return apiMutate<ContentResponse>("/api/content", { body: data });
}

export async function uploadContentFile(
  contentId: string,
  field: "media" | "thumbnail",
  file: File,
): Promise<ContentResponse> {
  const formData = new FormData();
  formData.append("file", file);
  return apiUpload<ContentResponse>(
    `/api/content/${contentId}/upload?field=${field}`,
    formData,
  );
}

export async function updateContent(
  id: string,
  data: UpdateContent,
): Promise<ContentResponse> {
  return apiMutate<ContentResponse>(
    `/api/content/${encodeURIComponent(id)}`,
    { method: "PATCH", body: data },
  );
}

export async function fetchDrafts(
  creatorId: string,
  cursor?: string,
): Promise<{ items: ContentResponse[]; nextCursor: string | null }> {
  const params: Record<string, string> = { creatorId, limit: "12" };
  if (cursor) params.cursor = cursor;
  return apiGet<{ items: ContentResponse[]; nextCursor: string | null }>("/api/content/drafts", params);
}

export async function publishContent(id: string): Promise<ContentResponse> {
  return apiMutate<ContentResponse>(`/api/content/${encodeURIComponent(id)}/publish`, {
    method: "POST",
  });
}

export async function unpublishContent(id: string): Promise<ContentResponse> {
  return apiMutate<ContentResponse>(`/api/content/${encodeURIComponent(id)}/unpublish`, {
    method: "POST",
  });
}

export async function deleteContent(id: string): Promise<void> {
  await apiMutate<void>(`/api/content/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}
