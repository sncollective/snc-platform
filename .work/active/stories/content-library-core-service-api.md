---
id: content-library-core-service-api
kind: story
stage: implementing
tags: [media, content]
parent: content-library-core
depends_on: [content-library-core-schema]
release_binding: null
gate_origin: null
created: 2026-08-08
updated: 2026-08-08
---

# Content library core — service + API (Unit 3+4)

Unit 3 (service) + Unit 4 (routes) of the `content-library-core` feature design.
Depends on `content-library-core-schema` (the table + types).

## Scope

- `apps/api/src/services/library.ts` — `deriveLibraryKey(sha256, mime)`;
  `uploadLibraryAsset` (hash → same-creator registry dedup → cross-creator
  `storage.head()` dedup → `storage.upload` if new → `image-size` dims → insert
  with `onConflictDoNothing` + re-select on race → returns `{asset, deduped}`);
  `listLibraryAssets`, `getLibraryAsset`, `deleteLibraryAsset` (registry-row
  delete; byte GC deferred). All return `Result<T, AppError>`.
- `apps/api/src/routes/library.routes.ts` —
  `POST /:creatorId/library/assets` (upload, auth+editProfile),
  `GET /:creatorId/library/assets` (list, auth+editProfile),
  `GET /:creatorId/library/assets/:id` (get, auth+editProfile),
  `DELETE /:creatorId/library/assets/:id` (delete, auth+editProfile),
  `GET /:creatorId/library/assets/:id/raw` (stream bytes, public/optionalAuth).
  `describeRoute` + `validator` + `resolver(ContentAssetSchema)` on each.
  Registered in `app.ts` via `app.route("/api/creators", libraryRoutes)`.
- Upload handler mirrors `handlePressPhotoUpload` (Content-Length pre-check,
  `findCreatorProfile`, `requireCreatorPermission`, `parseBody`, MIME+size
  validation, buffer→`uploadLibraryAsset`). Raw stream uses `streamFile`.

## Acceptance evidence

- [ ] Re-upload identical bytes by the same creator → existing row, `deduped:true`,
      **no** `storage.upload` call (assert in unit test with a fake storage).
- [ ] Second creator uploading identical bytes → no second stored copy (`head` hit),
      second registry row, same `storageKey`.
- [ ] `width`/`height` populated for jpeg/png/webp; unparseable buffer → dims
      `null`, upload still succeeds.
- [ ] `deleteLibraryAsset` removes the registry row (double-keyed on id+owner);
      bytes retained.
- [ ] Routes: happy-path upload/list/get/delete/raw + 401 (unauth) + 403
      (wrong team) per the route-test convention.
- [ ] `bun run --filter @snc/api test:unit` + `test:integration` green; the
      integration test runs the upload→dedup→list→get→delete round-trip against
      dev Garage/Postgres including the two-creator identical-bytes case.

## Notes

- Byte-level GC is deferred by design (see feature `## Design decisions`); do not
  add a reference table here. Deleting a library entry removes the registry row only.
- Buffer the upload (≤ `MAX_FILE_SIZES.image`) to compute sha256 + dims in one pass.
