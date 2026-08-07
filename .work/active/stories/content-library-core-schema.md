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

Unit 1 (shared contract) + Unit 2 (schema + migration) of the
`content-library-core` feature design. The type/table checkpoint every other
consumer waits on.

## Scope

- `packages/shared/src/content-library.ts` — `ContentAssetSchema` (+type),
  `ContentAssetUploadResponseSchema` (+type, with `deduped`), `isLibraryAssetKey`.
  Re-exported from `packages/shared/src/index.ts`.
- `apps/api/src/db/schema/library.schema.ts` — `contentAssets` table
  (`id`, `ownerCreatorId` FK→creatorProfiles cascade, `sha256`, `storageKey`,
  `mimeType`, `size`, `width?`, `height?`, `originalFilename?`, `createdAt`;
  unique `(ownerCreatorId, sha256)`, index `ownerCreatorId`). Imported into the
  drizzle schema barrel so `db:generate` sees it.
- Generated migration via `bun run --filter @snc/api db:generate` (next seq after
  `0033`); `db:migrate` applies clean on dev.

## Acceptance evidence

- [ ] `ContentAssetSchema` parses a registry-row projection; `isLibraryAssetKey`
      discriminates `library/...` from legacy per-surface keys.
- [ ] `db:generate` emits exactly one `CREATE TABLE content_assets` migration;
      `db:migrate` applies clean; the unique index is present (`\d+ content_assets`).
- [ ] `bun run --filter @snc/shared test` + `--filter @snc/api test:unit` green.

## Notes

- No data backfill — table starts empty. Existing per-surface images migrate in
  `content-library-migration`.
- Dimensions come from `image-size` at upload time (Unit 3); the columns are
  nullable so the table can exist before the service lands.
