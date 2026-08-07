---
id: creator-press-page-v2-content-model-backfill
kind: story
stage: implementing
tags: [creators, content, schema]
parent: creator-press-page-v2-content-model
depends_on: [creator-press-page-v2-content-model-contract]
release_binding: null
gate_origin: null
created: 2026-08-08
updated: 2026-08-08
---

# Press page v2 content model — v1→v2 data backfill (Unit 2)

Unit 2 of the `creator-press-page-v2-content-model` feature design. Depends on
the contract (`creator-press-page-v2-content-model-contract`) — it backfills
*to* the new shape.

## Scope

A hand-written jsonb UPDATE migration in `apps/api/drizzle/migrations/` (next seq
after `0033`), idempotent (every clause guarded by `NOT content ? '<field>'`):

- `gallery` ← `photos`: bare keys → `PressImage` objects `{key, alt:'', credit:null}`
  (`jsonb_agg` over `jsonb_array_elements_text`).
- `highlights` ← `standoutTrack` (first: eyebrow "Standout track", title, metric
  = streamsLabel, url) then `releases` (eyebrow "New release · "||catalogNumber,
  title, coverArt from artKey). Guarded `NOT content ? 'highlights'`.
- `streamingLinks` service inferred from URL host via the same mapping as
  `inferService` (fallback `website`); best-effort, preserves url+label.

No backfill for `banner`/`aboutPhoto`/`members`/`tagline` (no v1 analog → default
null/empty).

## Acceptance evidence

- [ ] Run the migration SQL against the live AF press config in dev → post-backfill
      JSON parses to a valid v2 `PressContent`: `gallery` length == v1 `photos`
      length, a leading "Standout track" highlight, inferred streaming services.
- [ ] Re-running the SQL is a no-op (idempotence guards hold).
- [ ] A creator with no press row is unaffected; `db:migrate` records the migration.
- [ ] `bun run --filter @snc/api test:unit` + `test:integration` green; existing
      v1 public-press + manage-press route tests stay green (do not weaken).

## Notes

- This is **data**, not DDL — the one place hand-written migration SQL appears,
  legitimately (drizzle-kit generates DDL only). Per `drizzle-migrations.md`.
- Author + verify the jsonb expressions against the real AF row in dev before
  commit; the expressions are fiddly and that's the cheapest correctness check.
- The v1 web render + v1 manage editor keep working throughout (the superset is
  backward-compatible). The v2 editor (later feature) becomes the source of truth
  and v1 fields go read-only-legacy.
