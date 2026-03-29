import type {
  PlayoutItem,
  PlayoutItemListResponse,
  CreatePlayoutItem,
  UpdatePlayoutItem,
  ReorderPlayoutItems,
  PlayoutStatus,
} from "@snc/shared";

import { apiGet, apiMutate } from "./fetch-utils.js";

/** List all playout items. */
export async function fetchPlayoutItems(): Promise<PlayoutItemListResponse> {
  return apiGet<PlayoutItemListResponse>("/api/playout/items");
}

/** Get a single playout item. */
export async function fetchPlayoutItem(id: string): Promise<PlayoutItem> {
  return apiGet<PlayoutItem>(`/api/playout/items/${encodeURIComponent(id)}`);
}

/** Create a new playout item. */
export async function createPlayoutItem(
  data: CreatePlayoutItem,
): Promise<PlayoutItem> {
  return apiMutate<PlayoutItem>("/api/playout/items", {
    method: "POST",
    body: data,
  });
}

/** Update a playout item. */
export async function updatePlayoutItem(
  id: string,
  data: UpdatePlayoutItem,
): Promise<PlayoutItem> {
  return apiMutate<PlayoutItem>(
    `/api/playout/items/${encodeURIComponent(id)}`,
    { method: "PATCH", body: data },
  );
}

/** Delete a playout item. */
export async function deletePlayoutItem(id: string): Promise<void> {
  await apiMutate(`/api/playout/items/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

/** Reorder playout items. */
export async function reorderPlayoutItems(
  orderedIds: string[],
): Promise<PlayoutItemListResponse> {
  return apiMutate<PlayoutItemListResponse>("/api/playout/items/reorder", {
    method: "PUT",
    body: { orderedIds } satisfies ReorderPlayoutItems,
  });
}

/** Fetch playout status (now-playing + queue state). Admin fast-poll endpoint. */
export async function fetchPlayoutStatus(): Promise<PlayoutStatus> {
  return apiGet<PlayoutStatus>("/api/playout/status");
}

/** Skip current track. */
export async function skipPlayoutTrack(): Promise<void> {
  await apiMutate("/api/playout/skip", { method: "POST" });
}

/** Queue a playout item to play next. */
export async function queuePlayoutItem(id: string): Promise<void> {
  await apiMutate(`/api/playout/queue/${encodeURIComponent(id)}`, {
    method: "POST",
  });
}
