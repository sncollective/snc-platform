---
id: showcase-item-voices
kind: story
stage: done
tags: [design-system, ui, content]
parent: showcase-voice-presence
depends_on: [parent-voice-warm-accent]
release_binding: null
gate_origin: null
created: 2026-08-14
updated: 2026-08-14
---

# Showcase per-item voices (fallback attribution)

## Brief
Shared dev-free mapping module (content-type fallback: audio→records, video→tv,
podcast/studio-audio→studio, written/none→parent; event types: show→tv,
recording-session→studio). Per-item accents via inline `--item-unit-*` var chains
(`var(--voice-<unit>-accent/-bg/-on-accent)`; parent = no properties). Home RecentContent +
/feed: item title in unit accent (parent→neutral), 1px unit-accent hover border on the card
wrapper. WhatsOn: tv accent on section title. ComingUp: per-event unit label in unit accent,
titles neutral. NO creator chips (deferred to attribution data model — org-accepted).

## Acceptance
- Mapped items show unit accents on both surfaces, both modes; parent items neutral.
- No raw voice consumption outside sanctioned surfaces; no literals (var chains only).
- Attribution-link accent treatment documented as deferred with the chips.
- Suites + build green.

## Implementation notes
- Execution capability: `gpt-5.6-sol`; direct implementation around one pure fallback map and the existing card surfaces.
- Review weight: `standard` (feature contract/caller); child checkpoint receives no independent review.
- Files changed: new `apps/web/src/lib/showcase-item-voice.ts`; content/landing/feed consumers and CSS; mapping, component, route, and color-boundary tests.
- Tests added/removed: added exhaustive current/future fallback cases, exact inline var-chain coverage, home/feed card mappings, Coming Up event mappings, Whats On TV treatment, and a fail-closed checker contract for the sole mapping owner; none removed.
- Simplification: one module owns both fallback tables and all inline `--item-unit-*` chains. Parent returns no properties, so parent cards and event labels fall back to neutral roles without a duplicate parent style object.
- Discrepancies from design: the stale dependency on removed `showcase-accent-boundary` was corrected to `parent-voice-warm-accent`; otherwise none.
- Adjacent issues parked: none.
- Attribution deferral: creator attribution links and creator chips remain neutral and unchanged until the attribution data model can identify the owning unit; only content/event type fallback drives this increment.
- Checker boundary: `lib/showcase-item-voice.ts` is the exact sanctioned owner for studio/TV/records accent, background, and on-accent var chains. Parent raw voice tokens are deliberately forbidden there.
- Verification: `bun run --filter @snc/web test` — 197 files / 2052 tests passed; `bun run --filter @snc/web build` — passed (existing third-party `use client` warnings only).
