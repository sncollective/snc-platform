---
id: unified-channel-model-identity-lifecycle
kind: feature
stage: drafting
tags: [streaming, playout]
parent: unified-channel-model
depends_on: []
release_binding: null
gate_origin: null
created: 2026-06-13
updated: 2026-06-13
---

# Channel identity/lifecycle — the enum dies, creator channels persist

## Brief
Split channel identity from airing state in the data model and retire the per-session
temp-row lifecycle. Identity (platform-owned vs creator-owned, mount point/`srsStreamName`,
slug/name, ownership) becomes the durable shape of the `channels` row; the 4-value `type`
enum ("playout" | "live" | "scheduled" | "broadcast") is removed — `"scheduled"` is dead
today and the live-vs-broadcast conflation is the LIVE-badge bug class. Migration is
**expand-migrate-contract** (per epic design decision): add identity fields, migrate
consumers off `type`, drop the enum last — each step reviewable and revertible on the
production streaming path.

Creator channels become persistent: lazily provisioned on the creator's first
channel-shaped act (stream key creation, pool config, queue use), and `on_publish`
**activates** the creator's existing channel instead of fabricating a temp row
(`createLiveChannel`'s fabricate-or-reactivate dance in `services/channels.ts` retires).
Chat-room lifecycle continuity must be preserved across this change (rooms currently
created per fabricated channel). Canonical platform-channel identity moves into the model:
the `SNC_TV_BROADCAST` constant in `services/channels.ts` (and the seed script's channel
definitions) become seeded identity rows — this feature takes the constant ownership the
topology refactor deliberately deferred.

Does NOT cover: the airing-state *representation* (derived live/playout/offline state is
built by `live-experience-redesign-live-state` per the epic's Consumers section — this
feature only guarantees the identity fields that derivation keys on); editorial config
(sibling `editorial-engine`); any UI beyond keeping existing admin/viewer surfaces working
through the migration.

## Epic context
- Parent epic: `unified-channel-model`
- Position in epic: foundation feature — the other three children depend on its schema
  and lifecycle semantics. The epic-level `depends_on` (`bold-channel-topology-model-render`,
  landed 2026-06-13) gives this feature the typed topology + pure render seam to migrate
  against.

## Foundation references
- `docs/streaming.md` — channel/playout architecture (current state; this feature changes it)
- Epic body `## Decisions` — airing model, provisioning, identity-vs-state (locked at workshop)

## Design decisions inherited from epic
- Expand-migrate-contract for the enum removal (see epic `## Design decisions`).
- Airing state is derived + event-published, owned by the live-state feature; no
  `state` enum column replaces the `type` enum.
