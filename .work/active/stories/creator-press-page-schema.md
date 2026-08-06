---
id: creator-press-page-schema
kind: story
stage: implementing
parent: creator-press-page
depends_on: []
release_binding: null
gate_origin: null
created: 2026-08-05
updated: 2026-08-05
---

# Schema + shared contract + seed

Foundation unit — full spec in feature body §"Unit 1". Everything else depends
on this contract.

**Deliverables**:
- `creator_press_configs` table (clone of `creator_join_configs`: PK+FK `creator_id`, cascade delete, defaults-on-absence) + a `drizzle-kit generate` migration (never hand-written).
- `packages/shared/src/press.ts` — schema-first Zod contract: `PressContentSchema` (band EPK fields + `releases[]` of `ReleaseOneSheetSchema`), `PressConfigPatchSchema`, `PressPagePayloadSchema`, `DEFAULT_PRESS_CONTENT`; re-export from the `@snc/shared` barrel.
- `apps/api/src/services/press.ts` — `getPressConfig(creatorId)` (defaults on absence), `upsertPressConfig(creatorId, patch)` (upsert on conflict), mirroring `services/join.ts`.
- Seed the Animal Future row: band EPK (short/long bio, for-fans-of, streaming links, standout track "Get to You" @ **14.5k**, no TikTok, `press@s-nc.org`, Fort Collins CO) + one release SNCR-001 "The Illusionist" (full one-sheet fields per kit-v1). Content sourced from `records/animal-future/.work/active/stories/story-publicity-campaign-epk-kit-v1.md`.

**Acceptance evidence**:
- [ ] migration generates + applies cleanly; table has PK+FK cascade.
- [ ] `getPressConfig` returns defaults when no row; `upsertPressConfig` round-trips.
- [ ] AF row seeded (verifiable once Unit 2's GET lands).

**Order**: first — the contract every other unit imports.
