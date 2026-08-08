---
id: creator-press-page-v2-image-management-api
kind: story
stage: implementing
tags: [creators, content, ui]
parent: creator-press-page-v2-image-management
depends_on: [creator-press-page-v2-image-management-contract]
release_binding: null
gate_origin: null
created: 2026-08-07
updated: 2026-08-07
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
