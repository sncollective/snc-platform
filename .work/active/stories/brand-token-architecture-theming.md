---
id: brand-token-architecture-theming
kind: story
stage: done
tags: [design-system]
parent: brand-token-architecture
depends_on: [brand-token-architecture-token-restructure]
release_binding: null
gate_origin: null
created: 2026-08-14
updated: 2026-08-14
---

# Token foundation — theming (light/dark/system) + mode toggle

## Brief

Implement the executable lifecycle in `brand-token-architecture` → `## Design — Theming &
route mechanism`: a set-only inline bootstrap before `<HeadContent />`/the token stylesheet,
then exactly one hydrated appearance controller owning idempotent application, persistence,
media/storage listeners, and the mode settings control. Replace the dark-only meta at
`__root.tsx:44`, remove the temporary dark pin only when this controller activates, and mark
bootstrap-owned `<html>` attributes with `suppressHydrationWarning` (or equivalent explicit
ownership).

## Acceptance

- **Mechanism / first paint:** the inline bootstrap only performs safe storage read,
  system-mode resolution, and attribute sets; it installs no listeners. It runs immediately
  before `<HeadContent />`, therefore before the token stylesheet. The no-attribute CSS
  `prefers-color-scheme` fallback still works when CSP blocks the bootstrap; a stored
  explicit preference flashing until hydration in that failure case is accepted and
  documented.
- **Hydrated lifecycle:** exactly one controller exposes idempotent `applyPreference`, uses
  throwing-safe storage wrappers, preserves bootstrap attributes through hydration, and
  tears down/rebinds the media listener whenever preference changes. It listens only while
  system-pinned, synchronizes `storage` events without echo writes, and makes an explicit
  stored preference beat any queued media callback.
- **Settings control:** the light/dark/system settings control writes through that controller,
  persists valid local choices, normalizes missing/invalid values to system, and synchronizes
  cross-tab changes.
- **Named lifecycle tests:** invalid storage value; blocked storage read/write; storage
  events; system change while system-pinned; queued media change versus explicit preference;
  bootstrap failure; hydration attribute preservation.
- **Contrast harness:** mirror org's matrix for foreground/background and
  foreground/elevated pairs in both modes, covering base + hover + disabled + tint-composite
  cases; include the republished opaque status backgrounds.
- **Boundary:** no voice-accent or route-scoping work yet.

## Implementation notes

- Execution capability: delegated `gpt-5.6-sol` implementation worker.
- Added a dependency-free, set-only first-paint bootstrap immediately before
  `<HeadContent />`, removed the migration dark pin, marked `<html>` with
  `suppressHydrationWarning`, and made the document `color-scheme` contract light/dark/system
  aware. CSP-blocked bootstrap behavior intentionally remains the no-attribute system CSS
  fallback; stored explicit preferences may wait until hydration in that degraded path.
- Added one hydrated appearance-controller singleton with idempotent attribute writes, safe
  storage read/write fallback, local-only persistence, cross-tab storage synchronization,
  system-only media listener binding, teardown/rebind behavior, and a generation guard that
  makes queued media callbacks inert after an explicit preference wins.
- Placed the light/dark/system control on the existing authenticated `/settings` page. This is
  the natural account-preference surface already hosting password settings; the control only
  consumes the root controller and creates no second store or listener owner. Removed the
  remaining dark-only `color-scheme` overrides from shared and Mastodon form controls so they
  inherit the effective document mode.
- Added named lifecycle coverage for invalid/blocked storage, storage events, system changes,
  queued-media arbitration, CSP fallback, and hydration preservation. Added a CSS-parsing WCAG
  harness across both host surfaces and modes for base, hover/selected tint composites,
  disabled cases, and opaque paired status backgrounds; token values are read from the CSS
  rather than duplicated in tests.
- Verification: `bun run --filter @snc/web test` (189 files / 1,944 tests),
  `bun run --filter @snc/web build`, and `bun run --filter @snc/web typecheck` all pass. Build
  output retains the repository's existing third-party `"use client"` warnings only.
- Deviations: none. No voice-family or route-scoping content changed.
