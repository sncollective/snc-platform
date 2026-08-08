---
id: creator-press-page-v2-content-model-normalization
kind: story
stage: done
tags: [creators, content, schema]
parent: creator-press-page-v2-content-model
depends_on: [creator-press-page-v2-content-model-contract]
release_binding: null
gate_origin: null
created: 2026-08-08
updated: 2026-08-08
---

# Press page v2 content model — read-time v1→v2 normalization (Unit 2)

Unit 2 of the `creator-press-page-v2-content-model` feature design. Depends on
the contract (`creator-press-page-v2-content-model-contract`). (Replaces the
earlier stored-backfill approach — see the feature's `## Design decisions`.)

## Scope

A **pure read transform** in `apps/api/src/services/press.ts`, applied after
`readPressConfig` parses a row through the evolved schema — `normalizePressContent(c)`:

- `gallery` ← `photos` (bare keys → `PressImage {key, alt:"", credit:null}`) **only when the raw `gallery` key is absent**; an explicit `[]` wins.
- `highlights` ← `standoutTrack` (lead: eyebrow "Standout track", title, metric=streamsLabel, url) then `releases` (eyebrow "New release · "||catalogNumber, title, coverArt from artKey) **only when the raw `highlights` key is absent**; an explicit `[]` wins.
- (streaming `service` inference already happens at parse time via the contract's union preprocessor — no duplicate work.)
- `banner`/`aboutPhoto`/`members`/`tagline` have no v1 analog → stay default; not derived.

Wire it into `readPressConfig` so both the public and manage read paths return the
normalized shape. Explicit v2 editor writes take precedence by raw JSONB key presence (an
explicit empty array remains authoritative). `normalizePressContent` is a pure function.

## Acceptance evidence

- [x] A v1 row (bare `photos`, `standoutTrack`, `releases`) read via `getPressConfig`
      yields `gallery.length == photos.length`, a leading "Standout track" highlight,
      then release highlights, inferred streaming services.
- [x] A row where the editor already set `gallery`/`highlights` is returned **as-written**.
- [x] `normalizePressContent` is idempotent: normalize(normalize(x)) deep-equals normalize(x).
- [x] Pure-function unit tests (no DB) cover: v1 derivation, precedence, idempotence,
      null/empty `standoutTrack`/`releases` edge.
- [x] Existing v1 public-press + manage-press route tests stay green (the transform
      is additive; v1 consumers ignore the new fields).
- [ ] `bun run --filter @snc/api test:unit` + `test:integration` green (unit is green; integration has unrelated baseline failures).

## Notes

- **No DDL, no stored backfill, no migration.** This is the lazy-migration path:
      v1 rows map forward at read time; the v2 editor's writes persist and win.
      Avoids any migrations-dir write (keeps W1 parallel with `content-library-core`'s
      `db:generate`) and avoids mutating live data.
- `image-management` (later) lets the editor fill empty alts/credits; until then
      derived gallery/coverArt carry empty alt strings.

## Implementation

Added pure `normalizePressContent` and wired parsed row reads through it. Legacy
photos become gallery image objects, standout/release data becomes highlights,
and explicit v2 gallery/highlights remain authoritative, including empty arrays. Added service
unit coverage for read-path normalization, precedence, idempotence, and empty
legacy sources.

Verification: `bun run --filter @snc/api test:unit` — 120 files, 1,930 tests
passed. The full integration command was attempted: 8 files/39 tests passed, but
4 unrelated tests failed in existing channel-lifecycle foreign-key setup and
test-control-secret gating; no press integration tests failed.
