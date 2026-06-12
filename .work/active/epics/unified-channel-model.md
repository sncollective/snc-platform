---
id: unified-channel-model
kind: epic
stage: drafting
tags: [streaming, playout]
release_binding: null
depends_on: [bold-channel-topology-model-render]
gate_origin: null
created: 2026-06-12
updated: 2026-06-12
parent: null
---

# Unified channel model — every channel is a receiver; editorial decides what airs

## Thesis
Creator channels and playout channels are the same editorial surface controlled by
different users. A channel is a **receiver** for live streams or stored content, no
matter how it's created or controlled; **choosing what is playing on a channel at any
given time is an editorial surface**. Creator channels are persistent and 1:1 with a
creator page; S/NC channels are CRUD-able by admins; nothing else differs. Nothing
says a creator shouldn't schedule content or build an automatic content pool.

The current model contradicts itself: `channels.type` ("playout" | "live" |
"scheduled" | "broadcast") conflates channel identity with momentary airing state —
the UX audit's highest-confusion finding (the LIVE badge that never renders because
`type === "live"` never matches `"broadcast"`, `live.tsx:290`) is this conflation
surfacing, and `"scheduled"` is a dead enum member used nowhere. Creator channels
exist as temporary rows fabricated per stream session. The Liquidsoap render
hardcodes one channel's editorial priority (`liquidsoap-config.ts:192`:
`snc_tv = fallback([live_source, snc_tv_queue, defaultPlayoutSource, blank()])`)
as a special case. This epic makes line 192 the rule instead of the exception.

## Decisions (user workshop, 2026-06-12)
- **Airing model: airs when programmed.** A pipeline exists only while something is
  programmed (live input active, queue armed, always-on pool config); otherwise the
  channel is honestly offline at zero cost. S/NC TV's 24/7 behavior is editorial
  config (a never-ending pool), not a special kind. Cost scales with programming,
  not channel count. (Rejected: always-on per channel — N pipelines rendering dead
  air; hard creator/S-NC tier — defers the half that makes creators editorial.)
- **Carry model: channels as sources.** A channel's editorial config can reference
  another channel as a source with priority — S/NC TV carrying a live creator
  becomes a visible, editable programming decision, generalizing what line 192
  hardcodes. Needs cycle detection; the graph is shallow in practice. (Rejected:
  keep takeover special-cased — preserves the plumbing this epic exists to dissolve;
  full any-depth syndication graph — speculative generalization with no consumer.)
- **Control model: manual or auto, broadly.** The editor can manually control what's
  on air, or set the channel to auto and choose the automation. Mode (manual | auto)
  is the architectural commitment; specific control verbs (staged queues with
  arm/take, event pinning, etc.) are design-pass material derived from scenarios —
  e.g. "build a queue while the pool rotates, switch over when ready" and "choose
  the scheduled event over the live creator" must be expressible without a playout
  reset. Live switching, not config regeneration.
- **Provisioning: lazy, on first use.** The persistent creator channel is created on
  the creator's first channel-shaped act (stream key, pool, queue); `on_publish`
  activates the creator's existing channel instead of fabricating a temp row.
- **Schedule tier: deferred.** v1 editorial tiers are live + queue + pool + the
  manual/auto control plane. Calendar time-slot programming is a follow-up arc the
  model leaves room for as a source type.
- **Identity vs state.** The 4-value type enum dies. Channel identity (platform-owned
  vs creator-owned, mount point, slug) is separate from airing state (live / playout
  / offline — derived, event-published). The LIVE-badge class of bug becomes
  unrepresentable.

## Sequencing (this epic atop the bold-refactor + redesign work)
- **Enabler**: `bold-channel-topology-model-render` (behavior-identical typed
  topology + pure `.liq` render) is this epic's `depends_on` — refactor the render
  seam first, then change what it renders. The topology epic's other children
  (startup assertions, drift detection) are unaffected.
- **Consumers**: `playout-admin-redesign`'s queue/pool/actions work builds THE
  shared editorial surface (role-scoped; rebriefed 2026-06-12);
  `live-experience-redesign-live-state`'s server-side live-state representation IS
  this model's airing state; the event spine carries `channel.live-state-changed`
  unchanged.
- **Creator editorial enablement** (mounting the editorial surface on creator manage,
  lazy provisioning UX) is this epic's own arc, after the model and surface exist.

## Anticipated child features (provisional — epic-design refines)
- Schema + lifecycle migration: identity/state split, persistent creator channels,
  temp-row retirement, lazy provisioning.
- Editorial model + control plane: per-channel source tiers (live/queue/pool +
  channel-as-source), manual/auto mode, no-restart live switching in the render.
- S/NC TV as first composition consumer: takeover re-expressed as channel-as-source
  programming, output-equivalent to today's fallback semantics.
- Creator editorial enablement: editorial surface mounted on creator manage,
  provisioning flow, permissions.

## Risks
- Production streaming path — every step needs output-equivalence or explicit,
  reviewed behavior change.
- No-restart live switching is the hard technical unknown (Liquidsoap interactive
  predicates / harbor control vs the current regenerate-and-restart cycle) — spike
  early in epic-design.
- Per-channel pipelines on demand change the engine's process model; the
  airs-when-programmed lifecycle is new operational surface (start/stop supervision).
