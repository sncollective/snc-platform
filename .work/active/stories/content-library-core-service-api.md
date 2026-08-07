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

# Content library core — service + API + resolver (Unit 3+4)

Unit 3 (service) + Unit 4 (routes + URL resolver) of the `content-library-core`
feature design (post design-review). Depends on `content-library-core-schema`.

## Scope

- `apps/api/src/services/library.ts`:
  - `deriveLibraryKey(sha256, detectedType)` — key from **detected** format, not client MIME.
  - `uploadLibraryAsset(creatorId, file)` — `image-size` on the bytes → reject if
    detected type ∉ {jpg,png,webp} (spoofed/unparseable) → sha256 → same-creator
    registration dedup (no storage call) → `storage.head(key)`: only a not-found
    variant means "upload", any other error fails → `storage.upload` if absent
    (skip on conflict) → `onConflictDoNothing` + re-select on the unique index →
    returns `{asset, deduped}` (`deduped` = existing registration/blob satisfied it).
  - `listLibraryAssets(creatorId, {limit, before})` — newest-first keyset on
    `(createdAt, id)`, `deletedAt IS NULL`, limit clamped `[1,100]` default 50;
    returns `ContentAssetList`.
  - `getLibraryAsset`, `deleteLibraryAsset` (soft-delete via `deletedAt`, double-keyed
    on id+owner, idempotent), `isRegisteredLibraryAsset(ownerCreatorId, storageKey)`
    (ownership = a non-tombstoned registration exists). All `Result<T,AppError>`.
  - `toContentAsset(row)` maps Drizzle rows (Date timestamps) → API shape via `toISO()`.
- `apps/api/src/routes/library.routes.ts` — CRUD under `/api/creators`:
  `POST /:creatorId/library/assets` (upload, auth+editProfile),
  `GET /:creatorId/library/assets` (list, `?limit&before`, auth+editProfile),
  `GET /:creatorId/library/assets/:id` (get, auth+editProfile),
  `DELETE /:creatorId/library/assets/:id` (soft-delete → 204, auth+editProfile).
  Per-route response schemas (POST→`ContentAssetUploadResponseSchema`, list→`ContentAssetListSchema`,
  get→`ContentAssetSchema`); `:id` validated as UUID; upload mirrors `handlePressPhotoUpload`.
- `apps/api/src/routes/library-raw.routes.ts` (or a sub-router registered at
  `app.route("/api/library", …)`) — **key-addressed** `GET /api/library/raw/*`:
  reconstruct `library/${splat}`, validate `isLibraryAssetKey`, `streamFile`,
  `Cache-Control: public, max-age=31536000, immutable`, **public** (no auth).
  Decoupled from registration lifetime (serves after soft-delete).
- `apps/api/src/lib/library-url.ts` — `libraryRawUrl(key)` (no-imgproxy fallback)
  + `resolveLibraryImage(key, widths)` (imgproxy via `buildImgproxyUrl`/`buildSrcSet`
  when configured, else the raw fallback). Consumers pick per-slot widths.

## Acceptance evidence

- [ ] Same bytes uploaded first as `image/jpeg` then relabeled `image/png` → **same** key.
- [ ] Re-upload identical bytes (same creator) → existing row, `deduped:true`, no `storage.upload`.
- [ ] Second creator, identical bytes → no second stored copy (`head` hit), second
      registration, same `storageKey`.
- [ ] Spoofed/allowed MIME but unparseable magic → rejected; detected type ∉ accepted → rejected.
- [ ] `head` non-not-found error → upload fails (no silent store).
- [ ] `deleteLibraryAsset` tombstones; list/get exclude it; `GET /api/library/raw/{ab}/{hash}.{ext}`
      still serves the bytes (public, immutable cache).
- [ ] `listLibraryAssets` paginates newest-first; `nextCursor` terminates.
- [ ] `isRegisteredLibraryAsset` true for owner, false for another creator / tombstone.
- [ ] Routes: happy-path upload/list/get/delete/raw + 401 (unauth) + 403 (wrong team).
- [ ] `bun run --filter @snc/api test:unit` + `test:integration` green; integration
      verifies **Garage's actual `HeadObject` miss error shape** (not-found classification)
      + the upload→dedup→list→get→delete round-trip incl. two-creator identical-bytes.

## Notes

- Byte-level GC is deferred by design (soft-delete preserves the blob inventory
  for a later mark-and-sweep owned by `content-library-migration` / ops). Do not
  add a reference table here.
- Buffer the upload (≤ `MAX_FILE_SIZES.image`) to hash + detect + read dims in one pass.
- The press ownership validator (evolved in `creator-press-page-v2-image-management`)
  calls `isRegisteredLibraryAsset` for library keys + `isOwnedPressKey` for legacy keys.
