---
id: feature-playout-channel-architecture-phase3
kind: feature
stage: done
tags: [streaming, admin-console]
release_binding: 0.2.1
created: 2026-04-18
updated: 2026-04-18
related_decisions: []
related_designs: []
parent: playout-channel-architecture
---

# Playout Channel Architecture — Phase 3 (Admin UI)

> **Review outcome (2026-04-18):** verification-only pass, same pattern as Phase 2. Units 1-13 verified in code as already shipped: `contentId` column on `channel_content`, orchestrator's `assignContent` / `resolveContentUri` / `searchAvailableContent`, shared types (`sourceType`, `PoolCandidate`, `contentIds`), `/channels/:id/content/search` endpoint, web client `playout-channels.ts` exports, `useChannelQueue` polling hook, admin page rewrite with per-channel tabs + queue + content pool, all three new components (`content-search-picker`, `queue-item-row`, `content-pool-table`), `AddContentForm` rename, old `PUT /items/reorder` + `PUT /playlist` routes removed. User observed the full shipped UI live during this session (channel tabs, Now Playing + Skip, Queue with positions + estimated times + Remove, Content Pool with counts + search). One trivial gap — Unit 11 said "rename `AddFilmForm` → `AddContentForm`" but the old `add-film-form.tsx` was left orphaned alongside the new file; deleted as a fix-in-flight during this pass. Bound to 0.2.1.

## Overview

Phase 3 rebuilds the playout admin UI to use the Phase 1/2 backend. Replaces the old single-channel playlist-based UI with a multi-channel queue + content pool interface.

### What Phase 3 delivers:
- Channel tabs on `/admin/playout` — one tab per active playout channel
- Per-channel queue view — now playing, upcoming items, skip, play next, remove
- Per-channel content pool management — search/assign existing items (both playout items AND creator content), create new, remove
- New web client functions for Phase 1/2 API endpoints
- Schema migration: add `contentId` column to `channel_content` for creator content support

### What Phase 3 removes:
- Old playlist management UI (save/discard, drag-and-drop reorder, enable/disable)
- Old web client functions (`savePlaylist`, `reorderPlayoutItems`)
- Old components (`PlaylistItemRow` in its current form)

### Dependencies:
- Phase 1 (backend tables + orchestrator) — complete
- Phase 2 (Liquidsoap + real client + cleanup) — complete

## Implementation Units

### Unit 1: Schema Migration — Add `contentId` to `channel_content`

**File**: `platform/apps/api/src/db/schema/playout-queue.schema.ts`

Add a nullable `contentId` FK to the `channel_content` table, referencing `content.id`. This allows the pool to contain both playout items and creator content.

```typescript
contentId: text("content_id").references(() => content.id, { onDelete: "cascade" }),
```

Add unique index on `(channelId, contentId)`.

Each `channel_content` row has either `playoutItemId` OR `contentId` set, not both.

**Acceptance Criteria**:

- [ ] `contentId` column added as nullable FK to `content.id`
- [ ] `onDelete: "cascade"` on the FK
- [ ] Unique index on `(channelId, contentId)` added
- [ ] Migration generated and applied

---

### Unit 2: Update Orchestrator for Creator Content

**File**: `platform/apps/api/src/services/playout-orchestrator.ts`

Update `assignContent` to accept an optional `contentIds` array alongside `playoutItemIds`. Update `autoFill` and `pushPrefetchBuffer` to resolve media URIs from either source.

For creator content URI resolution: `transcodedMediaKey` (preferred) or `mediaKey`.

Auto-fill query: join both `playout_items` (status `ready`) and `content` (type `video`, status `completed`) from the pool.

**Acceptance Criteria**:

- [ ] `assignContent` handles both `playoutItemIds` and `contentIds`
- [ ] `autoFill` selects from both playout items and creator content in the pool
- [ ] `pushPrefetchBuffer` resolves URIs from either source
- [ ] `listContent` returns source type and metadata for display

---

### Unit 3: Update Shared Types for Content Pool

**File**: `platform/packages/shared/src/playout-queue.ts`

Update `ChannelContentSchema` to include `playoutItemId: nullable`, `contentId: nullable`, `sourceType: "playout" | "content"`, `title`, `duration`.

Add `PoolCandidateSchema` for search results (used by the content picker UI).

---

### Unit 4: Content Pool Search API Endpoint

`GET /channels/:channelId/content/search?q=searchTerm`

Returns `PoolCandidate[]` — items NOT already in the channel's pool. Both playout items (status `ready`) and creator content (type `video`, status `completed`). Case-insensitive title search, limited to 20 results.

---

### Unit 5: Web Client Library — Channel API Functions

**File**: `platform/apps/web/src/lib/playout-channels.ts` (new file)

Functions for all Phase 1/2 channel endpoints: `fetchChannelQueue`, `insertQueueItem`, `removeQueueItem`, `skipChannelTrack`, `fetchChannelContent`, `searchAvailableContent`, `assignChannelContent`, `removeChannelContent`, `createChannel`.

---

### Unit 6: Channel Queue Hook

`useChannelQueue(channelId: string | null)` — polls `/channels/:id/queue` every 3 seconds. Re-polls immediately when `channelId` changes. Cleans up on unmount.

---

### Unit 7: Rewrite Admin Playout Page

**File**: `platform/apps/web/src/routes/admin/playout.tsx`

New layout:
```
┌──────────────────────────────────────────────────┐
│ Playout                                          │
├──────────────────────────────────────────────────┤
│ BroadcastStatus (S/NC TV)                        │
├──────────────────────────────────────────────────┤
│ [Classics] [Music Videos] [...]  ← channel tabs  │
├──────────────────────────────────────────────────┤
│ Now Playing                       [Skip]         │
│ Queue                        [+ Play Next]       │
│   1. Track Title (est. 2:30)         [Remove]    │
│   2. Track Title (est. 5:00)         [Remove]    │
│ Content Pool (12 items)      [+ Add Content]     │
│   Title   Duration  Last Played  Plays [Remove]  │
└──────────────────────────────────────────────────┘
```

Route loader fetches active channels from `/api/streaming/status`. Channel tabs, per-channel queue view with skip/remove/play-next, content pool with search picker.

**Acceptance Criteria**:

- [ ] Channel tabs render for all active playout channels
- [ ] Tab switch updates queue view and content pool
- [ ] Now Playing shows current track with Skip button
- [ ] Queue shows upcoming items with estimated times and Remove buttons
- [ ] Content Pool shows all assigned items with metadata
- [ ] "Add Content" opens search picker
- [ ] "Play Next" inserts into queue at position 1

---

### Unit 8: Content Search Picker Component

**File**: `platform/apps/web/src/components/admin/content-search-picker.tsx` (new)

Modal/dropdown for searching and selecting content to add to a channel's pool or queue. Debounced search (300ms), abort previous request on new input, results from both playout items and creator content with source badge.

---

### Unit 9: Queue Item Row Component

**File**: `platform/apps/web/src/components/admin/queue-item-row.tsx` (new)

Renders: position, title, estimated start time (cumulative durations), remove button.

---

### Unit 10: Content Pool Table Component

**File**: `platform/apps/web/src/components/admin/content-pool-table.tsx` (new)

Table with columns: Title, Duration, Source Type, Last Played (relative), Play Count, Remove button.

---

### Unit 11: Update `AddFilmForm` → `AddContentForm`

Rename to `add-content-form.tsx`. After creating item + upload completes, automatically call `assignChannelContent(channelId, [item.id])` to add to the current channel's pool.

---

### Unit 12: CSS Module Updates

**File**: `platform/apps/web/src/routes/admin/playout.module.css`

Add styles for channel tabs, queue list, pool table, source badges, search picker overlay. Remove old playlist-specific styles.

---

### Unit 13: Remove Old Playout Routes and Client Functions

Remove `PUT /items/reorder` and `PUT /playlist` routes. Remove `savePlaylist` and `reorderPlayoutItems` web client functions.

---

## Implementation Order

1. **Unit 1**: Schema migration (`contentId` column)
2. **Unit 3**: Shared types update
3. **Unit 2**: Orchestrator update for creator content
4. **Unit 4**: Search API endpoint
5. **Unit 5**: Web client library
6. **Unit 13**: Remove old routes/client functions
7. **Unit 12**: CSS module updates
8. **Units 9, 10, 8**: Component files
9. **Unit 11**: Rename AddFilmForm → AddContentForm
10. **Unit 6**: Channel queue hook
11. **Unit 7**: Rewrite admin playout page

## Verification Checklist

```bash
bun --cwd=./platform run --filter @snc/api test
bun --cwd=./platform run --filter @snc/web test
bun --cwd=./platform run --filter @snc/shared build
pm2 restart all
# Manual: navigate to /admin/playout
# - Channel tabs visible
# - Queue shows current + upcoming
# - Content pool shows assigned items
# - Search picker finds playout items and creator content
# - Skip, Play Next, Remove operations work
```
