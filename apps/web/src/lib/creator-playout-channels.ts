import type {
  ChannelQueueStatus,
  ChannelContent,
  PlayoutQueueEntry,
  PoolCandidate,
} from "@snc/shared";

import { apiGet, apiMutate } from "./fetch-utils.js";

// Creator-scoped editorial fetchers. Identical signatures to the admin
// `playout-channels.ts` data layer (same shapes, same query/body contracts) — the
// only difference is the base path: these hit `/api/creator/playout/channels/*`
// (gated by `requireCreatorChannelPermission("manageStreaming")`), so a creator
// drives their own channel without touching the admin `/api/playout/*` routes.
// Channel CRUD (create/delete) is intentionally absent — that is admin-only.

/** Fetch queue status for a creator-owned playout channel. */
export const fetchChannelQueue = (
  channelId: string,
  signal?: AbortSignal,
): Promise<ChannelQueueStatus> =>
  apiGet<ChannelQueueStatus>(
    `/api/creator/playout/channels/${channelId}/queue`,
    undefined,
    signal,
  );

/** Insert an item into a creator channel's queue at an optional position. */
export const insertQueueItem = (
  channelId: string,
  playoutItemId: string,
  position?: number,
): Promise<PlayoutQueueEntry> =>
  apiMutate<PlayoutQueueEntry>(
    `/api/creator/playout/channels/${channelId}/queue/items`,
    { method: "POST", body: { playoutItemId, position } },
  );

/** Remove an item from a creator channel's queue by entry ID. */
export const removeQueueItem = (
  channelId: string,
  entryId: string,
): Promise<void> =>
  apiMutate<void>(
    `/api/creator/playout/channels/${channelId}/queue/items/${entryId}`,
    { method: "DELETE" },
  );

/** Skip the current track on a creator channel. */
export const skipChannelTrack = (channelId: string): Promise<void> =>
  apiMutate<void>(`/api/creator/playout/channels/${channelId}/skip`, {
    method: "POST",
  });

/** Fetch the content pool for a creator channel. */
export const fetchChannelContent = (
  channelId: string,
  signal?: AbortSignal,
): Promise<{ items: ChannelContent[] }> =>
  apiGet<{ items: ChannelContent[] }>(
    `/api/creator/playout/channels/${channelId}/content`,
    undefined,
    signal,
  );

/** Search for items available to add to a creator channel's pool. */
export const searchAvailableContent = (
  channelId: string,
  query: string,
  signal?: AbortSignal,
): Promise<{ items: PoolCandidate[] }> =>
  apiGet<{ items: PoolCandidate[] }>(
    `/api/creator/playout/channels/${channelId}/content/search`,
    { q: query },
    signal,
  );

/** Assign playout items or creator content to a creator channel's pool. */
export const assignChannelContent = (
  channelId: string,
  playoutItemIds?: string[],
  contentIds?: string[],
): Promise<void> =>
  apiMutate<void>(`/api/creator/playout/channels/${channelId}/content`, {
    method: "POST",
    body: { playoutItemIds, contentIds },
  });

/** Remove playout items or creator content from a creator channel's pool. */
export const removeChannelContent = (
  channelId: string,
  playoutItemIds?: string[],
  contentIds?: string[],
): Promise<void> =>
  apiMutate<void>(`/api/creator/playout/channels/${channelId}/content`, {
    method: "DELETE",
    body: { playoutItemIds, contentIds },
  });
