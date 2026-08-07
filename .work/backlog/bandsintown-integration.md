---
id: bandsintown-integration
created: 2026-08-07
tags: [creators, content, integration]
---

# Bandsintown integration (separate epic — reusable)

Server-fetch the Bandsintown public artist-events API (read-only, `app_id` auth,
no partnership needed — researched in
`events-integration-bandsintown-source-of-truth`) + cache (rate-limit-aware).
Render the live-dates list (date / venue / location / ticket link).

**Reusable across surfaces:** the press page (`creator-press-page-v2`) AND the
creator pages — not just press. That's why it's scoped separately from the
press-page v2 epic.

Scope as its own epic when prioritized. The press-page v2 templates *render* the
list; until this lands they link out to Bandsintown as the interim.
