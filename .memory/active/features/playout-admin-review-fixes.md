---
id: feature-playout-admin-review-fixes
kind: feature
stage: done
tags: [admin-console, media-pipeline]
release_binding: 0.2.1
created: 2026-04-18
updated: 2026-04-18
related_decisions: []
related_designs: []
parent: null
---

# Playout Admin Review Fixes

## Sub-fixes (all done)

- [x] duration refresh polling
- [x] optional title for MKV auto-fill
- [x] inline file picker
- [x] channel creation UI
- [x] Play Next pool picker
- [x] search empty results fix

## Overview

Six fixes for the playout admin UI surfaced during acceptance testing on 2026-04-06. All affect `routes/admin/playout.tsx` and related components/services.

**Findings:**
1. Content pool duration shows "-" until page refresh after ingest
2. Metadata auto-fill unreachable — title required before upload
3. Create New form should show file picker inline (not as a separate step)
4. No UI to create a new playout channel
5. "Play Next" queue picker searches wrong data source
6. "Add Content" search returns no results for seeded content

---

## Implementation Units

### Unit 1: Content Pool Duration Refresh After Ingest

**Problem:** After uploading a file via the Create New form, the pool table shows "-" for duration. Only a full page refresh loads the updated duration from the server. The `onAdded` callback refetches pool data, but the ingest job (which extracts duration via `probeMedia`) hasn't completed yet at that point.

**Fix:** Add a polling mechanism that refetches pool data a few times after upload completes, catching the ingest result.

**Files:** `platform/apps/web/src/routes/admin/playout.tsx`, `platform/apps/web/src/components/admin/add-content-form.tsx`

```typescript
// Poll pool data 3 times at 2-second intervals to catch ingest completion
const handleUploadComplete = (): void => {
  let attempts = 0;
  const pollInterval = setInterval(() => {
    attempts++;
    if (!selectedChannelId || attempts > 3) {
      clearInterval(pollInterval);
      return;
    }
    fetchChannelContent(selectedChannelId)
      .then((data) => setPoolItems(data.items))
      .catch(() => {/* ignore transient failures */});
  }, 2000);
};
```

**Acceptance Criteria:**
- [ ] After uploading a file via Create New, duration updates within ~6 seconds without manual refresh
- [ ] Polling stops after 3 attempts
- [ ] No memory leaks (interval cleaned up on unmount or channel change)

---

### Unit 2: Metadata Auto-Fill — Optional Title

**Problem:** Title is required in the Create New form, so the user fills it before uploading. MKV tag auto-fill can never fill a null title.

**Fix:** Make title optional in the form. API accepts `title: z.string().nullable().optional().default(null)`. Ingest auto-fill populates `null` title from probe tags.

**Acceptance Criteria:**
- [ ] Title field in Create New form is optional (no `required` attribute)
- [ ] Submitting with blank title creates an item with `title: null` in the database
- [ ] After uploading an MKV with title tags, ingest auto-fill populates the title
- [ ] Submitting with a user-provided title preserves it

---

### Unit 3: Inline File Picker in Create New Form

**Problem:** Current flow is two steps: (1) fill metadata, submit, (2) then a file picker appears. User expects to see the file picker from the start.

**Fix:** Show the file picker alongside the metadata fields from the start. Unified `handleSubmit` does both steps sequentially: create item + assign to pool, then start upload if file selected.

**Files:** `platform/apps/web/src/components/admin/add-content-form.tsx`

**Acceptance Criteria:**
- [ ] Single form with title, year, director, AND file picker visible simultaneously
- [ ] Submitting with a file creates the item, assigns to pool, and starts upload in one action
- [ ] Submitting without a file creates the item and assigns to pool (no upload)
- [ ] File name displayed after selection
- [ ] Error handling preserved for both create and upload failures

---

### Unit 4: Channel Creation UI

**Problem:** No UI to create a new playout channel.

**Files:** `platform/apps/api/src/routes/playout-channels.routes.ts`, `platform/apps/web/src/lib/playout-channels.ts`, `platform/apps/web/src/routes/admin/playout.tsx`

Add `POST /api/playout/channels` endpoint. Add "+ New Channel" button with inline form in admin playout page.

**Acceptance Criteria:**
- [ ] "+ New Channel" button appears in the admin playout page
- [ ] Clicking opens an inline form with a name field
- [ ] Submitting creates a channel via API
- [ ] New channel appears in the tab list after page reload
- [ ] Error handling for duplicate names

---

### Unit 5: "Play Next" — Search Pool Items

**Problem:** "Play Next" uses `ContentSearchPicker` which searches for items NOT in the pool. It should search items that ARE in the pool (playout-source items only).

**Fix:** Replace the `ContentSearchPicker` for "Play Next" with a new `PoolItemPicker` component that filters the already-loaded `poolItems` state. No new API endpoint needed.

**Files:** `platform/apps/web/src/routes/admin/playout.tsx` (modify), `platform/apps/web/src/components/admin/pool-item-picker.tsx` (new)

```tsx
{showSearchPicker === "queue" && (
  <PoolItemPicker
    poolItems={poolItems}
    onSelect={(item) => void handlePlayNext(item)}
    onClose={() => setShowSearchPicker(null)}
  />
)}
```

**Acceptance Criteria:**
- [ ] "Play Next" shows pool items (playout-source only), not available-content search
- [ ] Filtering works by title
- [ ] Selecting an item queues it at position 1
- [ ] Empty state message when no playout items in pool
- [ ] Dismiss on click outside or Escape

---

### Unit 6: "Add Content" Search — Fix Empty Results for Seeded Content

**Problem:** `searchAvailableContent` SQL requires `c.processing_status = 'completed'` for creator content. Seeded content has `processing_status = NULL`. Items with null processing status are valid published content.

**Fix:** Update the search query to include content where `processing_status` is null OR `'completed'`.

**File:** `platform/apps/api/src/services/playout-orchestrator.ts`

```sql
-- Change:
-- AND c.processing_status = 'completed'
-- To:
AND (c.processing_status = 'completed' OR c.processing_status IS NULL)
```

**Acceptance Criteria:**
- [ ] Searching in the Add Content picker returns seeded video content
- [ ] Content with `processing_status = NULL` appears in search results
- [ ] Content with `processing_status = 'pending'` or `'failed'` still excluded
- [ ] Content with `processing_status = 'completed'` still included

---

## Implementation Order

1. **Unit 6** — Fix search query (unblocks testing of Add Content)
2. **Unit 5** — Play Next pool picker (unblocks queue testing)
3. **Unit 4** — Channel creation UI (independent)
4. **Units 2 + 3** — Title optional + inline file picker (combined form refactor)
5. **Unit 1** — Duration refresh polling (depends on Unit 3 form changes)

## Testing

```bash
bun run --filter @snc/api test:unit
bun run --filter @snc/web test
bun run --filter @snc/web build
pm2 restart all
```

Manual:
1. Add Content search: search for "Studio" or "Live" → returns seeded creator videos
2. Play Next: add a playout item to pool, click "+ Play Next" → shows pool item, selecting queues it
3. Channel creation: click "+ New Channel", enter name, submit → appears after reload
4. Inline form + optional title: leave title blank, pick a file, submit → item created, title auto-fills from tags after ingest
5. Duration refresh: after uploading, watch pool table → duration updates within ~6 seconds
