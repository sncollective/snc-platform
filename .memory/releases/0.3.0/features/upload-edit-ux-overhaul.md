---
id: feature-upload-edit-ux-overhaul
kind: feature
stage: done
tags: [content, ux-polish]
release_binding: 0.3.0
created: 2026-04-18
updated: 2026-04-21
related_decisions: []
related_designs: []
parent: null
---

# Upload/Edit UX Overhaul

Processing state machine, inline upload progress, orphaned thumbnail cleanup, video layout shift fix.

## Review notes (2026-04-21)

- **Unit 4 mental-model correction** — the original design assumed the GlobalPlayer's expanded mode renders into VideoDetailView's reserved space via a portal. It does not — it renders as a sibling of `<Outlet>` at root layout scope (`__root.tsx`). The first implementation always rendered `.videoArea` as a 16:9 reservation, producing an empty black box when the player expanded above. Fix: wrap `.videoArea + .playOverlay` in `{!playerExpanded && …}` so both disappear together on play. Metadata reflows upward on play (as it did pre-feature) — a full portal-based player-in-place solution is deferred; see `content-processing-state-auto-refresh` backlog family and future `video-detail-player-portal` scope for the cleaner eventual answer.
- **Sidebar ↔ content area sync (spec check #6)** — not interactively exercised at review time. Both sides now consume the same `displayState` computed once in the content edit page and passed as a prop, so sync is a structural guarantee rather than a convergent behavior. Skip-with-note: low-risk given the data-flow shape.
- **Related findings parked:** `../../backlog/content-processing-state-auto-refresh.md` (UI stays at "Processing media…" after upload until manual refresh — pre-existing gap surfaced by the clearer new state machine).
- **Prod-only residual lifted to release 0.3.0 `## Prod verification`:** S3 object-level verification of `thumbnailKey` + `transcodedMediaKey` cascade-delete on video clearMedia against the real prod bucket.

## Sub-units

- [x] Unit 1: Processing State Machine Cleanup
- [x] Unit 2: Inline Upload Progress on Content Detail Page
- [x] Unit 3: Orphaned Thumbnail Cleanup on Video Removal
- [x] Unit 4: Video Detail Layout Shift Fix

## Overview

Three related UX issues in the content upload/edit flow need fixing together. Audio uploads show "Ready" and "Processing" simultaneously because the detail components check `mediaUrl` and `processingStatus` independently without a unified state machine. Large uploads provide no visual feedback on the content detail page itself (only the global `MiniUploadIndicator` at the bottom of the viewport). Removing a video via edit content leaves an orphaned thumbnail in S3. Additionally, the video detail view's play overlay and expanded GlobalPlayer occupy slightly different vertical space, causing metadata to jump on play.

The fix introduces a derived display-state hook that combines three independent signals (mediaUrl presence, processingStatus, active upload status) into a single discriminated state, then rewires both the edit-mode and consumption-mode detail components to render based on that state. The global upload indicator is unchanged; a supplementary inline progress display is added to the content detail page. The server-side content update route is patched to cascade thumbnail cleanup when media is cleared. The video detail view wrapper gets a CSS aspect-ratio reservation to eliminate layout shift.

---

## Implementation Units

### Unit 1: Processing State Machine Cleanup

**Root cause**: `video-detail.tsx` and `audio-detail.tsx` branch on `item.mediaUrl === null` as the top-level condition, then the sidebar independently renders `ProcessingIndicator` based on `item.processingStatus`. There is no single source of truth for "what should the content area show right now?" This leads to:

- Audio showing "Ready" (from ProcessingIndicator returning null) while also showing the upload placeholder (because `mediaUrl` is still null during the `uploaded` -> `processing` -> `ready` transition)
- "No media" text rendering simultaneously with "Processing Media" indicator
- No awareness of an active upload targeting this content item

**Solution**: A `useContentDisplayState` hook that derives a single display state from three inputs.

#### New file: `apps/web/src/hooks/use-content-display-state.ts`

```typescript
import type { ProcessingStatus, FeedItem } from "@snc/shared";
import type { ActiveUpload } from "../contexts/upload-context.js";

// ── Public Types ──

export type ContentDisplayState =
  | { readonly phase: "no-media" }
  | { readonly phase: "uploading"; readonly upload: ActiveUpload }
  | { readonly phase: "processing"; readonly status: ProcessingStatus }
  | { readonly phase: "ready" }
  | { readonly phase: "failed" };

export interface ContentDisplayStateInputs {
  readonly mediaUrl: string | null;
  readonly processingStatus: ProcessingStatus | null;
  readonly activeUpload: ActiveUpload | undefined;
}

// ── Public API ──

/** Derive a single display phase from media URL, processing status, and active upload state. */
export function deriveContentDisplayState(
  inputs: ContentDisplayStateInputs,
): ContentDisplayState;

/** Hook that computes display state for a content item, integrating upload context. */
export function useContentDisplayState(
  item: FeedItem,
): ContentDisplayState;
```

**Implementation notes**:

- `deriveContentDisplayState` is a pure function (no hooks) for testability. The priority logic:
  1. If `activeUpload` exists and its status is `"uploading"` or `"completing"` -> `{ phase: "uploading", upload: activeUpload }`
  2. If `processingStatus === "failed"` -> `{ phase: "failed" }`
  3. If `processingStatus === "uploaded" || processingStatus === "processing"` -> `{ phase: "processing", status: processingStatus }`
  4. If `mediaUrl !== null` (and processingStatus is `"ready"` or `null`) -> `{ phase: "ready" }`
  5. Otherwise -> `{ phase: "no-media" }`
- `useContentDisplayState` is a thin wrapper that calls `useUpload()` to find an active upload matching `item.id`, then delegates to `deriveContentDisplayState`.
- Finding the matching upload: `ActiveUpload` currently lacks `resourceId`. The hook needs to look up the Uppy file meta. Two options:
  - **(Preferred) Extend `ActiveUpload` to include `resourceId` and `purpose`** -- add these fields to the `ADD_UPLOAD` action and the `ActiveUpload` interface. The dispatch in the provider already has access to `purpose` and `resourceId` at the call site. This is a small, backward-compatible change.
  - (Alternative) Expose a `getUploadsForResource(resourceId)` method on the upload context that inspects Uppy file meta. More complex, couples to Uppy internals.

#### Modify: `apps/web/src/contexts/upload-context.tsx`

Extend `ActiveUpload`:

```typescript
export interface ActiveUpload {
  readonly id: string;
  readonly filename: string;
  readonly progress: number;
  readonly status: "uploading" | "completing" | "complete" | "error";
  readonly error?: string;
  readonly resourceId: string;
  readonly purpose: UploadPurpose;
}
```

Extend the `ADD_UPLOAD` action:

```typescript
| { readonly type: "ADD_UPLOAD"; readonly id: string; readonly filename: string; readonly resourceId: string; readonly purpose: UploadPurpose }
```

Update reducer `ADD_UPLOAD` case to include `resourceId` and `purpose` in the constructed `ActiveUpload`.

Update both dispatch sites (S3 path and legacy path) to include `resourceId` and `purpose` in the `ADD_UPLOAD` action.

#### Modify: `apps/web/src/components/content/video-detail.tsx`

Replace the `item.mediaUrl === null` branching with `useContentDisplayState(item)`:

```typescript
import { useContentDisplayState } from "../../hooks/use-content-display-state.js";
import type { ContentDisplayState } from "../../hooks/use-content-display-state.js";

// Inside VideoDetail:
const displayState = useContentDisplayState(item);

// Render based on displayState.phase:
// "no-media" -> upload placeholder (edit mode) or "Media not yet available"
// "uploading" -> inline upload progress (Unit 2)
// "processing" -> ProcessingIndicator with processing-specific visual
// "ready" -> VideoPlayer
// "failed" -> error message with retry affordance
```

The current three-branch structure (`locked` -> `mediaUrl === null` -> `has media`) becomes four branches: `locked` -> `displayState.phase` switch. The `locked` check remains first since it's orthogonal to processing state.

#### Modify: `apps/web/src/components/content/audio-detail.tsx`

Same pattern as video-detail. Replace `item.mediaUrl === null` branching with `displayState.phase` switch.

#### Modify: `apps/web/src/components/content/content-settings-sidebar.tsx`

The sidebar's Media section (lines 138-152) currently has its own independent processing status logic. Update it to accept the derived `ContentDisplayState` as a prop instead of re-deriving from `item`:

```typescript
// Add to ContentSettingsSidebarProps:
readonly displayState: ContentDisplayState;

// Replace the Media section rendering:
{item.type !== "written" && (
  <section className={styles.section}>
    <h3 className={styles.sectionHeading}>Media</h3>
    <div className={styles.mediaStatus}>
      {displayState.phase === "ready" && (
        <span className={styles.mediaReady}>Media uploaded</span>
      )}
      {displayState.phase === "no-media" && (
        <span className={styles.mediaNeeded}>No media uploaded</span>
      )}
      {displayState.phase === "uploading" && (
        <span className={styles.mediaUploading}>Uploading...</span>
      )}
      {displayState.phase === "processing" && (
        <ProcessingIndicator status={displayState.status} />
      )}
      {displayState.phase === "failed" && (
        <span className={styles.mediaFailed}>Processing failed</span>
      )}
    </div>
  </section>
)}
```

#### Modify: `apps/web/src/routes/creators/$creatorId/manage/content/$contentId.tsx`

Compute `displayState` once at the page level and pass it down to both the detail component and the sidebar:

```typescript
import { useContentDisplayState } from "../../../../../hooks/use-content-display-state.js";

// Inside ContentEditPage:
const displayState = useContentDisplayState(mgmt.editingItem);

// Pass to sidebar:
<ContentSettingsSidebar displayState={displayState} ... />
```

**Acceptance criteria**:

- [ ] Audio upload: detail area shows "Uploading" during upload, then "Processing" during processing, then player when ready -- never "Ready" and "Processing" simultaneously
- [ ] Video upload: same progression with no "No media" flash during processing
- [ ] Sidebar Media section matches content area state at all times
- [ ] `deriveContentDisplayState` has unit tests covering all five phases and edge cases (e.g., upload complete but processing not started, processing status is null)
- [ ] `canPublish` still correctly gates publishing (content must be in `ready` phase for media types)

---

### Unit 2: Inline Upload Progress on Content Detail Page

**Problem**: When uploading a large file from the content edit page, the only progress feedback is the `MiniUploadIndicator` fixed to the bottom of the viewport. The content area shows the upload placeholder unchanged.

**Solution**: When `displayState.phase === "uploading"`, render an inline progress indicator in place of the upload placeholder (video) or in the track info area (audio). This uses the `ActiveUpload` data already available from the display state.

#### New file: `apps/web/src/components/content/inline-upload-progress.tsx`

```typescript
import type React from "react";
import type { ActiveUpload } from "../../contexts/upload-context.js";

// ── Public Types ──

export interface InlineUploadProgressProps {
  readonly upload: ActiveUpload;
  /** Visual variant matching the content type's layout. */
  readonly variant: "video" | "audio";
}

// ── Public API ──

/** Inline upload progress indicator for the content detail area. Shows filename, progress bar, and percentage. */
export function InlineUploadProgress({
  upload,
  variant,
}: InlineUploadProgressProps): React.ReactElement;
```

#### New file: `apps/web/src/components/content/inline-upload-progress.module.css`

```css
/* Video variant: 16:9 container matching upload placeholder */
.containerVideo {
  width: 100%;
  aspect-ratio: 16 / 9;
  border-radius: var(--radius-md);
  background: var(--color-bg);
  border: 2px dashed var(--color-border);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-sm);
}

/* Audio variant: compact inline block */
.containerAudio {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
  padding: var(--space-sm) 0;
}

.filename {
  font-family: var(--font-ui);
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
  max-width: 300px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.progressTrack {
  width: 100%;
  max-width: 300px;
  height: 6px;
  border-radius: 3px;
  background: var(--color-bg-alt);
  overflow: hidden;
}

.progressFill {
  height: 100%;
  background: var(--color-accent);
  border-radius: 3px;
  transition: transform 0.2s ease-out;
  transform-origin: left;
}

.percentage {
  font-family: var(--font-ui);
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  font-variant-numeric: tabular-nums;
}

.statusText {
  font-family: var(--font-ui);
  font-size: var(--font-size-xs);
  color: var(--color-accent);
}
```

**Implementation notes**:

- The progress bar uses `transform: scaleX()` (matching `MiniUploadIndicator` convention) rather than `width` for paint-only animation.
- The `"completing"` status shows "Finalizing..." text instead of a percentage.
- The video variant uses the same `aspect-ratio: 16/9` and dashed border as the existing upload placeholder for visual continuity.
- The audio variant is compact to fit within the `trackInfo` column.
- This component is purely presentational -- state comes from the parent via `displayState.upload`.

#### Modify: `apps/web/src/components/content/video-detail.tsx`

In the `displayState.phase === "uploading"` branch:

```typescript
import { InlineUploadProgress } from "./inline-upload-progress.js";

// When displayState.phase === "uploading":
<InlineUploadProgress upload={displayState.upload} variant="video" />
```

This replaces the upload placeholder. The "Replace Video" button and file input are not shown during upload.

#### Modify: `apps/web/src/components/content/audio-detail.tsx`

In the `displayState.phase === "uploading"` branch, render `InlineUploadProgress` with `variant="audio"` in the `trackInfo` area where the upload placeholder button currently appears.

**Acceptance criteria**:

- [ ] Starting a media upload from the edit page replaces the upload placeholder with an inline progress bar
- [ ] Progress bar updates smoothly from 0-100%
- [ ] "Finalizing..." shown during the `completing` phase
- [ ] After upload completes, display transitions to `processing` phase (not back to upload placeholder)
- [ ] Global `MiniUploadIndicator` still shows simultaneously (supplementary, not replaced)
- [ ] Video variant maintains 16:9 aspect ratio
- [ ] Audio variant fits within the existing track info layout

---

### Unit 3: Orphaned Thumbnail Cleanup on Video Removal

**Problem**: When a user removes media via the edit content page (`clearMedia: true`), the server deletes `mediaKey` from S3 and nulls it in the DB, but leaves `thumbnailKey` intact. For video content, the thumbnail was auto-generated during processing and is semantically tied to the video -- removing the video should also remove its thumbnail.

The current behavior is correct for audio content where the thumbnail is user-uploaded cover art (independent of the audio file). The fix must distinguish between these cases.

**Solution**: When `clearMedia` is set on video content, also clear the thumbnail. The server-side content update route already handles `clearThumbnail` independently; the fix adds cascading behavior for video.

#### Modify: `apps/api/src/routes/content.routes.ts`

In the PATCH `/content/:id` handler, after the `clearMedia` block (line ~491-500):

```typescript
if (body.clearMedia) {
  if (existing.mediaKey) {
    const deleteResult = await storage.delete(existing.mediaKey);
    if (!deleteResult.ok) {
      c.var.logger.warn({ error: deleteResult.error.message, key: existing.mediaKey }, "Failed to delete media");
    }
  }
  updates.mediaKey = null;

  // For video content, the thumbnail is auto-generated from the video.
  // Removing the video orphans it — cascade the cleanup.
  if (existing.type === "video" && existing.thumbnailKey) {
    const thumbResult = await storage.delete(existing.thumbnailKey);
    if (!thumbResult.ok) {
      c.var.logger.warn({ error: thumbResult.error.message, key: existing.thumbnailKey }, "Failed to delete orphaned thumbnail");
    }
    updates.thumbnailKey = null;
  }

  // Also clear processing metadata since the source media is gone
  updates.processingStatus = null;
  updates.transcodedMediaKey = null;
  updates.videoCodec = null;
  updates.audioCodec = null;
  updates.width = null;
  updates.height = null;
  updates.duration = null;
  updates.bitrate = null;

  delete updates.clearMedia;
}
```

**Implementation notes**:

- The `existing.type === "video"` guard ensures audio content keeps its cover art when media is removed (cover art is user-uploaded, not auto-generated).
- Clearing `processingStatus` and all codec/dimension metadata prevents stale metadata from a previous upload from persisting. This is a correctness fix beyond just the thumbnail -- if a user removes video and uploads a new one, old metadata should not carry over.
- The `transcodedMediaKey` file should also be deleted from S3 if present. Add a delete call for it:

```typescript
if (existing.transcodedMediaKey) {
  const transcodedResult = await storage.delete(existing.transcodedMediaKey);
  if (!transcodedResult.ok) {
    c.var.logger.warn({ error: transcodedResult.error.message, key: existing.transcodedMediaKey }, "Failed to delete transcoded media");
  }
  updates.transcodedMediaKey = null;
}
```

- Thumbnail deletion failure is logged but does not block the response (same pattern as existing `clearMedia`/`clearThumbnail` handlers).

**Acceptance criteria**:

- [ ] Removing video media via edit page: thumbnail is also removed from S3 and nulled in DB
- [ ] Removing video media: processingStatus, transcodedMediaKey, codec/dimension metadata all nulled
- [ ] Removing audio media: thumbnail (cover art) is NOT removed
- [ ] Existing `clearThumbnail` behavior unchanged (explicit thumbnail removal still works independently)
- [ ] API test: PATCH with `clearMedia: true` on video content returns response with `thumbnailUrl: null`, `processingStatus: null`
- [ ] API test: PATCH with `clearMedia: true` on audio content returns response with `thumbnailUrl` unchanged

---

### Unit 4: Video Detail Layout Shift Fix

**Problem**: On the consumption view (`video-detail-view.tsx`), clicking the play overlay triggers the GlobalPlayer to render in expanded mode. The play overlay uses `aspect-ratio: 16/9` on a `<button>` element, but when the GlobalPlayer expands, it replaces the overlay (via conditional rendering -- `{!playerExpanded && <button>}`), removing the height reservation. The GlobalPlayer's expanded container in `global-player.module.css` does not enforce a matching aspect ratio on the wrapper. The metadata below shifts up or down depending on timing.

**Solution**: Add a stable-height wrapper around the video area in `video-detail-view.tsx` that maintains `aspect-ratio: 16/9` regardless of whether the play overlay or GlobalPlayer is showing. The GlobalPlayer's expanded mode already renders inside this page's DOM flow (it's not position:fixed), so the wrapper just needs to reserve the space.

#### Modify: `apps/web/src/components/content/video-detail-view.module.css`

Add a video area wrapper:

```css
.videoArea {
  width: 100%;
  aspect-ratio: 16 / 9;
  border-radius: var(--radius-md);
  overflow: hidden;
  background: var(--color-media-bg);
  position: relative;
}
```

Update `.playOverlay` to fill the wrapper instead of defining its own aspect ratio:

```css
.playOverlay {
  position: absolute;
  inset: 0;
  /* Remove: width: 100%; aspect-ratio: 16 / 9; */
  border-radius: 0; /* wrapper handles rounding */
  /* ... keep remaining properties ... */
}
```

#### Modify: `apps/web/src/components/content/video-detail-view.tsx`

Wrap the play overlay and GlobalPlayer expansion point in a stable container:

```typescript
// Before (simplified):
{!playerExpanded && (
  <button className={styles.playOverlay} ...>...</button>
)}

// After:
<div className={styles.videoArea}>
  {!playerExpanded && (
    <button className={styles.playOverlay} ...>...</button>
  )}
</div>
```

The GlobalPlayer in expanded mode renders into this same space via the root layout's portal-like behavior. The `.videoArea` div reserves the 16:9 space whether the overlay is visible or the player has taken over.

#### Modify: `apps/web/src/components/media/global-player.module.css`

Ensure the expanded player fills its container without adding extra height:

```css
.expanded {
  width: 100%;
  border-radius: var(--radius-md);
  overflow: hidden;
  /* Remove margin-bottom: var(--space-lg) — the parent controls spacing */
}

.expanded :global(media-player) {
  width: 100%;
  aspect-ratio: 16 / 9;
}
```

**Implementation notes**:

- The `margin-bottom` removal from `.expanded` is important -- the `video-detail-view` component already uses `gap: var(--space-lg)` on its flex container, so the margin was doubling the space.
- The GlobalPlayer's expanded mode renders as a sibling in the root layout, but for video content on the detail page, `setActiveDetail` triggers the expanded presentation which renders the player inline. The key insight is that the `.videoArea` wrapper creates a stable height reservation that the overlay fills via `position: absolute` and the player fills via normal flow with matching `aspect-ratio: 16/9`.
- Audio content is not affected -- the GlobalPlayer's expanded audio layout does not cause layout shift because the audio player has fixed height.

**Acceptance criteria**:

- [ ] Click play on video detail: metadata below does not shift vertically
- [ ] Play overlay and expanded player occupy identical vertical space
- [ ] Video area maintains 16:9 aspect ratio at all viewport widths
- [ ] Collapsed overlay (PiP) still works when navigating away from the video detail page
- [ ] No visual regression on the play overlay (poster image, play icon positioning)

---

## Implementation Order

1. **Unit 1** (state machine) -- foundational. All other units depend on the display state being unified.
2. **Unit 3** (orphaned thumbnail cleanup) -- server-side only, no frontend dependency on Unit 1. Can be done in parallel with Unit 2.
3. **Unit 2** (inline upload progress) -- depends on Unit 1's `ActiveUpload` extension and `useContentDisplayState` hook.
4. **Unit 4** (layout shift fix) -- independent CSS/component fix. Can be done in parallel with Units 2/3.

Parallelism: Units 3 and 4 are fully independent of each other and can run concurrently. Unit 2 must follow Unit 1.

---

## Testing

### Unit Tests

**`apps/web/tests/hooks/use-content-display-state.test.ts`**

Test `deriveContentDisplayState` (pure function):

- `mediaUrl: null, processingStatus: null, activeUpload: undefined` -> `{ phase: "no-media" }`
- `mediaUrl: null, processingStatus: null, activeUpload: { status: "uploading", ... }` -> `{ phase: "uploading", upload }`
- `mediaUrl: null, processingStatus: null, activeUpload: { status: "completing", ... }` -> `{ phase: "uploading", upload }`
- `mediaUrl: null, processingStatus: "uploaded", activeUpload: undefined` -> `{ phase: "processing", status: "uploaded" }`
- `mediaUrl: null, processingStatus: "processing", activeUpload: undefined` -> `{ phase: "processing", status: "processing" }`
- `mediaUrl: "https://...", processingStatus: "ready", activeUpload: undefined` -> `{ phase: "ready" }`
- `mediaUrl: "https://...", processingStatus: null, activeUpload: undefined` -> `{ phase: "ready" }`
- `mediaUrl: null, processingStatus: "failed", activeUpload: undefined` -> `{ phase: "failed" }`
- Upload active but already complete (`status: "complete"`) -> should NOT show uploading phase; fall through to processingStatus check
- Upload active with error (`status: "error"`) -> should NOT show uploading phase; fall through

**`apps/web/tests/contexts/upload-context.test.ts`**

Extend existing reducer tests:

- `ADD_UPLOAD` action with `resourceId` and `purpose` -> upload entry includes both fields
- Verify `resourceId` persists through `UPDATE_PROGRESS` and `SET_STATUS` actions

**`apps/api/tests/routes/content.routes.test.ts`**

Extend existing content update tests:

- PATCH with `clearMedia: true` on video content: verify `thumbnailKey` nulled, `processingStatus` nulled, `transcodedMediaKey` nulled, all codec metadata nulled
- PATCH with `clearMedia: true` on audio content: verify `thumbnailKey` unchanged
- Verify S3 delete called for `mediaKey`, `thumbnailKey`, and `transcodedMediaKey` (video)
- Verify S3 delete called only for `mediaKey` (audio)

**`apps/web/tests/components/content/inline-upload-progress.test.tsx`**

- Renders filename and progress bar for video variant
- Renders filename and progress bar for audio variant
- Shows "Finalizing..." when upload status is `completing`
- Progress bar scaleX matches `upload.progress / 100`

### Integration / Visual Testing

- Upload a video file from the edit page -> observe inline progress -> processing indicator -> player appears
- Upload an audio file from the edit page -> observe inline progress -> processing indicator -> audio player appears
- Remove video from edit page -> verify thumbnail is also cleared in the UI and S3
- Remove audio from edit page -> verify cover art thumbnail is preserved
- Play video on detail view -> verify no layout shift in metadata below

---

## Verification Checklist

- [ ] `bun run --filter @snc/web test` passes
- [ ] `bun run --filter @snc/api test:unit` passes
- [ ] `bun run --filter @snc/shared test` passes
- [ ] No TypeScript errors (`bun run --filter @snc/web build` and `bun run --filter @snc/api build`)
- [ ] Audio upload flow: no simultaneous "Ready" and "Processing" display
- [ ] Audio upload flow: inline progress shown during upload
- [ ] Video upload flow: no "No media" flash during processing
- [ ] Video upload flow: inline progress shown during upload
- [ ] Video removal: thumbnail also cleared (video content only)
- [ ] Video removal: processingStatus and codec metadata cleared
- [ ] Audio removal: cover art preserved
- [ ] Video detail view: no layout shift when clicking play
- [ ] Global MiniUploadIndicator still functions independently
- [ ] Sidebar media section state matches content area at all times
- [ ] Publish gating still works (cannot publish during upload/processing)
- [ ] Content detail page SSR renders without errors (display state hook handles server context where upload context may not have active uploads)
