---
id: feature-playout-retry
kind: feature
stage: done
tags: [media-pipeline, streaming]
release_binding: 0.2.1
created: 2026-04-18
updated: 2026-04-18
related_decisions: []
related_designs: []
parent: null
---

# Playout Retry/Requeue Button

> **Note:** Button + wiring verified, couldn't trigger failed state to exercise full path.

## Overview

When a playout item's ingest job fails, its `processingStatus` is set to `"failed"` and it sits stuck with no manual recovery path from the admin UI. An admin must resort to direct database manipulation or re-upload to fix it.

This feature adds:

1. **API endpoint** `POST /api/playout/items/:id/retry` — resets status to `"pending"` and re-enqueues the pg-boss ingest job.
2. **Service function** `retryPlayoutIngest()` in `playout.ts` — guards against retrying non-failed items, resets DB status, sends the job.
3. **Client-side function** `retryPlayoutIngest()` in `lib/playout.ts` — thin wrapper over `apiMutate`.
4. **UI** — adds a "Retry" button in the Content Pool table for `sourceType === "playout"` items that are in `"failed"` status. Requires adding `processingStatus` to the `ChannelContent` shared type and the `listContent` SQL query.

No new shared type schemas are needed for the request body (the endpoint takes no body). One field is added to `ChannelContent`.

## Implementation Units

---

### Unit 1: Add `processingStatus` to `ChannelContent`

**File**: `platform/packages/shared/src/playout-queue.ts`

Add `processingStatus` to `ChannelContentSchema` so the UI can render per-item status without a second fetch.

```typescript
// In ChannelContentSchema, add after `sourceType`:
processingStatus: z.enum(PLAYOUT_PROCESSING_STATUSES).nullable(),
```

Import `PLAYOUT_PROCESSING_STATUSES` from `./playout.js`:

```typescript
import { PLAYOUT_PROCESSING_STATUSES } from "./playout.js";
```

The field is nullable because `sourceType === "content"` items come from the `content` table which has a different status schema — the API will pass `null` for those rows.

**Implementation Notes**:

- `PLAYOUT_PROCESSING_STATUSES` is the SSOT for status values; derive the Zod enum from it, do not re-enumerate.
- `ChannelContent` is exported from `@snc/shared` index — changing this schema is a breaking change to the shared contract. Both API and web must be updated together (they are in the same monorepo build).
- After this change, run `bun run --filter @snc/shared build` to confirm the shared package compiles before touching consumers.

**Acceptance Criteria**:

- [ ] `ChannelContent.processingStatus` is `PlayoutProcessingStatus | null`
- [ ] `z.enum(PLAYOUT_PROCESSING_STATUSES)` — derived from the SSOT constant, not a literal re-enumeration
- [ ] `@snc/shared` builds without errors

---

### Unit 2: Populate `processingStatus` in `listContent` query

**File**: `platform/apps/api/src/services/playout-orchestrator.ts`

Extend the `listContent` raw SQL query (around line 520) to select `pi.processing_status` for the playout branch and `null` for the content branch.

In the first SELECT (playout items):

```sql
pi.processing_status AS "processingStatus",
```

In the second SELECT (content items):

```sql
NULL AS "processingStatus",
```

Update the result type annotation and the mapping in the `rows.map(...)` call:

```typescript
// In the rows type annotation, add:
processingStatus: string | null;

// In rows.map(), add to the returned object:
processingStatus: (row.processingStatus as PlayoutProcessingStatus | null) ?? null,
```

Import `PlayoutProcessingStatus` from `@snc/shared` if not already present.

**Acceptance Criteria**:

- [ ] `listContent` result includes `processingStatus` for playout-source items
- [ ] `listContent` result has `null` for `processingStatus` on content-source items
- [ ] `@snc/api` builds without TypeScript errors

---

### Unit 3: `retryPlayoutIngest()` service function

**File**: `platform/apps/api/src/services/playout.ts`

Add a new exported function that:
1. Fetches the item and returns 404 if not found.
2. Returns a typed error if `processingStatus !== "failed"` — only failed items can be retried.
3. Resets `processingStatus` to `"pending"` in the DB.
4. Sends a new `PLAYOUT_INGEST` job via pg-boss.

```typescript
import { getBoss } from "../jobs/boss.js";
import { JOB_QUEUES } from "../jobs/register-workers.js";

/**
 * Reset a failed playout item to pending and re-enqueue the ingest job.
 * Guards against retrying items not in failed state.
 *
 * @throws Never — returns Result
 */
export const retryPlayoutIngest = async (
  id: string,
): Promise<Result<void, AppError>> => {
  const [row] = await db
    .select()
    .from(playoutItems)
    .where(eq(playoutItems.id, id));

  if (!row) return err(new NotFoundError("Playout item not found"));

  if (row.processingStatus !== "failed") {
    return err(
      new AppError(
        "INVALID_STATE",
        `Cannot retry item in state: ${row.processingStatus}`,
        409,
      ),
    );
  }

  if (!row.sourceKey) {
    return err(
      new AppError(
        "NO_SOURCE",
        "Item has no source file — upload a file before retrying",
        422,
      ),
    );
  }

  await db
    .update(playoutItems)
    .set({ processingStatus: "pending", updatedAt: new Date() })
    .where(eq(playoutItems.id, id));

  const boss = getBoss();
  if (boss) {
    await boss.send(JOB_QUEUES.PLAYOUT_INGEST, { playoutItemId: id });
  }

  return ok(undefined);
};
```

**Acceptance Criteria**:

- [ ] Returns `err(NotFoundError)` when item not found
- [ ] Returns `err(AppError("INVALID_STATE", ..., 409))` when `processingStatus !== "failed"`
- [ ] Returns `err(AppError("NO_SOURCE", ..., 422))` when item has no `sourceKey`
- [ ] Resets `processingStatus` to `"pending"` before sending the job
- [ ] Calls `boss.send(JOB_QUEUES.PLAYOUT_INGEST, { playoutItemId: id })`
- [ ] Returns `ok(undefined)` on success

---

### Unit 4: `POST /api/playout/items/:id/retry` route

**File**: `platform/apps/api/src/routes/playout.routes.ts`

Add a new route after the `DELETE /items/:id` block (around line 142). Import `retryPlayoutIngest` from the playout service.

```typescript
import {
  // ... existing imports ...
  retryPlayoutIngest,
} from "../services/playout.js";
```

Add route:

```typescript
// POST /items/:id/retry — re-enqueue ingest for a failed playout item
playoutRoutes.post(
  "/items/:id/retry",
  describeRoute({
    description: "Reset a failed playout item to pending and re-enqueue the ingest job.",
    tags: ["playout"],
    responses: {
      200: { description: "Retry enqueued" },
      401: ERROR_401,
      403: ERROR_403,
      404: ERROR_404,
      409: { description: "Item is not in failed state" },
      422: { description: "Item has no source file" },
    },
  }),
  validator("param", PlayoutIdParam),
  async (c) => {
    const { id } = c.req.valid("param" as never) as { id: string };
    const result = await retryPlayoutIngest(id);
    if (!result.ok) throw result.error;
    return c.json({ ok: true });
  },
);
```

**Acceptance Criteria**:

- [ ] `POST /api/playout/items/:id/retry` returns `{ ok: true }` with status 200 on success
- [ ] Returns 401 when unauthenticated
- [ ] Returns 403 when not admin
- [ ] Returns 404 when item not found
- [ ] Returns 409 when item is not in `"failed"` state
- [ ] Returns 422 when item has no source file

---

### Unit 5: Client-side `retryPlayoutIngest()` function

**File**: `platform/apps/web/src/lib/playout.ts`

```typescript
/** Re-enqueue the ingest job for a failed playout item. */
export async function retryPlayoutIngest(id: string): Promise<void> {
  await apiMutate(`/api/playout/items/${encodeURIComponent(id)}/retry`, {
    method: "POST",
  });
}
```

**Acceptance Criteria**:

- [ ] `retryPlayoutIngest("item-1")` calls `POST /api/playout/items/item-1/retry`
- [ ] Special characters in ID are percent-encoded
- [ ] Throws on non-2xx response (inherited from `apiMutate`)

---

### Unit 6: "Retry" button in `ContentPoolTable`

**File**: `platform/apps/web/src/components/admin/content-pool-table.tsx`

Updated props interface:

```typescript
export interface ContentPoolTableProps {
  readonly items: ChannelContent[];
  readonly onRemove: (item: ChannelContent) => void;
  readonly onRetry?: (item: ChannelContent) => void;
}
```

In the table `<tbody>`, update the actions cell to conditionally render the retry button:

```tsx
<td className={styles.poolTableCell}>
  {item.sourceType === "playout" &&
    item.processingStatus === "failed" &&
    onRetry !== undefined && (
      <button
        type="button"
        className={styles.retryButton}
        onClick={() => onRetry(item)}
        aria-label={`Retry ingest for ${item.title}`}
      >
        Retry
      </button>
    )}
  <button
    type="button"
    className={styles.deleteButton}
    onClick={() => onRemove(item)}
    aria-label={`Remove ${item.title} from pool`}
  >
    Remove
  </button>
</td>
```

**Acceptance Criteria**:

- [ ] "Retry" button appears only for `sourceType === "playout"` items with `processingStatus === "failed"`
- [ ] "Retry" button is absent when `onRetry` is not provided
- [ ] "Retry" button is absent for items in any other status
- [ ] `onRetry(item)` is called on click
- [ ] Existing "Remove" button behavior is unchanged

---

### Unit 7: CSS for retry button

**File**: `platform/apps/web/src/routes/admin/playout.module.css`

```css
.retryButton {
  padding: var(--space-xs) var(--space-sm);
  background: transparent;
  color: var(--color-warning, hsl(40 90% 55%));
  border: 1px solid var(--color-warning, hsl(40 90% 55%));
  border-radius: var(--radius-sm);
  font-family: var(--font-ui);
  font-size: var(--font-size-sm);
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
  margin-right: var(--space-xs);
}

.retryButton:hover {
  background: var(--color-warning, hsl(40 90% 55%));
  color: var(--color-bg);
}
```

**Acceptance Criteria**:

- [ ] `.retryButton` class exists and produces a warning-colored outlined button
- [ ] Hover state fills the button with warning color
- [ ] Visual gap between Retry and Remove buttons

---

### Unit 8: Wire `onRetry` in the playout page

**File**: `platform/apps/web/src/routes/admin/playout.tsx`

```typescript
const handleRetryPoolItem = async (item: ChannelContent): Promise<void> => {
  if (!item.playoutItemId) return;
  setActionError(null);
  try {
    await retryPlayoutIngest(item.playoutItemId);
    // Refresh the pool to reflect the new processingStatus
    if (selectedChannelId) {
      const data = await fetchChannelContent(selectedChannelId);
      setPoolItems(data.items);
    }
  } catch (e) {
    setActionError(e instanceof Error ? e.message : "Failed to retry ingest");
  }
};
```

**Acceptance Criteria**:

- [ ] Clicking "Retry" calls `retryPlayoutIngest(item.playoutItemId)`
- [ ] Pool items are refreshed from the server after a successful retry
- [ ] Error is surfaced in `actionError` on failure
- [ ] `selectedChannelId` is checked before the pool refresh

---

## Implementation Order

1. **Unit 1** — Shared type change (`ChannelContent.processingStatus`). Build shared package before touching API or web.
2. **Unit 2** — API query update: populate `processingStatus` in `listContent`. Depends on Unit 1.
3. **Unit 3** — Service: `retryPlayoutIngest()`. Independent of Units 1–2.
4. **Unit 4** — Route: `POST /items/:id/retry`. Depends on Unit 3.
5. **Unit 5** — Web client function. Independent of Units 1–4.
6. **Units 6 + 7** — Component + CSS. Depends on Unit 1 (for `processingStatus` on `ChannelContent`).
7. **Unit 8** — Wire in playout page. Depends on Units 5, 6, 7.

Units 3–4 (API) and Units 5–7 (web component/CSS) are parallel tracks after Unit 1 + Unit 2 are done.

---

## Testing

### API Route Tests: `tests/routes/playout.routes.test.ts`

Add `mockRetryPlayoutIngest` to the mock setup block and add a new describe block for the six cases: 200 success, 404, 409 invalid state, 422 no source, 401 unauthenticated, 403 not admin.

### Web Client Tests: `tests/unit/lib/playout.test.ts`

Test cases: POSTs to correct URL, encodes special characters in ID, throws on non-2xx.

---

## Verification Checklist

```bash
# Build shared package first (schema change in Unit 1)
bun run --filter @snc/shared build

# Run all tests
bun run --filter @snc/api test:unit
bun run --filter @snc/web test

# Build API and web (TypeScript strict mode)
bun run --filter @snc/api build
bun run --filter @snc/web build

# Manual: update a playout item to failed, verify Retry button appears and works
```
