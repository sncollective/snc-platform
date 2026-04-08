import type {
  ChannelQueueStatus,
  ChannelContent,
  PlayoutQueueEntry,
  PoolCandidate,
} from "@snc/shared";

import { apiGet, apiMutate } from "./fetch-utils.js";

/** Fetch queue status for a playout channel. */
export const fetchChannelQueue = (
  channelId: string,
  signal?: AbortSignal,
): Promise<ChannelQueueStatus> =>
  apiGet<ChannelQueueStatus>(
    `/api/playout/channels/${channelId}/queue`,
    undefined,
    signal,
  );

/** Insert an item into a channel's queue at an optional position. */
export const insertQueueItem = (
  channelId: string,
  playoutItemId: string,
  position?: number,
): Promise<PlayoutQueueEntry> =>
  apiMutate<PlayoutQueueEntry>(
    `/api/playout/channels/${channelId}/queue/items`,
    { method: "POST", body: { playoutItemId, position } },
  );

/** Remove an item from a channel's queue by entry ID. */
export const removeQueueItem = (
  channelId: string,
  entryId: string,
): Promise<void> =>
  apiMutate<void>(
    `/api/playout/channels/${channelId}/queue/items/${entryId}`,
    { method: "DELETE" },
  );

/** Skip the current track on a channel. */
export const skipChannelTrack = (channelId: string): Promise<void> =>
  apiMutate<void>(`/api/playout/channels/${channelId}/skip`, {
    method: "POST",
  });

/** Fetch the content pool for a channel. */
export const fetchChannelContent = (
  channelId: string,
  signal?: AbortSignal,
): Promise<{ items: ChannelContent[] }> =>
  apiGet<{ items: ChannelContent[] }>(
    `/api/playout/channels/${channelId}/content`,
    undefined,
    signal,
  );

/** Search for items available to add to a channel's pool. */
export const searchAvailableContent = (
  channelId: string,
  query: string,
  signal?: AbortSignal,
): Promise<{ items: PoolCandidate[] }> =>
  apiGet<{ items: PoolCandidate[] }>(
    `/api/playout/channels/${channelId}/content/search`,
    { q: query },
    signal,
  );

/** Assign playout items or creator content to a channel's pool. */
export const assignChannelContent = (
  channelId: string,
  playoutItemIds?: string[],
  contentIds?: string[],
): Promise<void> =>
  apiMutate<void>(`/api/playout/channels/${channelId}/content`, {
    method: "POST",
    body: { playoutItemIds, contentIds },
  });

/** Create a new playout channel with the given name. */
export const createChannel = (name: string): Promise<{ channelId: string; engineRestarting: boolean; engineReady: boolean }> =>
  apiMutate<{ channelId: string; engineRestarting: boolean; engineReady: boolean }>("/api/playout/channels", {
    method: "POST",
    body: { name },
  });

/** Deactivate a playout channel by ID. */
export const deleteChannel = (channelId: string): Promise<{ ok: boolean; engineRestarting: boolean; engineReady: boolean }> =>
  apiMutate<{ ok: boolean; engineRestarting: boolean; engineReady: boolean }>(
    `/api/playout/channels/${channelId}`,
    { method: "DELETE" },
  );

/** Remove playout items or creator content from a channel's pool. */
export const removeChannelContent = (
  channelId: string,
  playoutItemIds?: string[],
  contentIds?: string[],
): Promise<void> =>
  apiMutate<void>(`/api/playout/channels/${channelId}/content`, {
    method: "DELETE",
    body: { playoutItemIds, contentIds },
  });
