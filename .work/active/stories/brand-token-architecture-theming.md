---
id: brand-token-architecture-theming
kind: story
stage: implementing
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
