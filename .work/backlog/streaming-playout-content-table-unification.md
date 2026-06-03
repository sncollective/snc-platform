---
tags: [streaming, content]
release_binding: null
created: 2026-04-20
---

# Playout Items and Content Table Unification

2026-04-06: Unify `playout_items` and `content` into a single media table. `playout_items` has converged structurally with `content` — both share the same core columns (id, title, duration, source media, dimensions, processing status). Renditions should move to a separate table. The `playout_items` position/enabled columns are legacy, superseded by `playout_queue`. The queue table needs a dual-reference (`playout_item_id` + `content_id`) so both admin and creator content can be queued.

Scope with `/feature-scope` for a dedicated release.
