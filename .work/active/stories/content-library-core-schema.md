---
id: content-library-core-schema
kind: story
stage: implementing
tags: [media, content, schema]
parent: content-library-core
depends_on: []
release_binding: null
gate_origin: null
created: 2026-08-08
updated: 2026-08-08
---

# Content library core — shared contract + registry table (Unit 1+2)

Unit 1 (shared contract) + Unit 2 (schema + migration) of the `content-library-core`
feature design (post design-review). The type/table checkpoint every other consumer
waits on.

## Scope

- `packages/shared/src/content-library.ts`:
  - `LIBRARY_KEY_RE = /^library\/[0-9a-f]{2}\/[0-9a-f]{64}\.(jpg|png|webp)$/`,
    `isLibraryAssetKey(key)` (**structural classifier only — does not authorize**),
    `libraryRawPath(key)` (strips `library/` for the raw route).
  - `PressImageMimeSchema = z.enum(["image/jpeg","image/png","image/webp"])`.
  - `ContentAssetSchema` with strict fields: `id` (UUID), `ownerCreatorId`,
    `sha256` (64-hex regex), `storageKey` (LIBRARY_KEY_RE), `mimeType` (enum),
    `size`, `width?/height?` (nullable), `originalFilename?`, `createdAt` (ISO datetime).
  - `ContentAssetUploadResponseSchema` (extends with `deduped: boolean`),
    `ContentAssetListSchema` (`{ items[], nextCursor: string|null }`).
  - Re-exported from `packages/shared/src/index.ts`.
- `apps/api/src/db/schema/library.schema.ts` — `contentAssets` table:
  `id` PK, `ownerCreatorId` FK→creatorProfiles cascade, `sha256`, `storageKey`,
  `mimeType`, `size`, `width?`, `height?`, `originalFilename?`, `createdAt` defaultNow,
  **`deletedAt?`** (tombstone for deferred GC); unique `(ownerCreatorId, sha256)`,
  index `ownerCreatorId`. drizzle.config globs `./src/db/schema/*` — no barrel import.
- Generated migration via `bun run --filter @snc/api db:generate` (next seq after `0033`);
  `db:migrate` applies clean on dev. No data backfill (table starts empty).

## Acceptance evidence

- [ ] `isLibraryAssetKey` accepts `library/ab/<64hex>.png`, rejects legacy
      `creators/x/press/y.jpg` and malformed keys; `libraryRawPath` round-trips.
- [ ] `ContentAssetSchema` rejects non-UUID id, short/non-hex sha256, off-canonical
      storageKey, non-enum mimeType.
- [ ] `db:generate` emits exactly one `CREATE TABLE content_assets` (with `deleted_at`);
      `db:migrate` applies clean; unique index + owner index present.
- [ ] `bun run --filter @snc/shared test` + `--filter @snc/api test:unit` green.

## Notes

- `deletedAt` is the tombstone that makes deferred GC possible — do not omit it.
- Dimensions (`width`/`height`) are nullable so the table can exist before the
  service lands; they're populated at upload via `image-size`.
- Ownership validation is **not** a prefix check — the service exposes
  `isRegisteredLibraryAsset` (DB lookup); see the sibling service-api story.
