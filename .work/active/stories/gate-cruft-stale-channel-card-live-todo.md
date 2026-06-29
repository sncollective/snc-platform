---
id: gate-cruft-stale-channel-card-live-todo
kind: story
stage: drafting
tags: [cleanup]
parent: null
depends_on: []
release_binding: 0.4.0
gate_origin: cruft
created: 2026-06-29
updated: 2026-06-29
---

# Landing channel card still carries resolved live-state TODO and identity proxy

## Severity
Medium

## Debris type
stale-comment

## Location
`apps/web/src/components/landing/channel-card.tsx:13`

## Evidence
```tsx
// TODO(live-state): replace identity proxy with derived airing-state.
// Interim: a creator-owned live-ingest channel stands in for "is live" until
// live-experience-redesign-live-state lands the real on-air derivation.
const isLive = channel.ownership === "creator" && channel.role === "live-ingest";
```

## Why it's debris (verified)
`channel.liveState` now exists in `packages/shared/src/streaming.ts` and is used by `apps/web/src/routes/live.tsx` and `apps/web/src/routes/admin/playout.tsx`. The comment names a feature that has landed, but this component still advertises the interim proxy.

## Remediation direction
Update the card to derive live display from `channel.liveState`, then remove the stale TODO/interim comment.
