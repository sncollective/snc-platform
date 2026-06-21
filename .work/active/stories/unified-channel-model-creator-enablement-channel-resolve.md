---
id: unified-channel-model-creator-enablement-channel-resolve
kind: story
stage: implementing
tags: [streaming, playout, identity]
parent: unified-channel-model-creator-enablement
depends_on: []
release_binding: null
gate_origin: null
created: 2026-06-21
updated: 2026-06-21
---

# Resolve a creator's persistent channel id (endpoint + web fetcher)

## Scope
The persistent creator channel exists (lazy-provisioned by `ensureCreatorChannel`,
`services/channels.ts`) but isn't on `CreatorProfileResponse` and has no web-side fetcher. Add a
dedicated authenticated endpoint that returns the creator's persistent channel id, plus the web
fetcher the manage loader (Unit 4) uses.

Dedicated endpoint, **not** a field on `CreatorProfileResponse` — that response is fetched on
PUBLIC profile views (incl. unauthenticated viewers), and the channel id should not leak there.

## Unit (feature Unit 3)
### Endpoint — `GET /api/creators/:creatorId/channel`
- Returns `{ channelId: string | null }` (null = creator hasn't provisioned a channel yet —
  no stream key created).
- Authenticated; readable by creator team members (reuse the membership check).
- Looks up the `(creatorId, ownership='creator', role='live-ingest')` row.

### Web fetcher — `apps/web/src/lib/` (e.g. extend a creator or playout lib)
`fetchCreatorChannel(creatorId): Promise<{ channelId: string | null }>`.

## Acceptance criteria
- [ ] Provisioned creator → `{ channelId }`.
- [ ] Unprovisioned creator (no channel row) → `{ channelId: null }`.
- [ ] Non-member → 403.
- [ ] Channel id is NOT present on `CreatorProfileResponse` / public profile fetches.
- [ ] Happy-path + auth-failure tests on the endpoint.

## Notes
Parallel with the api-gate story — both depend only on existing services. Consumed by the mount
story (Unit 4).
