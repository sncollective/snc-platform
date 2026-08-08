---
id: creator-press-page-v2-image-management-api
kind: story
stage: done
tags: [creators, content, ui]
parent: creator-press-page-v2-image-management
depends_on: [creator-press-page-v2-image-management-contract]
release_binding: null
gate_origin: null
created: 2026-08-07
updated: 2026-08-08
---

# Press↔library authorization + signed preview API (Unit 2)

Evolve the press write boundary from namespace-only ownership to the content library's live use authorization, and expose an authenticated signed-preview seam for the crop editor.

## Scope

- In `apps/api/src/routes/press.routes.ts`, make `validateOwnedPressKeys`
  asynchronous and collect keys from every image-bearing v2 field (`banner`,
  `aboutPhoto`, `members[].photo`, `highlights[].coverArt`, `gallery[]`) plus
  legacy `photos[]` and `releases[].artKey`.
- Accept a key when it is either in the creator's legacy press namespace or is a
  structurally valid `isLibraryAssetKey` for which `canUseAsset(actor, key)` is
  true. `canUseAsset` is the authoritative live-registration + owner/admin/open/
  granted check; do not duplicate it with an owner-only registration query.
  Reject unknown namespaces, tombstoned/unregistered keys, private foreign keys,
  and requestable-without-grant keys before `upsertPressConfig`.
- Build the `LibraryActor` from the resolved immutable creator id and hydrated
  platform roles, then `await validateOwnedPressKeys` in PATCH.
- Add authenticated `POST /api/creators/:creatorId/press/image-preview`, validated
  with Hono OpenAPI ceremony. Input is `{key,crop?,slot,width}` (width bounded to
  the supported preview range); output is the exact descriptor returned by
  `buildPressImageUrl`. Require `editProfile` and the same library use check before
  signing. The route does not mutate content or grant access.
- Keep the existing library upload/list/raw APIs unchanged.

## Acceptance evidence

- [ ] PATCH accepts own, admin, open, and granted library keys in every v2 image
      location and forwards the patch once authorization succeeds.
- [ ] PATCH rejects private foreign, requestable-without-grant, unregistered,
      tombstoned, malformed-library, and arbitrary foreign namespace keys without
      calling `upsertPressConfig`.
- [ ] Duplicate keys across slots trigger one authorization lookup per unique key.
- [ ] Legacy keys in `creators/{id}/press/` remain accepted while v1 is live;
      another creator's legacy key remains rejected.
- [ ] Preview returns a signed descriptor for an authorized key and exact crop/
      slot/width; unauthorized and unauthenticated requests return 403/401 and do
      not return a signed URL.
- [ ] Route tests include happy-path + auth failure; a focused integration test
      proves open/granted acceptance and private cross-creator denial against the
      real library registration model.

## Ordering

Depends on the shared crop/URL contract. The web crop editor and image controls consume this endpoint.

## Implementation notes

- Added one authorization service that collects every press image reference, de-duplicates storage keys, preserves field paths for validation errors, accepts owned legacy keys, and delegates structural library keys to the live `canUseAsset` policy.
- PATCH and signed-preview authorization use the resolved creator id plus hydrated admin role. The preview route validates crop, slot, and width before returning the exact `buildPressImageUrl` descriptor.
- Route coverage exercises every image-bearing field, duplicate lookup suppression, malformed/foreign denial, admin actor propagation, and preview 401/403/no-signing behavior. Real PostgreSQL/Garage integration coverage proves own/open/granted acceptance and private/requestable/tombstoned denial.
- Repaired the shared route-test auth middleware mock to hydrate roles like production `requireAuth`.

## Verification

- `bun run --filter @snc/api test:unit` — 124 files, 1,978 tests passed.
- `bun run --filter @snc/api test:integration -- tests/integration/library.test.ts` — 1 file, 7 tests passed.
- `cd apps/api && npx tsc --noEmit` — passed with zero diagnostics.
