---
id: creator-profile-brand-color
kind: feature
stage: review
tags: [creators, content, schema]
parent: null
depends_on: []
release_binding: null
gate_origin: null
created: 2026-08-09
updated: 2026-08-09
---

# Creator profile — brand color (site-wide reusable foundation)

## Brief
Add a creator-pickable **brand accent color** to the creator profile, reusable
across surfaces. The press-page-v2 **PDF Creator Brand Accent scheme** + future
surfaces (web press page, creator page) consume it. This feature delivers the
profile field + the setter logic/endpoint; the **editor** (`creator-press-page-v2-editor`)
delivers the picker UI (it's where creators set it).

## Scope
- `creatorProfiles.brandColor` — a nullable field storing the creator's chosen
  accent. **Curated palette for v1** (a small set of tasteful, contrast-safe
  colors against the dark surfaces — NOT arbitrary hex; free-hex-with-guardrails
  is a later option). Validate on write.
- An owner-scoped **update endpoint** (set/clear brandColor), or fold into the
  existing profile-update path. The editor's Appearance-and-media tab calls it.
- Consumers read `creatorProfiles.brandColor`; null = no accent (fall back to the
  platform default). The PDF Creator Accent scheme uses it (see
  `creator-press-page-v2-pdf`).

## Acceptance
- [x] `creatorProfiles.brandColor` added (nullable; curated-palette-validated) via a generated migration.
- [x] Owner can set/clear it; non-owner cannot.
- [ ] A consumer (the PDF scheme, as the first) reads it; null → default fallback.

## Notes
- The adversarial editor review flagged **contrast safety** (some presets fail 4.5:1 on `#1a1a2e`) — the curated palette must be contrast-safe, and consumers derive an accessible foreground (or constrain where the accent is used).
- This is the foundation the editor + PDF depend on; land it first.

## Implementation discovery
- Added `brandColor` to the shared creator update/response contracts and the
  creator profile schema. The v1 palette is eight fixed accents, each measured
  at 4.5:1 or better against `#1a1a2e`; `null` clears the accent.
- The existing `PATCH /api/creators/:creatorId` profile-update path already
  enforces `editProfile`, so it now owns set/clear validation without a second
  permission surface.
- The shared migration also adds the bundled press draft column to avoid a
  migration journal race.
- The PDF consumer is intentionally deferred to its downstream feature per the
  implementation boundary; this change exposes the validated profile field for
  that consumer and does not alter PDF rendering.

## Verification
- `bun run --filter @snc/shared test` — 23 files, 723 tests passed.
- `bun run --filter @snc/api test:unit` — 124 files, 1,988 tests passed.
- `bun run --filter @snc/api typecheck` — passed.
- `bun run --filter @snc/api test:integration` — 47 passed; 4 pre-existing
  unrelated failures remain (channel-lifecycle FK and test-control gating).
