---
id: creator-press-page-v2-content-model-contract
kind: story
stage: done
tags: [creators, content, schema]
parent: creator-press-page-v2-content-model
depends_on: []
release_binding: null
gate_origin: null
created: 2026-08-08
updated: 2026-08-08
---

# Press page v2 content model — shared contract (Unit 1)

Unit 1 of the `creator-press-page-v2-content-model` feature design. The shared
Zod contract every v2 feature (image-management, templates, editor, pdf) consumes.

## Scope

Evolve `packages/shared/src/press.ts` into a v2 superset (additive; v1 fields
kept as legacy optionals):

- New types: `PressImageSchema` `{key, alt(required), credit?}`,
  `PressMemberSchema` `{name, role?, photo?, bio?}`,
  `PressHighlightSchema` `{eyebrow, title, description?, metric?, url?, coverArt?}`,
  `PressStreamingServiceSchema` (enum: spotify, apple-music, amazon-music,
  youtube, bandcamp, soundcloud, tidal, website).
- `PressStreamingLinkSchema` → `{service, url, label?}` (label optional override).
- `PressContentSchema` adds: `template` (`"A"|"B"`, default `"A"`), `tagline?`,
  `banner?` (PressImage), `aboutPhoto?` (PressImage), `members` (default `[]`),
  `highlights` (default `[]`), `gallery` (default `[]`). Keep `photos`,
  `standoutTrack`, `releases` as legacy optionals.
- `inferService(url)` host→service helper (spotify/apple/bandcamp/youtube/etc →
  `website` fallback); used by the streaming-links read preprocessor.
- A `z.union`/preprocessor on `streamingLinks` elements mapping legacy
  `{label,url}` → `{service: inferService(url), url, label}` so legacy
  v1 rows parse without throwing.
- Update `DEFAULT_PRESS_CONTENT` (new defaults) and `PressConfigPatchSchema`
  (mirror, all optional — still accepts v1 patches: `photos`, `standoutTrack`).

## Acceptance evidence

- [x] A v1-shaped `content` JSON (bare `photos`, `standoutTrack`, legacy
      `{label,url}` links) parses against the evolved `PressContentSchema`
      without throwing → `gallery:[]`, `highlights:[]`, `members:[]`,
      `template:"A"`, streaming links with inferred `service`.
- [x] `DEFAULT_PRESS_CONTENT` satisfies the evolved schema; round-trips.
- [x] `PressConfigPatchSchema` accepts a partial v2 patch AND a v1 patch.
- [x] `inferService` maps known hosts + falls back to `website`.
- [x] `bun run --filter @snc/shared test` green (new contract tests).

## Implementation

Evolved `packages/shared/src/press.ts` with the additive v2 content model,
legacy streaming-link parse normalization, host-based service inference, and
backward-compatible patch/default schemas. Added v1 fixture, inference, default
round-trip, and patch coverage in `packages/shared/tests/press.test.ts`.

Verification: `bun run --filter @snc/shared test` — 22 files, 708 tests passed;
`bun run --filter @snc/shared typecheck` passed.

## Notes

- This is a JSONB-contract change — **no DDL**. `creator_press_configs.content`
  stays one jsonb column. Read-time normalization is the sibling story
  `creator-press-page-v2-content-model-normalization`.
- Ownership validation for library keys (`isLibraryAssetKey` alongside
  `isOwnedPressKey`) is evolved in `creator-press-page-v2-image-management`
  (depends on this + `content-library-core`).
