---
id: live-experience-redesign-page-states-player-skeleton
kind: story
stage: implementing
tags: [streaming]
release_binding: null
depends_on: []
gate_origin: null
created: 2026-06-13
updated: 2026-06-13
parent: live-experience-redesign-page-states
---

# Player cold-start skeleton + HLS error state

Implements **Unit 1** of the parent feature's design (read `## Implementation Units`
→ Unit 1 in the parent body for exact signatures, CSS, and notes).

## Scope

`apps/web/src/components/media/global-player.tsx` +
`apps/web/src/components/media/global-player.module.css` only. Adds a local
`PlayerStatus` (`loading | ready | error`) driven by Vidstack's `onCanPlay`/`onError`
callback props, a pulsing 16:9 skeleton overlay during the loading window (covers both
the dynamic-module load and the HLS handshake — the audit's 12–15s dead air), a custom
error overlay with honest copy and a "Try again" remount (key bump), and a
`pendingFrame` class so the expanded container reserves 16:9 height before Vidstack
mounts. Non-audio media only. `pulse` keyframes move here from live.module.css (the
orphan deletion in live.module.css belongs to the sibling `offline-loading` story).

**Spike first**: typecheck `onCanPlay`/`onError` on `MediaPlayer` (verified in
@vidstack/react 1.12.13 types via `ReactElementProps<MediaPlayerInstance>`); fallback
is a `useMediaState` bridge child — see parent `## Risks`.

## Acceptance

- [ ] On live cold start the 16:9 player area shows a pulsing skeleton from mount until
      Vidstack fires `canPlay` — no zero-height window, no blank frame
- [ ] Player error replaces the skeleton with honest copy and a working "Try again"
      button that remounts the player and returns to the skeleton state
- [ ] Switching channels resets status to loading
- [ ] Audio content renders no skeleton, no pending frame, no error overlay
- [ ] Skeleton animation disabled under `prefers-reduced-motion: reduce`
- [ ] `tests/unit/components/global-player.test.tsx` extended per parent `## Testing`
