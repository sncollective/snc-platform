---
id: creator-content-search-excludes-ready-status
created: 2026-06-25
updated: 2026-06-25
tags: [streaming, playout, bug]
---

The creator Programming **"+ Add Content"** search never offers a creator's own fully-processed
video content. A creator cannot assign their `ready` content to their channel pool via the search
picker.

## Root cause

`searchAvailableContent` (and the playout autoFill candidate query) filter creator content with:

```sql
AND (c.processing_status = 'completed' OR c.processing_status IS NULL)
```

But content's `ProcessingStatus` vocabulary is `["uploaded", "processing", "ready", "failed"]`
(`packages/shared/src/content.ts:12`). The terminal "done" state for content is **`'ready'`** —
`'completed'` is **never written to the content table** (it belongs to `PROCESSING_JOB_STATUSES`,
a *different* enum at `packages/shared/src/media-processing.ts:6`). The transcode/probe pipeline
sets content to `'ready'` (`apps/api/src/jobs/handlers/transcode.ts:87`,
`apps/api/src/jobs/handlers/probe-codec.ts:86`).

Net effect: only legacy `NULL`-status content surfaces in the search; every actually-processed
(`ready`) video is silently excluded. Verified against the demo seed — `Studio Tour 2026`
(Maya's video) is `processing_status = 'ready'` in the DB and is excluded from her search.

## Call sites (both wrong)

`apps/api/src/services/playout-orchestrator.ts`:
- line ~1067 — `searchAvailableContent` (the "+ Add Content" search)
- line ~909 — autoFill candidate query (`getAutoFillCandidates`)

## Fix

Accept `'ready'` as the terminal state (replace `'completed'` with `'ready'`, or include both if
back-compat with any `'completed'`-tagged rows is wanted — none exist today). Keep the `IS NULL`
allowance for legacy rows. Apply to both call sites.

## Found by

Surfaced while implementing `creator-programming-e2e-golden` (Spec A) on 2026-06-25. Blocks e2e
cases 2 (assign own content to pool), 3 (queueable with "Content" badge), and 4 (play-next into
the queue) — all depend on `Studio Tour 2026` reaching the pool through the search. Those cases
are landed as `test.skip` linked to this id; the surface-renders, nav, and cross-tenant-isolation
cases stay green. Re-enable the three skipped cases once this lands.
