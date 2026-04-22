---
tags: [content]
release_binding: null
created: 2026-04-21
---

# content processing state auto-refresh

On the content edit / detail page, after a media upload completes and the server begins processing, the UI stays at "Processing media…" until the user manually refreshes the page. No client-side mechanism polls or subscribes to processing completion. Pre-existing gap surfaced by the upload-edit-ux-overhaul state machine landing 2026-04-21 — the old code had a different symptom (showing "Ready" prematurely alongside the upload placeholder) but the refresh-stale-ness itself predates this feature. Options: poll `/api/content/:id` while phase is processing; have the server push a WS event on processingStatus transition; rehydrate on window focus. Target 0.3.1. Acceptance: after an upload completes, the edit page's Media section transitions from "Processing" to "Ready" without user-initiated refresh within a bounded delay.
