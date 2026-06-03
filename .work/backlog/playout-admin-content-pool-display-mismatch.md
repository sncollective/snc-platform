---
tags: [admin-console, streaming]
release_binding: null
created: 2026-04-18
---

# Playout admin UI — Content Pool header count vs empty list mismatch

Observed on http://localhost:3082 admin playout (S/NC Music tab). The Content Pool header reads **"Content Pool (3 items)"** but the list below shows **"No content in pool."** — contradictory state in the same view.

Three theories:
1. Two separate fetches (count vs list) with one succeeding and the other failing or filtered, no reconciliation on error
2. Count is cached / stale from a prior channel's pool; list is live and correctly empty for this channel
3. List filters items by some attribute (e.g. processing status) that excludes everything, while the count doesn't apply the same filter

Investigate the admin playout component's content pool fetch logic (`listContent` orchestrator method on the backend; how the frontend renders count vs items).

Scope: backend check whether `GET /channels/:id/content` + its count endpoint return consistent data, then audit the frontend render for the two-fetches / filter-drift pattern. Files likely: `platform/apps/web/src/routes/admin/playout.tsx` and `platform/apps/api/src/routes/playout-channels.routes.ts`.

Discovery: 2026-04-18 during `/review` of `streaming-callback-rate-limit`.
