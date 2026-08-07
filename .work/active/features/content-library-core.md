---
id: content-library-core
kind: feature
stage: implementing
tags: [media, content]
parent: content-library
depends_on: []
release_binding: null
gate_origin: null
created: 2026-08-07
updated: 2026-08-08
---

# Content library — asset store + registry + API (foundation)

## Brief
The foundation: a **content-addressable asset store** (asset key = content hash
→ automatic dedup: same bytes uploaded anywhere = one stored copy), an **asset
registry** (metadata: hash, MIME, dimensions, size, owner creator, uploaded
timestamp), and the **library API** — upload (hash → store-once → return
assetKey), list/get a creator's assets, and delete with reference-counting (only
GC an asset when no surface references it). Built on the existing Garage
`storage` abstraction; imgproxy keeps resolving asset keys → responsive
descriptors.

## Epic context
- Parent epic: `content-library`
- Position: **foundation feature** — every consumer (the UI, the migration, and
  downstream epics like `creator-press-page-v2` image-management) depends on it.

## Simplification opportunity
- Replaces per-surface image storage prefixes (`creators/{id}/{avatar|banner}`,
  `content/`, `creators/{id}/press/`) with one content-addressable store.
- Dedup is automatic (re-upload = no-op store).

## Foundation references
- Storage: `apps/api/src/storage/index.ts`
- Existing upload paths: `apps/api/src/routes/creator-media.routes.ts` (avatar/banner),
  `apps/api/src/routes/upload.routes.ts` + `apps/api/src/services/upload-completion.ts` (Uppy/tus content)
- imgproxy: `apps/api/src/lib/imgproxy.ts`, `apps/api/src/lib/creator-url.ts`

## Architectural choice

**Per-creator asset registry rows + globally-shared content-addressable bytes.**

- **Registry** (`content_assets` table): one row per `(ownerCreatorId, sha256)`.
  This is the browsable "my library" — each creator sees the assets they've
  introduced. Re-uploading identical bytes by the *same* creator is a registry
  no-op (dedup within a library).
- **Bytes**: stored once globally, keyed by content hash
  (`library/{ab}/{sha256}.{ext}`). A `storage.head()` check before upload means
  identical bytes from a *different* creator never store a second copy (two
  registry rows, one stored object).

This split honors the brief's **asset/reference split** — bytes live once on
the asset; per-use metadata (crop, alt, credit) lives on the *reference* in each
surface's content model (the press-page v2 `{key, alt, credit}` image objects,
the avatar/banner columns, content-media). The library only owns bytes + generic
metadata; surfaces own their per-use metadata.

**Rejected alternatives:**
- *Global registry, one row per hash, single owner* — simpler table, but gives
  no per-creator "my library" view (the browse/reuse UX needs it) and makes
  cross-creator ownership/deletion semantics awkward.
- *`content_asset_references` table for true refcount GC* — robust byte
  reclamation, but high coupling (every surface — avatar/banner columns, press
  jsonb, content-media — must maintain it) and fragile to drift. Disproportionate
  for a foundation feature; see the GC decision below.

## Design decisions

- **Byte-level GC is deferred (delete = remove the registry row only).** The
  brief names "delete-with-refcount"; true cross-surface reference-counting is
  fragile (references are scattered across columns and jsonb arrays) and
  out-of-proportion for a foundation. Dedup already guarantees bytes are *never
  duplicated*, so the only cost of not reclaiming is bounded orphaned bytes.
  Deleting a library entry removes the registry row (so it disappears from the
  browse UI and can't be newly-referenced); physical byte reclamation is a
  separate, idempotent sweep that can land later (the `content-library-migration`
  feature or an ops story will need a full reference scan anyway). **This is the
  one decision that changes a stated brief requirement** — flagged for operator
  confirmation; safe and reversible (a later GC sweep scans key-bearing surfaces
  and deletes unreferenced bytes).
- **Dimensions via `image-size`** (pure-JS, zero native deps, parses image
  headers from the buffered bytes). Works in dev (no imgproxy) and in tests
  (mocked storage); avoids a `sharp`/libvips native dependency just to read
  width/height. Reversible — swap to imgproxy `/info` later if desired.
- **Buffer the upload** (≤ `MAX_FILE_SIZES.image` = 10 MiB) to compute sha256 +
  read dimensions in one pass, then stream the buffer to storage. 10 MiB
  in-memory per concurrent image upload is acceptable; avoids a
  hash-then-re-stream tee.
- **Public raw-bytes read; owner-only write.** Once an asset is referenced on a
  public surface (a press page), its bytes must be publicly streamable — same
  posture as the existing avatar/banner/press-photo streaming endpoints. Upload,
  list, get-metadata, and delete require auth + `requireCreatorPermission(..., "editProfile")`.
- **id via `randomUUID()`** (`node:crypto`) — the established id-generation
  pattern in this codebase (`channels`, `editorial-config`, `playout`).

## Implementation Units

### Unit 1: Shared contract — `packages/shared/src/content-library.ts`

**Story**: `content-library-core-schema`

```ts
import { z } from "zod";

/** A registered media asset in a creator's library (content-addressable). */
export const ContentAssetSchema = z.object({
  id: z.string(),
  ownerCreatorId: z.string(),
  sha256: z.string().length(64),
  storageKey: z.string(),
  mimeType: z.string(),
  size: z.number().int().nonnegative(),
  width: z.number().int().positive().nullable(),
  height: z.number().int().positive().nullable(),
  originalFilename: z.string().nullable(),
  createdAt: z.string(), // ISO timestamp
});
export type ContentAsset = z.infer<typeof ContentAssetSchema>;

/** The shape returned by an upload (dedup hit returns the existing asset). */
export const ContentAssetUploadResponseSchema = ContentAssetSchema.extend({
  deduped: z.boolean(), // true when bytes were already present (no store)
});
export type ContentAssetUploadResponse = z.infer<typeof ContentAssetUploadResponseSchema>;

/** True when a storage key belongs to the shared content-addressable namespace. */
export const isLibraryAssetKey = (key: string): boolean => key.startsWith("library/");
```

Re-export from `packages/shared/src/index.ts` (`export * from "./content-library.js";`).

**Implementation Notes**:
- `storageKey` is opaque to consumers; they carry it as `key` in their
  per-surface image objects. `isLibraryAssetKey` is the ownership-validator hook
  the press-page image-management feature will use alongside `isOwnedPressKey`.
- No default-content object (unlike press) — assets are created by upload, not
  defaulted.

**Acceptance Criteria**:
- [ ] `ContentAssetSchema` parses a registry row; `z.infer` matches the table's
  `$type<>` projection.
- [ ] `isLibraryAssetKey("library/ab/abcd.png")` is true; false for
  `creators/x/press/y.jpg`.

---

### Unit 2: Schema + migration — `apps/api/src/db/schema/library.schema.ts`

**Story**: `content-library-core-schema`

```ts
import { pgTable, text, integer, timestamp, uniqueIndex, index } from "drizzle-orm/pg-core";
import type { ContentAsset } from "@snc/shared";
import { creatorProfiles } from "./creator.schema.js";

/** Content-addressable media asset registry. One row per (owner, sha256). */
export const contentAssets = pgTable(
  "content_assets",
  {
    id: text("id").primaryKey(),
    ownerCreatorId: text("owner_creator_id")
      .notNull()
      .references(() => creatorProfiles.id, { onDelete: "cascade" }),
    sha256: text("sha256").notNull(),
    storageKey: text("storage_key").notNull(),
    mimeType: text("mime_type").notNull(),
    size: integer("size").notNull(),
    width: integer("width"),
    height: integer("height"),
    originalFilename: text("original_filename"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("content_assets_owner_sha256_idx").on(table.ownerCreatorId, table.sha256),
    index("content_assets_owner_idx").on(table.ownerCreatorId),
  ],
);
```

Migration via `bun run --filter @snc/api db:generate` (drizzle-kit produces the
`CREATE TABLE content_assets ...` DDL; the next sequence number after `0033`).
**No data backfill** — the table starts empty; existing per-surface images are
migrated onto the store by the separate `content-library-migration` feature.

Import the new schema into the drizzle `schema` barrel so drizzle-kit sees it
(the file the `db:generate` config globs — confirm the barrel at design-review).

**Acceptance Criteria**:
- [ ] `db:generate` emits one `CREATE TABLE` migration; `db:migrate` applies clean
  against the dev database.
- [ ] The unique index enforces same-creator dedup at the DB level.

---

### Unit 3: Library service — `apps/api/src/services/library.ts`

**Story**: `content-library-core-service-api`

```ts
import { createHash, randomUUID } from "node:crypto";
import imageSize from "image-size";
import { eq, and } from "drizzle-orm";
import { ok, type AppError, type Result } from "@snc/shared";
import { db } from "../db/connection.js";
import { contentAssets } from "../db/schema/library.schema.js";
import { storage } from "../storage/index.js";

const MIME_TO_EXT: Record<string, string> = {
  "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp",
};

/** Derive the content-addressable storage key from a sha256 + MIME. */
export const deriveLibraryKey = (sha256: string, mimeType: string): string =>
  `library/${sha256.slice(0, 2)}/${sha256}.${MIME_TO_EXT[mimeType] ?? "bin"}`;

export const uploadLibraryAsset = (creatorId: string, file: {
  name?: string; type: string; size: number; bytes: Uint8Array;
}): Promise<Result<{ asset: ContentAsset; deduped: boolean }, AppError>>;

export const listLibraryAssets = (creatorId: string): Promise<Result<ContentAsset[], AppError>>;

export const getLibraryAsset = (
  creatorId: string, assetId: string,
): Promise<Result<ContentAsset, AppError>>;

export const deleteLibraryAsset = (
  creatorId: string, assetId: string,
): Promise<Result<void, AppError>>; // removes registry row; byte GC deferred
```

**Implementation Notes** (`uploadLibraryAsset`):
1. Compute `sha256 = createHash("sha256").update(file.bytes).digest("hex")`.
2. `key = deriveLibraryKey(sha256, file.type)`.
3. **Same-creator dedup**: select registry by `(ownerCreatorId, sha256)`; if a row
   exists, return it with `deduped: true` (no storage call).
4. **Cross-creator dedup**: `storage.head(key)`; if missing, `storage.upload(key,
   byteStream, { contentType, contentLength })`. If present, skip the upload.
5. `const dim = imageSize(file.bytes)` → `{ width, height }` (guarded; `null` on
   parse failure so a novel format never blocks upload).
6. Insert registry row with `onConflictDoNothing` on the unique index; on conflict
   (concurrent same-creator upload), re-select and return `deduped: true`.
7. Return `{ asset, deduped: crossOrSameDedup }` — `deduped` is true whenever no
   bytes were written (same-creator registry hit OR cross-creator head hit).

`deleteLibraryAsset`: delete the registry row where `id` AND `ownerCreatorId`
(double-keyed so a leaked id can't cross-delete). Bytes retained (GC deferred).

**Acceptance Criteria**:
- [ ] Re-uploading identical bytes by the same creator returns the existing row
  with `deduped: true` and performs **no** `storage.upload`.
- [ ] Uploading identical bytes by a *second* creator stores no second copy
  (`head` hit) and creates a second registry row pointing at the same `storageKey`.
- [ ] `width`/`height` populated for jpeg/png/webp; upload still succeeds (dims
  `null`) for an unparseable image buffer.
- [ ] `deleteLibraryAsset` removes the registry row; the stored bytes remain.

---

### Unit 4: Library routes — `apps/api/src/routes/library.routes.ts` (+ register)

**Story**: `content-library-core-service-api`

```ts
export const libraryRoutes = new Hono<AuthEnv>();
// POST   /:creatorId/library/assets        — upload (auth, editProfile)
// GET    /:creatorId/library/assets        — list owner assets (auth, editProfile)
// GET    /:creatorId/library/assets/:id    — get one asset (auth, editProfile)
// DELETE /:creatorId/library/assets/:id    — delete registry row (auth, editProfile)
// GET    /:creatorId/library/assets/:id/raw — stream bytes (optionalAuth, public)
```

Register in `apps/api/src/app.ts`: `app.route("/api/creators", libraryRoutes);`
(alongside `creatorMediaRoutes` / `pressRoutes`).

**Implementation Notes**:
- Upload handler mirrors `handlePressPhotoUpload` / `handleImageUpload`:
  Content-Length pre-check → `findCreatorProfile` → `requireCreatorPermission` →
  `parseBody` → MIME + size validation (`ACCEPTED_MIME_TYPES.image`,
  `MAX_FILE_SIZES.image`) → buffer to `Uint8Array` → `uploadLibraryAsset`.
- `describeRoute` + `validator` + `resolver(ContentAssetSchema)` on every route
  per the platform's explicit route-handler ceremony.
- The raw stream uses `streamFile(c, storage, key, ...)` (same helper the
  avatar/banner/press endpoints use) after resolving the registry row → key.

**Acceptance Criteria**:
- [ ] Upload returns 200 with `ContentAssetUploadResponse`; a second identical
  upload returns `deduped: true`.
- [ ] List/get/delete enforce `editProfile` permission; unauthenticated list → 401,
  wrong-team → 403.
- [ ] Raw stream returns the bytes with a correct content-type for a referenced
  asset (public, no auth required).

---

## Implementation Order
1. `content-library-core-schema` — shared contract (Unit 1) + table/migration
   (Unit 2). Unblocks the type dependency for `creator-press-page-v2-image-management`.
2. `content-library-core-service-api` — service (Unit 3) + routes (Unit 4),
   depending on the schema.

## Simplification
- One content-addressable store retires the N× per-surface duplication going
  forward (existing duplication is reclaimed by `content-library-migration`).
- The library is the single upload primitive future surfaces reuse; avatar/banner
  re-plumbing onto it is a later refactor, explicitly **out of scope** here (this
  feature ships the store + API; it does not migrate live surfaces).

## Testing
- **Unit (service, fake storage + mocked db)**: `deriveLibraryKey` shape; the
  dedup decision tree — same-creator registry hit (no upload), cross-creator head
  hit (no upload), genuine new asset (upload + insert); `image-size` parse failure
  → dims null but upload succeeds. These are the genuinely non-obvious branches.
- **Integration (real storage + dev DB)**: the full upload→dedup→list→get→delete
  round-trip against the dev Garage/Postgres, including a two-creator identical-bytes
  scenario asserting one stored object.
- **Route-layer**: auth/permission boundaries (happy path + 401/403) per the
  "every route needs happy-path + auth-failure tests" convention.
- **Test removal**: none — this is net-new.

## Risks
- **Deferred byte GC** (see Design decisions) — orphaned bytes accumulate (bounded
  by dedup: each unique image ≤ one orphan). Mitigation: a later idempotent sweep;
  `content-library-migration` already needs a reference scan. **Operator to
  confirm** this scoping is acceptable.
- **Concurrent same-creator upload** of identical bytes races on the unique index;
  handled by `onConflictDoNothing` + re-select, but verify in the integration test.
- **`image-size` on an unusual/zero-byte payload** — guarded to `null` dims rather
  than throwing; MIME validation runs first so non-images never reach it.
