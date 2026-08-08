---
id: content-library-core
kind: feature
stage: done
tags: [media, content]
parent: content-library
depends_on: []
release_binding: null
gate_origin: null
created: 2026-08-07
updated: 2026-08-09
---

# Content library — shared asset store + registry + API (foundation)

## Brief

The foundation is a content-addressable image store backed by Garage, a global
blob inventory for deduplication and deferred GC, creator/admin asset
registrations with graduated sharing, and an authenticated library API. Bytes
are keyed by their detected image format and SHA-256 hash; imgproxy and the
public immutable raw route resolve those keys without depending on a live
registration.

Parent epic: `content-library`. Downstream surface work, including
`creator-press-page-v2-image-management`, consumes this feature's `canUseAsset`
permission primitive.

## Architectural choice

**Global immutable blobs, registrant-owned asset records, and explicit grants.**

The byte object and its inventory row do not belong to a creator. A creator or
platform admin registers those bytes as an asset and chooses how discoverable
and reusable that registration is. This separates four concerns:

1. `content_blobs` records every known content-addressed object independently
   of creator lifetime.
2. `content_assets` records who submitted a blob and its sharing posture.
3. `content_asset_grants` records per-creator use permission for requestable
   assets.
4. Surface records own per-use metadata such as alt text, credit, crop, and
   placement.

Storage remains global and store-once. Registrations may be tombstoned without
removing the blob, other registrations, or key-addressed public delivery.

## Sharing model (operator refinement)

This model supersedes the earlier per-creator-only registry design.

### `content_blobs`

Global, creator-independent byte inventory:

- `sha256` primary key
- unique `storageKey`
- `mimeType`, `size`, `width`, `height`, `createdAt`
- no creator FK

There is one row per unique image byte sequence. The row survives creator
cascade deletion and registration insertion failure, so a future GC sweep can
enumerate all known objects even though `StorageProvider` has no list operation.

### `content_assets`

A registration of one blob by a creator or platform admin:

- `id`
- `blobSha256` FK to `content_blobs` (`ON DELETE CASCADE`)
- nullable `creatorId`; `NULL` means admin/platform-submitted
- `sharing`: `private | requestable | open`, default `private`
- `originalFilename`, millisecond-precision `createdAt`, `deletedAt`
- partial unique `(creatorId, blobSha256)` where creator is non-null
- partial unique `blobSha256` where creator is null

Creator deletion cascades registrations, but never blob inventory. A deleted
registration is reactivated in place on re-upload: its tombstone is cleared,
its sharing/filename metadata is refreshed, and its original id is retained.

### `content_asset_grants`

Per-creator use permission for a requestable registration:

- `assetId` FK to `content_assets` (`ON DELETE CASCADE`)
- `granteeCreatorId` FK to `creator_profiles` (`ON DELETE CASCADE`)
- `grantedByUserId` FK to `users`
- `grantedAt`
- unique `(assetId, granteeCreatorId)`

### Permission semantics

**Browse:** a creator sees all live registrations they own plus live
`requestable` and `open` registrations from other creators/admins. Other
creators' `private` registrations are hidden. Admin sees every live
registration.

**Use:** a creator may reference a blob key when they own any live registration
for it, any live registration is `open`, or a live `requestable` registration
has a grant for that creator. Admin may use any blob with a live registration.
The service exposes `canUseAsset({ creatorId, isAdmin }, storageKey)` for
surface validators.

Browse responses carry both `canUse` and `useStatus`:
`own | admin | open | granted | requestable-needs-grant`.

## Design decisions

- **Format comes from bytes.** `image-size` is wrapped in `try/catch`; only
  detected `jpg`, `png`, and `webp` are accepted. The detected type drives MIME
  and extension, so relabeling identical bytes cannot change their key.
- **Bounded buffering.** Images are buffered up to `MAX_FILE_SIZES.image`
  (10 MiB) to detect, hash, and upload in one pass.
- **Inventory precedes upload.** After a successful `head()` classification,
  the global blob row is upserted before a missing object is uploaded. An
  upload or later registration failure therefore cannot create bytes that are
  absent from the DB inventory. Only normalized `NotFoundError` means absent;
  every other `head()` failure aborts.
- **Soft delete + reactivation.** Delete tombstones only the actor's own
  registration. Raw bytes and other registrations remain. Re-upload revives a
  matching tombstone instead of attempting an insert against its unique slot.
- **Lossless pagination.** Asset timestamps use PostgreSQL millisecond
  precision, exactly matching JavaScript `Date`/ISO cursors. Browse ordering is
  newest-first by `(createdAt, id)`, including a UUID tie-breaker.
- **Admin identity.** Routes use hydrated platform roles. `admin` bypasses
  `requireCreatorPermission`; admin uploads create platform registrations with
  `creatorId = NULL`, admin browse/use sees all, and grant/revoke may manage any
  live asset.
- **Public immutable bytes, authenticated metadata.** The raw key route is
  public with one-year immutable caching. Upload/browse/get/delete/grant/revoke
  require auth and `editProfile` on the path creator.
- **Ownership remains a DB fact.** `isLibraryAssetKey` is only a structural
  classifier. `isRegisteredLibraryAsset` remains available for current
  owner-only surface validators; new shared surfaces use `canUseAsset`.

## API

Under `/api/creators` (auth + path creator `editProfile`):

- `POST /:creatorId/library/assets` — multipart `file` plus optional
  `sharing`; detect/hash, dedup blob, upsert inventory, upsert/reactivate the
  submitter registration; returns asset + `deduped`.
- `GET /:creatorId/library/assets` — browse own + shared pool with lossless
  keyset pagination and use status.
- `GET /:creatorId/library/assets/:id` — get one visible registration.
- `DELETE /:creatorId/library/assets/:id` — tombstone only the actor's own
  registration.
- `POST /:creatorId/library/assets/:id/grants` — owner/admin grants a
  `granteeCreatorId` on a requestable asset.
- `DELETE /:creatorId/library/assets/:id/grants/:granteeCreatorId` —
  owner/admin revokes the grant.

Outside creator scope:

- `GET /api/library/raw/*` — public immutable key-addressed bytes; registration
  tombstones do not affect delivery.

## Implementation units

### Shared contract

`packages/shared/src/content-library.ts` owns canonical key validation, sharing
and use-status enums, joined asset response schemas, upload/list responses, and
the grant request schema. It is re-exported from `packages/shared/src/index.ts`.

### Schema + migration

`apps/api/src/db/schema/library.schema.ts` defines the three-table model,
sharing enum, FKs, partial unique indexes, browse/grantee indexes, and
millisecond timestamp precision. Migration `0034_glorious_goliath.sql` was
generated from the schema after the dev-only old 0034 and tables were removed;
it creates only this model (plus its enum/indexes/FKs).

### Service

`apps/api/src/services/library.ts` owns detection, hash/key derivation, global
inventory, blob dedup, registration upsert/reactivation, browse visibility,
lossless pagination, get/delete, grant/revoke, `canUseAsset`, and the legacy
owner-registration primitive.

### Routes + delivery

`apps/api/src/routes/library.routes.ts` owns authenticated discovery and
sharing-management endpoints. `library-raw.routes.ts` and `library-url.ts`
retain key-addressed raw/imgproxy resolution. `apps/api/src/app.ts` mounts both
route groups.

## Acceptance criteria

- [x] Detected image bytes, not client MIME, determine identity and storage MIME.
- [x] Same bytes dedup globally while creators/admins receive distinct registrations.
- [x] Delete then re-upload reactivates the same registration id.
- [x] Private is hidden; open is browsable/usable; requestable is browsable but
      unusable until grant; revoke removes use; admin bypasses browse/use and
      may manage grants.
- [x] Browse/get/delete remain creator-permission protected; raw delivery is public.
- [x] Same-millisecond keyset boundaries do not skip registrations.
- [x] Blob inventory survives registration insertion failure and creator cascade deletion.
- [x] Garage distinguishes not-found from backend failure.
- [x] The clean 0034 migration creates the three tables and applies from 0033.

## Review (pass 1) findings + resolution

1. **Blocking — re-upload after delete conflicted with the tombstone's unique
   slot.** Resolved by selecting registrations regardless of tombstone and
   reactivating the matching row in place. Covered by unit and real-DB
   delete→re-upload regression tests.
2. **Blocking — PostgreSQL microseconds were truncated by JavaScript cursor
   serialization, skipping boundary rows.** Resolved with `timestamp(3)` for
   asset ordering and a `(createdAt, id)` cursor. Covered by a real-DB
   three-row same-millisecond pagination regression.
3. **Blocking — creator-owned rows were not a durable blob inventory.** Resolved
   by `content_blobs`, which has no creator FK and is committed before storage
   upload/asset insertion. Covered by a real Garage registration-FK-failure
   test proving both the unreferenced inventory row and object remain
   discoverable.
4. **Operator refinement — per-creator-only discovery could not represent
   controlled sharing.** Resolved by the three-table sharing model, joined
   browse/use status, grants, grant/revoke endpoints, and `canUseAsset`.

## Implementation notes

- Execution capability: inline direct-read implementation; the feature is one
  cohesive service/schema/API boundary, and the caller prohibited nested
  agents/peer review.
- Review weight: thorough, caller-supplied pass-1 blocker set; no additional
  independent pass because the caller explicitly prohibited nested agents.
- Files changed: shared contract/tests; library schema/migration; library
  service/routes; unit/route/integration tests; this item record.
- Tests added: tombstone reactivation, inventory-before-registration failure,
  sharing visibility/use/grant/revoke/admin cases, and same-millisecond cursor
  collision. Existing detection, storage-error, auth, dedup, raw-delivery, and
  round-trip coverage was preserved.
- Tests removed: none.
- Simplification: one joined asset response and one actor permission model now
  drive browse, get, use, grant, and revoke; no per-surface authorization copy.
- Discrepancies from earlier design: the per-creator single-table registry is
  superseded by the operator's global-blob + sharing-registration + grant model.
- Adjacent issues parked: none. Four unrelated known integration failures remain
  represented by existing backlog items and are not part of this feature.

## Integrated verification

- Clean schema generation: one `0034_glorious_goliath.sql` migration with the
  sharing enum, exactly three tables, their FKs, and indexes. Old dev tables and
  old 0034 migration record were removed first. `db:migrate` applied cleanly.
- Shared: **23 files / 711 tests passed**.
- API unit: **122 files / 1,947 tests passed** (library-focused: 2 files / 12 tests).
- Library real Postgres + Garage integration: **1 file / 4 tests passed**,
  covering raw byte round-trip, same/cross-creator dedup, private/open/requestable
  visibility and use, owner/admin grant+revoke, admin bypass, tombstone
  reactivation, same-millisecond pagination, creator-cascade inventory survival,
  and registration-failure inventory survival.
- Full API integration: **9 files / 42 tests passed; 4 unrelated known failures**
  remain in test-control gating (1) and channel-lifecycle FK fixtures (3), matching
  the existing parked failures the operator excluded from this feature.
- API TypeScript: `cd apps/api && npx tsc --noEmit` passed with zero errors;
  `bun run --filter @snc/api typecheck` also passed. The raw repository-root
  `npx tsc --noEmit` selects the root config and reports pre-existing web-test JSX
  configuration errors; it is not the package typecheck surface.
- API build command passed (the package intentionally reports that it runs via
  tsx and has no compilation build step).
- `git diff --check` passed.

## Risk / follow-up boundary

Physical byte reclamation remains deferred. A future mark-and-sweep enumerates
`content_blobs` and deletes rows/objects not referenced by any live surface;
this feature provides the durable inventory but does not implement the sweep.
The request UI for requestable assets is deferred to W2; this feature completes
the server-side owner/admin grant model.
