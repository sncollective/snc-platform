---
tags: [refactor, quality, creators]
release_binding: null
created: 2026-04-20
---

# Creator Routes — Candidates Handler Inline Type

`apps/api/src/routes/creator.routes.ts` — candidates handler uses an inline `{ q?: string; limit: number }` type instead of referencing the inferred type from `CandidatesQuerySchema`. Pattern drift from the surrounding routes which consistently reference the schema-inferred type. Align for readability and single-source-of-truth.

P3 — low priority. Land during next creator-routes touch.
