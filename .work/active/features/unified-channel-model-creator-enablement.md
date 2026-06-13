---
id: unified-channel-model-creator-enablement
kind: feature
stage: drafting
tags: [streaming, playout]
parent: unified-channel-model
depends_on: [unified-channel-model-identity-lifecycle, unified-channel-model-editorial-engine]
release_binding: null
gate_origin: null
created: 2026-06-13
updated: 2026-06-13
---

# Creator editorial enablement — the surface mounts on creator manage

## Brief
Creators get the editorial surface for their own persistent channel: mount the shared
queue/pool/actions surface on creator manage, scoped to the creator's channel and
permissions; the lazy-provisioning UX (first channel-shaped act creates the channel —
stream key, pool config, queue use — with honest messaging about what just got created);
and the permission model (creator edits own channel's programming; platform roles edit
S/NC channels; nothing cross-creator).

**This feature mounts, it does not build, the surface.** The role-scoped editorial
components are `playout-admin-redesign`'s deliverables — its 2026-06-12 reframe commits
its children to "a channel + a permission context, not 'the admin screen'". This feature
consumes those components for the creator context. If sequencing inverts (this feature's
design pass arrives before the redesign children land usable components), STOP and
coordinate rather than building a parallel creator-only surface — a second editorial
surface is exactly what the unified epic exists to prevent.

Does NOT cover: the editorial engine semantics (sibling); admin-context surface work
(playout-admin-redesign); schedule tier (deferred by epic decision); discovery/viewer
presentation of creator channels (live-experience epic).

## Epic context
- Parent epic: `unified-channel-model`
- Position in epic: terminal child — needs `identity-lifecycle` (persistent channels,
  lazy provisioning semantics) and `editorial-engine` (the config it edits). Cross-epic
  coordination with `playout-admin-redesign` children by prose contract (no hard
  `depends_on` edge across epics; check their state at design time).

## Foundation references
- Epic body `## Decisions` — provisioning (lazy, on first use), control model
- `playout-admin-redesign` epic `## Reframe` — shared-surface commitment this feature consumes
