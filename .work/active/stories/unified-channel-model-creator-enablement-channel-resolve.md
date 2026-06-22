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
updated: 2026-06-22
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
- [x] Provisioned creator → `{ channelId }`.
- [x] Unprovisioned creator (no channel row) → `{ channelId: null }`.
- [x] Non-member → 403.
- [x] Channel id is NOT present on `CreatorProfileResponse` / public profile fetches.
- [x] Happy-path + auth-failure tests on the endpoint.

## Notes
Parallel with the api-gate story — both depend only on existing services. Consumed by the mount
story (Unit 4).

## Implementation

### Service fn — `findCreatorChannelId` (`apps/api/src/services/channels.ts`)
Read-only SELECT for `channels.id` where `(creatorId, ownership='creator', role='live-ingest')`.
Returns `string | null`. Added above `ensureCreatorChannel` in the same file; mirrors its query
without the INSERT path. Confirmed pure read — does not call `ensureCreatorChannel` or touch DML.

### Endpoint — `GET /api/creators/:creatorId/channel` (`apps/api/src/routes/creator.routes.ts`)
Added after the existing `PATCH /:creatorId` handler. Shape: `requireAuth` → `validator("param",
CreatorIdParam)` → `requireCreatorPermission(user.id, creatorId, "viewPrivate", roles)` → call
`findCreatorChannelId(creatorId)` → `c.json({ channelId })`. Uses the same `viewPrivate` permission
gate as specified (all three team roles carry `viewPrivate: true`; admin bypasses). `app.ts` not
touched — the route is already mounted via `creatorRoutes`.

### Web fetcher — `fetchCreatorChannel` (`apps/web/src/lib/creator.ts`)
Added at the existing creator lib, using `apiGet<{ channelId: string | null }>`. Follows the same
`encodeURIComponent` + named-export pattern as the rest of the file.

### Tests (`apps/api/tests/routes/creator.routes.test.ts`)
Four tests added under `GET /api/creators/:creatorId/channel`:
- Provisioned: `channelId` returned, `findCreatorChannelId` called with correct arg.
- Unprovisioned: `channelId: null`.
- Non-member: 403, `findCreatorChannelId` NOT called (guard fires before the lookup).
- Unauthenticated: 401.

**Results:** 114 test files / 1791 tests, all pass. Web: 163 test files / 1767 tests, all pass.

### No-leak confirmation
`CreatorProfileResponse` shape and `toProfileResponse` were not modified. The `GET /:creatorId`
public-profile endpoint continues to return only the fields already in `CreatorProfileResponseSchema`
— no `channelId` field added there.

## Review record
Verdict: **Approve** (fast lane) — pure read confirmed (`findCreatorChannelId` is a SELECT-only
fn, no provision-on-read; the unprovisioned test asserts the lookup returns null without calling
`ensureCreatorChannel`); `viewPrivate` gate gives team-member read + non-member 403; channel id NOT
added to `CreatorProfileResponse` / public profile (`toProfileResponse` untouched). Happy-path +
auth-failure (403/401) tests present; API (1791) + web (1767) suites green. Verified by orchestrator
re-run.

## Reopened — handle param not resolved (found integrating with mount, cross-model review)
The endpoint's happy path was verified with **id-shaped** test fixtures, which hid a real bug: the
creator-manage UI routes by `creator.handle ?? creator.id`, so `GET /api/creators/:creatorId/channel`
receives a **handle** for most creators. But this endpoint passes the raw param to
`requireCreatorPermission(user.id, creatorId, …)` and `findCreatorChannelId(creatorId)`, both of
which match on the literal creator **id** — so a handle never matches, and a provisioned creator's
channel resolves to `null`. The sibling public `GET /:creatorId` (`creator.routes.ts:164`) does NOT
have this bug because it uses the dual-mode `findCreatorProfile(handleOrId)` resolver.

**Fix:** resolve the param handle→canonical creator id at the top of the handler (reuse
`findCreatorProfile` / the established `human-readable-url-slug` dual-mode resolver), THEN run the
permission check + `findCreatorChannelId` against the canonical id. Add a test that passes a HANDLE
(not an id) and asserts the channel resolves — the regression guard the original tests lacked.

Original implementation (endpoint + read-only `findCreatorChannelId` + web fetcher + no-leak) is
otherwise intact; this is the missing handle-resolution + its test.
