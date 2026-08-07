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
assetKey), list/get a creator's assets, and delete (soft-delete; physical byte
reclamation deferred to a later sweep). Built on the existing Garage `storage`
abstraction; imgproxy keeps resolving asset keys → responsive descriptors.

## Epic context
- Parent epic: `content-library`
- Position: **foundation feature** — every consumer (the UI, the migration, and
  downstream epics like `creator-press-page-v2` image-management) depends on it.

## Simplification opportunity
- Replaces per-surface image storage prefixes (`creators/{id}/{avatar|banner}`,
  `content/`, `creators/{id}/press/`) with one content-addressable store.
- Dedup is automatic (re-upload = no-op store).

## Foundation references
- Storage: `apps/api/src/storage/index.ts`, `provider.ts`, `packages/shared/src/storage.ts`
- Existing upload paths: `apps/api/src/routes/creator-media.routes.ts` (avatar/banner),
  `apps/api/src/routes/press.routes.ts` (press photos + ownership guard),
  `apps/api/src/routes/upload.routes.ts` + `apps/api/src/services/upload-completion.ts` (Uppy/tus content)
- imgproxy / URL resolution: `apps/api/src/lib/imgproxy.ts`, `apps/api/src/lib/creator-url.ts`
- ISO mapping helper convention: `apps/api/src/lib/response-helpers.ts` (`toISO()`)

## Architectural choice

**Per-creator asset registrations over globally-shared, immutable, content-addressable bytes.**

- **Registrations** (`content_assets` table): one row per `(ownerCreatorId, sha256)`.
  This is the browsable "my library" — each creator sees the assets they've
  introduced. Re-uploading identical bytes by the *same* creator is a registration
  no-op (dedup within a library).
- **Bytes**: stored once globally, keyed by content hash
  (`library/{ab}/{sha256}.{ext}`), where `{ext}` is derived from the **format
  detected from the bytes** (not the client-declared MIME). A `storage.head()`
  check before upload means identical bytes from a *different* creator never store
  a second copy (two registrations, one stored object). Because the key is a pure
  function of the bytes, content-addressability holds regardless of how the
  client labels the upload.

This honors the brief's **asset/reference split** — bytes live once on the asset;
per-use metadata (crop, alt, credit) lives on the *reference* in each surface's
content model. The library owns bytes + generic metadata; surfaces own per-use
metadata.

**Rejected alternatives:**
- *Global registry, one row per hash, single owner* — no per-creator "my library"
  view and awkward cross-creator ownership/deletion.
- *`content_asset_references` table for live refcount GC* — correct byte
  reclamation but high coupling (every surface — avatar/banner columns, press
  jsonb, content-media — must maintain it transactionally) and fragile to drift.
  Disproportionate for a foundation; deferred GC with a preserved inventory (below)
  is the proportionate path.

## Design decisions

- **Format detected from bytes, not client MIME.** `image-size` reads the magic
  bytes and returns `{ type, width, height }`. The accepted formats are exactly
  jpeg/png/webp (`ACCEPTED_MIME_TYPES.image`); the detected `type` must be one of
  those (else reject), and it drives both the stored `mimeType` and the key's
  extension. This is what makes the storage key a pure function of the bytes —
  the load-bearing content-addressability invariant (a JPEG relabeled as PNG by
  the client still keys identically to an honestly-declared JPEG).
- **Soft-delete (tombstone), not hard-delete.** Deleting a library entry sets
  `deletedAt` (the row stays); list/get exclude tombstones; key-addressed raw
  delivery is unaffected. This **preserves the blob inventory** so deferred GC is
  actually possible later: `StorageProvider` exposes no list operation, so once a
  blob's last registration were hard-deleted the DB would lose all knowledge of
  it and a sweep could not enumerate orphans. Tombstoning keeps every distinct
  `storageKey` enumerable. (A future sweep deletes tombstoned blobs whose key no
  surface references — that reference scan is owned by `content-library-migration`
  / an ops story.) **This revises the brief's "delete-with-refcount"**: logical
  removal now (disappears from the browse UI, can't be newly-referenced), physical
  reclamation deferred-but-possible. Flagged for operator confirmation; safe and
  reversible.
- **Ownership is an async DB lookup, not a prefix check.** The global key
  `library/{ab}/{hash}` embeds no creator, so `isLibraryAssetKey(key)` is only a
  **structural classifier** (canonical-key regex) — it cannot authorize. Real
  ownership = a `content_assets` row exists for `(ownerCreatorId, storageKey)`.
  The library service exposes `isRegisteredLibraryAsset(ownerCreatorId, key)`; the
  press-page ownership validator (evolved in `image-management`) calls it for any
  library key it encounters in a creator's press content (alongside `isOwnedPressKey`
  for legacy keys). Tenant isolation on list/get/delete is enforced by
  owner-scoped queries + `editProfile`.
- **Dimensions via `image-size`** (pure-JS, zero native deps, parses image
  headers from the buffered bytes — and gives format detection for free). Works
  in dev (no imgproxy) and tests (mocked storage); avoids `sharp`/libvips. Same
  call yields `{type, width, height}`.
- **Buffer the upload** (≤ `MAX_FILE_SIZES.image` = 10 MiB) to hash + detect +
  read dims in one pass, then stream the buffer to storage. 10 MiB in-memory per
  concurrent image upload is acceptable at this platform's scale (and the prod
  Caddy body cap sits just above it); avoids a hash-then-re-stream tee. No
  tus/multipart path for this bounded image library (large audio/video keep their
  own upload architecture).
- **Public raw-bytes read; owner-only metadata/write.** Once an asset is
  referenced on a public surface its bytes must be publicly streamable (same
  posture as avatar/banner/press-photo streaming). Upload/list/get/delete require
  auth + `requireCreatorPermission(..., "editProfile")`.
- **id via `randomUUID()`** (`node:crypto`) — the established id pattern.

## Implementation Units

### Unit 1: Shared contract — `packages/shared/src/content-library.ts`

**Story**: `content-library-core-schema`

```ts
import { z } from "zod";

/** Canonical storage key for a content-addressed asset: library/{ab}/{hash}.{ext}. */
export const LIBRARY_KEY_RE = /^library\/[0-9a-f]{2}\/[0-9a-f]{64}\.(jpg|png|webp)$/;

/** Structural classifier only — does NOT authorize ownership (key has no creator). */
export const isLibraryAssetKey = (key: string): boolean => LIBRARY_KEY_RE.test(key);

/** Strip the `library/` prefix to produce the path segment used by the raw route. */
export const libraryRawPath = (key: string): string =>
  isLibraryAssetKey(key) ? key.slice("library/".length) : "";

/** Accepted image formats, as detected from magic bytes by `image-size`. */
export const PressImageMimeSchema = z.enum(["image/jpeg", "image/png", "image/webp"]);

/** A registered media asset in a creator's library (content-addressable). */
export const ContentAssetSchema = z.object({
  id: z.string().uuid(),
  ownerCreatorId: z.string(),
  sha256: z.string().regex(/^[0-9a-f]{64}$/),
  storageKey: z.string().regex(LIBRARY_KEY_RE),
  mimeType: PressImageMimeSchema,
  size: z.number().int().nonnegative(),
  width: z.number().int().positive().nullable(),
  height: z.number().int().positive().nullable(),
  originalFilename: z.string().nullable(),
  createdAt: z.string().datetime(), // ISO via toISO()
});
export type ContentAsset = z.infer<typeof ContentAssetSchema>;

/** Upload response — `deduped` = an existing registration/blob satisfied the request. */
export const ContentAssetUploadResponseSchema = ContentAssetSchema.extend({
  deduped: z.boolean(),
});
export type ContentAssetUploadResponse = z.infer<typeof ContentAssetUploadResponseSchema>;

/** Paginated list response, newest-first by (createdAt, id). */
export const ContentAssetListSchema = z.object({
  items: z.array(ContentAssetSchema),
  nextCursor: z.string().nullable(), // opaque "{createdAtIso}|{id}" or null at end
});
export type ContentAssetList = z.infer<typeof ContentAssetListSchema>;
```

Re-export from `packages/shared/src/index.ts`. A `buildLibraryRawUrl(key)` helper
(returns `/api/library/raw/<libraryRawPath(key)>`) lives in the API's
`lib/library-url.ts` (Unit 4) since it depends on the API route prefix; shared
only carries the key classifier + path stripper.

**Acceptance Criteria**:
- [ ] `isLibraryAssetKey` accepts `library/ab/<64hex>.png`, rejects legacy
  `creators/x/press/y.jpg` and malformed library keys.
- [ ] `ContentAssetSchema` rejects a non-UUID id, non-hex/short sha256, and a
  non-canonical storageKey.

---

### Unit 2: Schema + migration — `apps/api/src/db/schema/library.schema.ts`

**Story**: `content-library-core-schema`

```ts
import { pgTable, text, integer, timestamp, uniqueIndex, index } from "drizzle-orm/pg-core";
import { creatorProfiles } from "./creator.schema.js";

/** Content-addressable media asset registration. One row per (owner, sha256). */
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
    deletedAt: timestamp("deleted_at", { withTimezone: true }), // tombstone (deferred GC)
  },
  (table) => [
    uniqueIndex("content_assets_owner_sha256_idx").on(table.ownerCreatorId, table.sha256),
    index("content_assets_owner_idx").on(table.ownerCreatorId),
  ],
);
```

Migration via `bun run --filter @snc/api db:generate` (drizzle.config globs
`./src/db/schema/*` — no barrel import needed; just create the file). Produces
the `CREATE TABLE content_assets ...` DDL (next seq after `0033`). **No data
backfill** — the table starts empty; existing per-surface images migrate in the
separate `content-library-migration` feature.

**Acceptance Criteria**:
- [ ] `db:generate` emits one `CREATE TABLE` migration; `db:migrate` applies clean.
- [ ] The unique index enforces same-creator dedup at the DB level.

---

### Unit 3: Library service — `apps/api/src/services/library.ts`

**Story**: `content-library-core-service-api`

```ts
import { createHash, randomUUID } from "node:crypto";
import { imageSize } from "image-size";
import { and, eq, lt, desc } from "drizzle-orm";
import { ok, type AppError, type Result } from "@snc/shared";

const TYPE_TO_EXT = { jpg: "jpg", png: "png", webp: "webp" } as const;
const TYPE_TO_MIME = { jpg: "image/jpeg", png: "image/png", webp: "image/webp" } as const;
const PAGE_LIMIT = 50, MAX_LIMIT = 100;

/** Derive the content-addressable key from sha256 + detected format. */
export const deriveLibraryKey = (sha256: string, type: "jpg" | "png" | "webp"): string =>
  `library/${sha256.slice(0, 2)}/${sha256}.${TYPE_TO_EXT[type]}`;

export const uploadLibraryAsset = (
  creatorId: string,
  file: { name?: string; declaredType: string; size: number; bytes: Uint8Array },
): Promise<Result<{ asset: ContentAsset; deduped: boolean }, AppError>>;

export const listLibraryAssets = (
  creatorId: string,
  opts?: { limit?: number; before?: { createdAt: Date; id: string } },
): Promise<Result<ContentAssetList, AppError>>; // excludes tombstones

export const getLibraryAsset = (
  creatorId: string, assetId: string,
): Promise<Result<ContentAsset, AppError>>; // excludes tombstones

/** Soft-delete (tombstone). Bytes retained; blob inventory preserved for deferred GC. */
export const deleteLibraryAsset = (
  creatorId: string, assetId: string,
): Promise<Result<void, AppError>>;

/** Ownership check: a non-tombstoned registration exists for (owner, key). */
export const isRegisteredLibraryAsset = (
  ownerCreatorId: string, storageKey: string,
): Promise<boolean>;
```

**Implementation Notes** (`uploadLibraryAsset`):
1. `const detected = imageSize(file.bytes)` — guard: if `!detected.type` or
   `detected.type ∉ {jpg,png,webp}` → `ValidationError` "unsupported or unrecognized
   image format". (Client `declaredType` is **not** used for keying; optionally
   log a mismatch.)
2. `sha256 = createHash("sha256").update(file.bytes).digest("hex")`.
3. `key = deriveLibraryKey(sha256, detected.type)`; `mimeType = TYPE_TO_MIME[type]`.
4. **Same-creator dedup**: select registration by `(ownerCreatorId, sha256)` with
   `deletedAt IS NULL`; if found, return it (`deduped: true`, no storage call).
5. **Cross-creator dedup**: `const h = await storage.head(key)`.
   - `h.ok` (present) → skip upload.
   - `!h.ok && h.error is a not-found variant` (NoSuchKey / the normalized
     not-found code — verify Garage's exact shape in integration) → upload.
   - `!h.ok && other error` → propagate (fail the upload); do **not** treat a
     backend error as "absent".
6. If uploading: `storage.upload(key, byteStream, { contentType: mimeType,
   contentLength: size })`; on failure, do **not** insert a registration.
7. Insert registration (`onConflictDoNothing` on `(ownerCreatorId, sha256)`); on
   conflict (concurrent same-creator race), re-select the winning row. Return
   `{ asset: toContentAsset(row), deduped: dedup }` where `deduped` = "an existing
   registration or blob satisfied the request" (true on same-creator hit,
   cross-creator head hit, or insert-conflict).

`toContentAsset(row)` maps the Drizzle row (timestamps → `Date`) to the API shape
via `toISO()` — the `ContentAssetSchema` is ISO strings, not `Date`s.

`deleteLibraryAsset`: `UPDATE ... SET deletedAt = now() WHERE id AND ownerCreatorId
AND deletedAt IS NULL` (double-keyed; idempotent). Bytes retained.

`listLibraryAssets`: newest-first keyset on `(createdAt, id)`; `limit` clamped to
`[1, MAX_LIMIT]`, default `PAGE_LIMIT`; `before` cursor → `WHERE (createdAt, id) < (before.createdAt, before.id)`;
filter `deletedAt IS NULL`. `nextCursor` = last item's `{createdAt}|{id}` or null.

`isRegisteredLibraryAsset`: `SELECT 1 FROM content_assets WHERE ownerCreatorId AND
storageKey AND deletedAt IS NULL LIMIT 1` → boolean.

**Acceptance Criteria**:
- [ ] Re-uploading identical bytes by the same creator returns the existing row
  (`deduped: true`) with **no** `storage.upload` (assert via fake storage).
- [ ] Identical bytes uploaded first as `image/jpeg` then as `image/png` (same
  bytes, relabeled) produce the **same** key (key derived from detected format).
- [ ] A second creator uploading identical bytes stores no second copy (`head` hit),
  creates a second registration, same `storageKey`.
- [ ] Bytes with a spoofed/allowed MIME but unparseable magic → rejected.
- [ ] `head` returning a non-not-found error fails the upload (no silent store).
- [ ] `deleteLibraryAsset` tombstones the row; list/get exclude it; raw delivery
  by key still serves the bytes.
- [ ] `listLibraryAssets` paginates newest-first; `nextCursor` terminates.
- [ ] `isRegisteredLibraryAsset` true for the owner, false for another creator or
  a tombstoned row.

---

### Unit 4: Library routes + URL resolver — `apps/api/src/routes/library.routes.ts`, `apps/api/src/lib/library-url.ts`

**Story**: `content-library-core-service-api`

```ts
export const libraryRoutes = new Hono<AuthEnv>();
// POST   /:creatorId/library/assets           — upload (auth, editProfile) → ContentAssetUploadResponse
// GET    /:creatorId/library/assets           — list (auth, editProfile) → ContentAssetList (supports ?limit&before)
// GET    /:creatorId/library/assets/:id       — get one (auth, editProfile) → ContentAsset
// DELETE /:creatorId/library/assets/:id       — soft-delete (auth, editProfile) → 204
// GET    /api/library/raw/*                   — stream bytes by key (public) — registered OUTSIDE /creators
```

The **raw route is key-addressed, not id-addressed**: `GET /api/library/raw/{ab}/{hash}.{ext}`
captures the splat, reconstructs `library/${splat}`, validates `isLibraryAssetKey`,
and streams via `streamFile` — independent of any registration row, so it keeps
serving after a soft-delete (consistent with deferred GC). Set
`Cache-Control: public, max-age=31536000, immutable` (content-addressed = immutable).
Register the raw route separately: `app.route("/api/library", libraryRawRoutes)`
(or a dedicated sub-router) so the `/api/library/raw/*` path doesn't nest under
`/api/creators`; the CRUD routes register under `app.route("/api/creators", libraryRoutes)`.

`apps/api/src/lib/library-url.ts` (the resolver consumers use):
```ts
import { isLibraryAssetKey, libraryRawPath } from "@snc/shared";
import { config } from "../config.js";
import { buildImgproxyUrl, buildSrcSet } from "./imgproxy.js";

/** No-imgproxy fallback URL for a library key (mirrors creator-url's fallback posture). */
export const libraryRawUrl = (key: string): string => `/api/library/raw/${libraryRawPath(key)}`;

/** Resolve a library key to a responsive image (src picks imgproxy or the raw fallback). */
export const resolveLibraryImage = (key: string, widths: readonly number[]) =>
  isLibraryAssetKey(key)
    ? {
        src: config.IMGPROXY_URL ? buildImgproxyUrl(key, widths[0]!) : libraryRawUrl(key),
        srcSet: config.IMGPROXY_URL ? buildSrcSet(key, widths) : undefined,
        sizes: undefined as string | undefined,
      }
    : null;
```
(The per-slot width selection is the consumer's concern — image-management picks
banner/member/gallery/cover-art widths; the foundation only provides the
key→URL primitives.)

**Implementation Notes**:
- Upload handler mirrors `handlePressPhotoUpload` (Content-Length pre-check →
  `findCreatorProfile` → `requireCreatorPermission` → `parseBody` → MIME/size
  pre-validate → buffer → `uploadLibraryAsset`).
- Per-route response schemas via `describeRoute` + `validator` + `resolver`:
  POST → `ContentAssetUploadResponseSchema`; GET list → `ContentAssetListSchema`;
  GET one → `ContentAssetSchema`; DELETE → 204 (no body); raw → binary
  (`application/octet-stream`). Do **not** use `ContentAssetSchema` for routes
  whose shape differs.
- `/:id` param validated as UUID.

**Acceptance Criteria**:
- [ ] Upload returns `ContentAssetUploadResponse`; a second identical upload is
  `deduped: true`.
- [ ] List paginates (`?limit`, `?before`); get/delete enforce `editProfile`
  (401 unauth, 403 wrong-team).
- [ ] `GET /api/library/raw/{ab}/{hash}.{ext}` streams the bytes publicly with
  immutable cache for a referenced key, and keeps working after the owning
  registration is soft-deleted.

---

## Implementation Order
1. `content-library-core-schema` — shared contract (Unit 1) + table/migration
   (Unit 2). Unblocks the type dependency for `creator-press-page-v2-image-management`.
2. `content-library-core-service-api` — service (Unit 3) + routes + resolver
   (Unit 4), depending on the schema.

## Simplification
- One content-addressable store retires the N× per-surface duplication going
  forward (existing duplication reclaimed by `content-library-migration`).
- The library is the single upload primitive future surfaces reuse; avatar/banner
  re-plumbing onto it is a later refactor, explicitly **out of scope** here.

## Testing
- **Unit (service, fake storage + mocked db)**: `deriveLibraryKey` shape + the
  format-detection gate (spoofed MIME, unparseable bytes); the dedup decision
  tree (same-creator registration hit → no upload; cross-creator head hit → no
  upload; non-not-found head error → fail); `image-size` parse failure → reject;
  tombstone excludes from list/get but raw key still resolvable; keyset pagination
  terminates; `isRegisteredLibraryAsset` owner scoping.
- **Integration (real storage + dev DB)**: the full upload→dedup→list→get→delete
  round-trip against dev Garage/Postgres, including: same-bytes-relabeled produces
  one key; two-creator identical-bytes → one stored object; raw delivery after
  soft-delete; **and verify Garage's actual `HeadObject` miss error shape** so the
  not-found classification is correct.
- **Route-layer**: happy-path upload/list/get/delete/raw + 401/403 per convention.
- **Test removal**: none — net-new.

## Risks
- **Deferred byte GC** (see Design decisions) — orphaned bytes accumulate; tombstoning
  preserves the inventory so a later mark-and-sweep is possible. The downstream
  `image-management` requirement ("removed objects GC'd, no orphans") is
  reconciled to mean *logical* removal now + *physical* reclamation by the sweep;
  confirm the wording during `image-management` design. **Operator to confirm.**
- **Garage `HeadObject` miss error shape** — verify in integration that the
  not-found classification matches the adapter's `NoSuchKey` handling; a wrong
  classification either skips a needed upload or fails on a benign miss.
- **Concurrent same-creator upload** races on the unique index; handled by
  `onConflictDoNothing` + re-select — covered by the integration test.

## Design review (2026-08-08)

Cross-model advisory review (`openai-codex/gpt-5.6-sol`) on the draft design.
Incorporated as blocking fixes: (1) key derived from **detected** format not
client MIME — content-addressability invariant; (2) ownership = async DB lookup,
`isLibraryAssetKey` demoted to structural classifier; (3) **key-addressed**
immutable raw route + `library-url.ts` resolver (decouples delivery from
registration lifetime, matches the no-imgproxy fallback pattern); (4) **soft-delete**
tombstone preserves the blob inventory so deferred GC stays possible. Should-fix
incorporated: `toContentAsset` ISO mapper + per-route response schemas; keyset
pagination; explicit `head()` not-found-vs-error handling; tighter canonical
validation (UUID id, hex sha256, MIME enum, key regex, ISO datetime); `deduped`
redefined as "existing registration/blob satisfied the request"; immutable
`Cache-Control`. Affirmed (not re-litigated): the per-creator/global split,
hash sharding, concurrent-dedup strategy, `image-size`, ≤10 MiB buffering,
public-bytes/owner-write posture, no public GET-by-hash, no presigned upload,
the per-use `{key,alt,credit}` metadata boundary. (One nit parked: prod Caddy
10 MB body cap vs the 10 MiB file limit + multipart overhead — align later.)
