import { createContext, useContext } from "react";
import type React from "react";
import type {
  ChannelContent,
  ChannelQueueStatus,
  PlayoutQueueEntry,
  PoolCandidate,
} from "@snc/shared";

import * as adminChannels from "../../lib/playout-channels.js";
import * as creatorChannels from "../../lib/creator-playout-channels.js";

// ── Contract ──

/**
 * The injectable editorial data layer for `<EditorialSurface>` and its child pickers.
 *
 * The surface is presentational over a channel's playout API; the *mount* owns which
 * scope those calls target. The admin mount injects the admin `playout-channels.ts`
 * functions (`/api/playout/*`); the creator mount injects the creator
 * `creator-playout-channels.ts` functions (`/api/creator/playout/*`). One surface,
 * two mounts, no admin-endpoint footgun in the creator path.
 *
 * The eight functions are exactly those the surface and its pickers
 * (`ContentSearchPicker`, `AddContentForm`) call — both libs satisfy this interface.
 */
export interface EditorialApi {
  readonly fetchChannelQueue: (
    channelId: string,
    signal?: AbortSignal,
  ) => Promise<ChannelQueueStatus>;
  readonly fetchChannelContent: (
    channelId: string,
    signal?: AbortSignal,
  ) => Promise<{ items: ChannelContent[] }>;
  readonly searchAvailableContent: (
    channelId: string,
    query: string,
    signal?: AbortSignal,
  ) => Promise<{ items: PoolCandidate[] }>;
  readonly skipChannelTrack: (channelId: string) => Promise<void>;
  readonly insertQueueItem: (
    channelId: string,
    playoutItemId: string,
    position?: number,
  ) => Promise<PlayoutQueueEntry>;
  readonly removeQueueItem: (channelId: string, entryId: string) => Promise<void>;
  readonly assignChannelContent: (
    channelId: string,
    playoutItemIds?: string[],
    contentIds?: string[],
  ) => Promise<void>;
  readonly removeChannelContent: (
    channelId: string,
    playoutItemIds?: string[],
    contentIds?: string[],
  ) => Promise<void>;
}

// ── Bundles ──

/** Admin editorial data layer — `/api/playout/*` (the admin playout mount injects this). */
export const ADMIN_EDITORIAL_API: EditorialApi = {
  fetchChannelQueue: adminChannels.fetchChannelQueue,
  fetchChannelContent: adminChannels.fetchChannelContent,
  searchAvailableContent: adminChannels.searchAvailableContent,
  skipChannelTrack: adminChannels.skipChannelTrack,
  insertQueueItem: adminChannels.insertQueueItem,
  removeQueueItem: adminChannels.removeQueueItem,
  assignChannelContent: adminChannels.assignChannelContent,
  removeChannelContent: adminChannels.removeChannelContent,
};

/** Creator editorial data layer — `/api/creator/playout/*` (the creator mount injects this). */
export const CREATOR_EDITORIAL_API: EditorialApi = {
  fetchChannelQueue: creatorChannels.fetchChannelQueue,
  fetchChannelContent: creatorChannels.fetchChannelContent,
  searchAvailableContent: creatorChannels.searchAvailableContent,
  skipChannelTrack: creatorChannels.skipChannelTrack,
  insertQueueItem: creatorChannels.insertQueueItem,
  removeQueueItem: creatorChannels.removeQueueItem,
  assignChannelContent: creatorChannels.assignChannelContent,
  removeChannelContent: creatorChannels.removeChannelContent,
};

// ── Context ──

// Default is the admin bundle. This is the admin module the isolated component tests
// already mock at module scope (so they render the surface bare and assert on the
// mock); it is NOT a per-mount fallback — both production mounts wrap
// `<EditorialApiProvider>` explicitly, so neither relies on this default. A new mount
// that forgets the provider gets the admin scope, which the admin route's `requireRole`
// gate then 403s for non-admins — the footgun the creator mount avoids by injecting
// `CREATOR_EDITORIAL_API` explicitly.
const EditorialApiContext = createContext<EditorialApi>(ADMIN_EDITORIAL_API);

// ── Provider + Hook ──

/** Inject the editorial data layer for the wrapped `<EditorialSurface>` subtree. */
export function EditorialApiProvider({
  api,
  children,
}: {
  readonly api: EditorialApi;
  readonly children: React.ReactNode;
}): React.ReactElement {
  return (
    <EditorialApiContext.Provider value={api}>
      {children}
    </EditorialApiContext.Provider>
  );
}

/** Read the injected editorial data layer (admin bundle when no provider wraps). */
export function useEditorialApi(): EditorialApi {
  return useContext(EditorialApiContext);
}
