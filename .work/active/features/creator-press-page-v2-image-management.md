---
id: creator-press-page-v2-image-management
kind: feature
stage: review
tags: [creators, content, ui]
parent: creator-press-page-v2
depends_on: [creator-press-page-v2-content-model, content-library-core]
release_binding: null
gate_origin: null
created: 2026-08-07
updated: 2026-08-08
---

# Press page v2 — image management & picker

## Brief
The image pipeline for the v2: upload that **accepts a size range** per slot
(doesn't reject), a **crop/section picker** so the user chooses the right portion
for each predetermined slot's aspect (banner 3:1, band photo, member photos,
cover art, gallery), per-image **credits** (stored on the image object, burned-in
on display), and the **photo-editor fix** — remove/replace actually changes the
image, the preview reflects local (unsaved) state, and removed objects get
garbage-collected (no orphans).

## Epic context
- Parent epic: `creator-press-page-v2`
- Position: consumer of the content-model image objects; the editor-v2 feature
  uses this pipeline.

## Simplification opportunity
- Fixes the live v1 photo-editor bug (remove→reupload doesn't change; preview
  reads saved config not local state; orphaned Garage objects on remove).
- Replaces the v1 bare-key photo handling + the indexed-stream endpoint with the
  object-based pipeline + crop picker.

## Foundation references
- v1 photo path: `apps/api/src/routes/press.routes.ts` (photo upload/stream),
  `apps/web/src/routes/creators/$creatorId/manage/press.tsx` (editor photo UI)
- Storage: `apps/api/src/storage/index.js`, imgproxy (`apps/api/src/lib/imgproxy.ts`)
- `.mockups/design-system/tokens.css`

## Mockups
- Public image slots and credit/caption treatment inherit the locked
  `.mockups/screens/creator-press-page/final-{1,3}.html`: banner 3:1, about 4:5,
  member/cover 1:1, gallery 4:3.
- No new screen mock is added here. The full editor composition remains W3's
  deferred UI surface; this feature pins editor-agnostic control contracts and
  behavior, not the manage-page layout. AF photos are not delivered and all
  slots ship empty.

## Mapping note

Direct-read design: the shared press/content-library contracts, library service
and routes, imgproxy signer, current press routes/manage editor, and their unit +
integration tests expose the relevant seams without exploratory fan-out.
Platform has domain foundation docs (`docs/creators.md`, `docs/content.md`) rather
than `VISION.md`/`SPEC.md`/`ARCHITECTURE.md`; those domain docs and the parent epic
are the standing constraints for this feature.

## Design decisions

- **Crop persistence**: store one normalized crop rectangle on each `PressImage`
  reference; never create a derived image — one immutable library asset can carry
  different crops in different slots.
- **Picker interaction**: use a fixed-aspect viewport with pan + zoom and keyboard
  nudging, implemented with local geometry rather than adding a crop dependency —
  this directly matches a section picker, keeps the output model exact, and avoids
  an external component contract for one bounded interaction.
- **Preview and delivery split**: manipulate the raw/original image locally for
  responsive feedback, then debounce an authenticated signed-preview request
  using the exact eventual imgproxy path — the browser never receives signing
  secrets. `buildPressImageUrl` remains API-only; the parallel templates feature
  consumes it from its API-side public-payload/PDF resolver and hands descriptors
  to web templates rather than reimplementing signing in `@snc/web`.
- **Authorization authority**: `canUseAsset` is the press write boundary for
  library keys because it already combines live registration, owner, admin, open,
  and grant state. `isRegisteredLibraryAsset` remains the owner-only compatibility
  primitive and is not redundantly queried.
- **Library browse scope**: the press picker exposes own + shared-pool results from
  the existing list endpoint. `requestable-needs-grant` assets are visible but
  disabled; request/grant UX remains `content-library-ui`.
- **Alt and credit**: `PressImage.alt` remains structurally required but the shared
  schema continues accepting legacy empty alt strings. New controls require a
  nonblank alt before Apply. Blank credit normalizes to `null`; templates render
  the stored credit.
- **Dimension posture**: slot ratio and source dimensions never reject an otherwise
  valid library image. The picker shows non-blocking softness/size guidance and
  always lets the creator crop; the existing format and 10 MB library limits are
  the upload boundary.
- **Live v1 bridge**: the current editor switches to immutable library keys now and
  saves v2 `gallery` plus transitional bare-key `photos`. The indexed GET route
  remains only until the locked v2 templates/editor stop consuming it; the old
  namespace-keyed POST upload is removed in this feature.
- **Removal semantics**: removing a press reference does not tombstone the reusable
  library registration. New uploads therefore cannot become press-only orphans;
  byte-level GC remains the content-library lifecycle already designed.

## Architectural options

### Option A — reference metadata + client crop + signed preview endpoint (chosen)

Keep original bytes in the content library, persist a normalized rectangle on the
press reference, perform pan/zoom geometry in the browser, and ask the API to sign
the exact render path for confirmation/delivery. This optimizes reuse, responsive
feedback, and one delivery contract; it adds one narrow authenticated preview
endpoint.

### Option B — server-render a cropped derivative on every Apply

Upload/select the source, send pixel coordinates to the API, and write a second
Garage object per slot. Preview and public output would be simple, but it defeats
deduplication, couples crops to one output resolution, creates cleanup/reference
counting work, and contradicts the imgproxy render-time crop seam. Rejected.

### Option C — persist only a focal point

Store `{x,y}` and let imgproxy infer the largest slot crop. This is smaller and
simple, but cannot preserve a creator's chosen zoom/section; two crops with the
same center but different framing collapse. Rejected because editorial section
selection is the feature's core behavior.

**Choice**: Option A. The crop rectangle is a per-use editorial decision, the
library key remains the immutable source, and `buildPressImageUrl` is the single
server-side interpretation of both.

## Implementation Units

### Unit 1: Shared crop contract and slot-aware imgproxy builder
**Files**: `packages/shared/src/press.ts`, `packages/shared/tests/press.test.ts`,
`apps/api/src/lib/imgproxy.ts`, `apps/api/tests/lib/imgproxy.test.ts`
**Story**: `creator-press-page-v2-image-management-contract`

```ts
// packages/shared/src/press.ts
export const PressImageCropSchema = z.object({
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  width: z.number().positive().max(1),
  height: z.number().positive().max(1),
}).refine(({ x, width }) => x + width <= 1)
  .refine(({ y, height }) => y + height <= 1);

export type PressImageCrop = z.infer<typeof PressImageCropSchema>;

export const PressImageSchema = z.object({
  key: z.string().min(1),
  alt: z.string(),
  credit: z.string().nullable().optional(),
  crop: PressImageCropSchema.optional(),
});

export type PressImageSlot = {
  banner: "3/1";
  about: "4/5";
  member: "1/1";
  gallery: "4/3";
  cover: "1/1";
};

export const PRESS_IMAGE_SLOT_RATIOS = {
  banner: "3/1",
  about: "4/5",
  member: "1/1",
  gallery: "4/3",
  cover: "1/1",
} as const satisfies PressImageSlot;

export const PressImageSlotSchema = z.enum([
  "banner", "about", "member", "gallery", "cover",
]);
export type PressImageSlotName = keyof PressImageSlot;
```

```ts
// apps/api/src/lib/imgproxy.ts
export function buildPressImageUrl(
  image: PressImage,
  slot: keyof PressImageSlot,
  width: number,
): { src: string; srcSet: string; sizes: string };
```

**Implementation notes**:
- Parse the ratio from the shared registry and derive
  `outH = round(width * ratioDenominator / ratioNumerator)`; validate positive
  integer width before building a path.
- Crop present emits
  `c:<cropW>:<cropH>:fp:<x+width/2>:<y+height/2>/rs:fill:<outW>:<outH>:0/g:ce`.
  Crop absent emits `rs:fill:<outW>:<outH>:0/g:ce`.
- Normalize float segments to six decimal places and trim trailing zeros so
  equivalent editor output shares cache keys. imgproxy interprets `1` as one
  absolute source pixel: map an exact normalized full-axis width/height to `0`,
  its documented full-source sentinel.
- Build the complete processing/source path before calling existing `signPath`.
  Return `src` at the requested maximum width plus `srcSet` candidates at
  quarter, half, and full width (de-duplicated, minimum 160px). Return `sizes`
  from a slot registry aligned to the locked CSS: banner `100vw`; about
  `(max-width: 760px) 100vw, 360px`; member `(max-width: 760px) 50vw, 240px`;
  gallery `(max-width: 480px) 84vw, (max-width: 760px) 45vw, 300px`; cover
  `(max-width: 480px) 92px, 145px`. The parallel templates feature's API-side
  public-payload/PDF resolver calls this exact export; web template components
  consume returned descriptors and never import API config or reproduce signing.

**Acceptance criteria**:
- [ ] `PressImage` round-trips valid optional normalized crop metadata while
      invalid/out-of-bounds rectangles fail at the shared boundary.
- [ ] Every slot produces the exact pinned output ratio and path order; every
      `srcSet` candidate preserves the same crop and varies only output size.
- [ ] The returned `sizes` values match the locked 760px/480px responsive slots.
- [ ] Crop center, full-axis sentinel, float canonicalization, and HMAC coverage
      have focused unit examples.
- [ ] Existing width-only imgproxy callers remain unchanged.

---

### Unit 2: Press↔library authorization and signed preview route
**Files**: `apps/api/src/routes/press.routes.ts`,
`apps/api/tests/routes/press.test.ts`, `apps/api/tests/integration/library.test.ts`
**Story**: `creator-press-page-v2-image-management-api`

```ts
type PressKeyReference = {
  readonly path: string;
  readonly key: string;
};

function collectPressKeyReferences(
  patch: z.infer<typeof PressConfigPatchSchema>,
): PressKeyReference[];

async function validateOwnedPressKeys(
  patch: z.infer<typeof PressConfigPatchSchema>,
  actor: LibraryActor,
): Promise<void>;

const PressImagePreviewRequestSchema = z.object({
  key: z.string().min(1),
  crop: PressImageCropSchema.optional(),
  slot: PressImageSlotSchema,
  width: z.number().int().min(160).max(3840),
});
```

**Implementation notes**:
- Collect from `banner`, `aboutPhoto`, `members[].photo`,
  `highlights[].coverArt`, `gallery[]`, plus legacy `photos[]` and
  `releases[].artKey`. De-duplicate keys before authorization but preserve paths
  for an actionable validation error.
- For each key: owned legacy press prefix passes; a structural library key must
  pass `canUseAsset(actor,key)`; everything else fails. `canUseAsset` already
  proves a live registration, so do not make an owner-only
  `isRegisteredLibraryAsset` query first.
- Build `actor = {creatorId: profile.id, isAdmin: roles.includes("admin")}` and
  await validation before persistence. This preserves creator-team permission as
  the first mutation gate.
- `POST /:creatorId/press/image-preview` uses `requireAuth`, creator resolution,
  `requireCreatorPermission(...,"editProfile",roles)`, param/json validators,
  and the same library-key authorization before calling
  `buildPressImageUrl({key,alt:"",crop},slot,width)`.

**Acceptance criteria**:
- [ ] PATCH accepts own/admin/open/granted library keys in every image-bearing
      field and still accepts this creator's legacy press keys.
- [ ] PATCH rejects private foreign, requestable-without-grant, tombstoned,
      unregistered, malformed-library, and foreign legacy keys without writing.
- [ ] Preview returns the exact signed descriptor for authorized inputs and no
      descriptor for 401/403 cases.
- [ ] Route-level happy/auth tests and a real-library cross-creator integration
      test protect the seam.

---

### Unit 3: Crop geometry and controlled section picker
**Files**: `apps/web/src/lib/press-image-crop.ts`,
`apps/web/src/lib/press-images.ts`,
`apps/web/src/components/press/press-crop-editor.tsx`,
`apps/web/src/components/press/press-crop-editor.module.css`,
`apps/web/tests/unit/lib/press-image-crop.test.ts`,
`apps/web/tests/unit/components/press/press-crop-editor.test.tsx`
**Story**: `creator-press-page-v2-image-management-crop-editor`

```ts
export type CropSourceSize = { width: number; height: number };
export type CropCenter = { x: number; y: number };

export function fitSlotCrop(
  source: CropSourceSize,
  slot: PressImageSlotName,
): PressImageCrop;

export function cropFromViewport(input: {
  source: CropSourceSize;
  slot: PressImageSlotName;
  center: CropCenter;
  zoom: number;
}): PressImageCrop;

export interface PressCropEditorProps {
  readonly creatorId: string;
  readonly imageKey: string;
  readonly sourceWidth: number | null;
  readonly sourceHeight: number | null;
  readonly slot: PressImageSlotName;
  readonly slotLabel: string;
  readonly initialCrop?: PressImageCrop;
  readonly onApply: (crop: PressImageCrop) => void;
  readonly onCancel: () => void;
}
```

**Implementation notes**:
- The largest fitting base rect is source-ratio-aware: wide sources constrain
  height; tall sources constrain width. Zoom `>=1` divides both normalized base
  dimensions. Clamp the center so the rectangle never leaves source space.
- Render the original via `/api/library/raw/${libraryRawPath(key)}` inside a
  fixed-aspect viewport. Pointer drag moves center; arrow keys nudge; +/- changes
  zoom; Reset restores centered base crop. No canvas pixel reads or client-side
  signed URL construction.
- Debounce/abort `POST .../press/image-preview` and render its returned `src` as
  the authoritative output preview. Local movement stays instant; a failed
  signed preview is recoverable and never destroys crop state.
- Use existing Ark Dialog primitives; return focus to the opener and support a
  complete keyboard path.

**Acceptance criteria**:
- [ ] Pure geometry stays in-bounds and ratio-correct for all slots, extreme
      sources, zoom, pan, and prior-crop restoration.
- [ ] Apply emits normalized source coordinates; Cancel has no side effect.
- [ ] Server preview input exactly matches the latest crop; stale responses are
      ignored.
- [ ] Pointer and keyboard users can complete the same operation.

---

### Unit 4: Library source chooser, alt/credit, and reusable image field
**Files**: `apps/web/src/lib/content-library.ts`,
`apps/web/src/components/press/press-image-picker.tsx`,
`apps/web/src/components/press/press-image-picker.module.css`,
`apps/web/src/components/press/press-image-field.tsx`,
`apps/web/src/components/press/press-image-field.module.css`,
`apps/web/src/components/press/index.ts`,
`apps/web/tests/unit/components/press/press-image-picker.test.tsx`,
`apps/web/tests/unit/components/press/press-image-field.test.tsx`
**Story**: `creator-press-page-v2-image-management-controls`

```ts
export interface PressImageFieldProps {
  readonly creatorId: string;
  readonly label: string;
  readonly slot: PressImageSlotName;
  readonly value: PressImage | null;
  readonly onChange: (image: PressImage | null) => void;
}

export interface PressImagePickerProps {
  readonly creatorId: string;
  readonly slot: PressImageSlotName;
  readonly initialImage?: PressImage;
  readonly onApply: (image: PressImage) => void;
  readonly onCancel: () => void;
}

export async function uploadContentLibraryImage(
  creatorId: string,
  file: File,
): Promise<ContentAssetUploadResponse>;

export async function fetchContentLibraryImages(
  creatorId: string,
  before?: string,
  signal?: AbortSignal,
): Promise<ContentAssetList>;
```

**Implementation notes**:
- One dialog offers Upload new / Your library / Shared pool. Derive views from
  `creatorId`, `useStatus`, and `creatorId` on list results; paginate with the
  existing cursor. No grant mutation is added.
- Upload calls existing `POST /:creatorId/library/assets` with private sharing,
  then flows through the same crop/alt/credit step as a reused asset.
- `own`, `admin`, `open`, and `granted` rows are selectable.
  `requestable-needs-grant` is visible but disabled with explanatory copy and a
  route/link seam for the future rich library UI.
- The field is controlled: local unsaved replace/remove is visible immediately.
  Require `alt.trim()` on Apply; normalize `credit.trim() || null`; keep crop on
  the `PressImage` reference. Dimension mismatch only warns.
- These components know press slots and image metadata but not members,
  highlights, gallery ordering, template selection, or form persistence. W3 owns
  that editor wiring; templates own public credit overlay/caption rendering.

**Acceptance criteria**:
- [ ] Upload returns/references a `library/...` storage key; no press namespace
      object is created.
- [ ] Own/shared browse and `canUse` status produce the exact selectable/disabled
      behavior.
- [ ] Every slot launches the exact pinned ratio; alt is required; credit and
      crop remain per reference.
- [ ] Empty, error, pagination, failed thumbnail, and failed preview states are
      recoverable and accessible.

---

### Unit 5: Live v1 bridge and remove→replace regression
**Files**: `apps/web/src/routes/creators/$creatorId/manage/press.tsx`,
`apps/web/src/lib/press.ts`,
`apps/web/tests/unit/routes/creators/manage/press-manage.test.tsx`,
`apps/api/src/routes/press.routes.ts`, `apps/api/tests/routes/press.test.ts`
**Story**: `creator-press-page-v2-image-management-legacy-bridge`

```ts
// Transitional editor state; W3 later owns the complete v2 form composition.
const [gallery, setGallery] = useState<PressImage[]>([]);

// Transitional save while the v1 public page still consumes photos[].
const imagePatch: Pick<PressConfigPatch, "gallery" | "photos"> = {
  gallery,
  photos: gallery.map(({ key }) => key),
};
```

**Implementation notes**:
- Initialize from the API's normalized `gallery`. Replace the current file input
  and index-addressed previews with controlled library image fields/list controls.
  Save explicit empty arrays after removing all images so legacy normalization
  cannot repopulate them.
- Remove `uploadPressPhoto` and `POST /press/photos`; all new image bytes enter via
  `uploadLibraryAsset`.
- Keep the indexed GET route as a compatibility bridge only while v1 is live.
  It may stream an owned legacy key or redirect an authorized library key to the
  immutable raw route. Do not expose foreign/private keys. The templates/editor
  feature removes the last indexed consumer when it replaces v1 in place.
- The regression case uses changed bytes under the same filename: content hashing
  produces a new key, and the unsaved controlled preview uses that key. Identical
  bytes correctly dedupe to the same image.
- A removed reference remains a library item rather than triggering storage
  deletion; this is reuse, not an orphan. Existing legacy press objects are left
  to the content-library migration/GC arc rather than being deleted on design.

**Acceptance criteria**:
- [ ] Remove image A → upload changed bytes named like A → preview image B before
      save → PATCH sends B's key in `gallery` and transitional `photos`.
- [ ] Remove-all persists explicit `gallery:[]` and `photos:[]`.
- [ ] The live public page still renders authorized legacy and transitional
      library photos until W3/templates land.
- [ ] No web caller or API POST remains for namespace-keyed press upload.

## Implementation Order

1. `creator-press-page-v2-image-management-contract` — shared crop and signed URL contract.
2. `creator-press-page-v2-image-management-api` — authorization + preview boundary.
3. `creator-press-page-v2-image-management-crop-editor` — pure geometry + controlled crop UI.
4. `creator-press-page-v2-image-management-controls` — library source chooser + alt/credit field.
5. `creator-press-page-v2-image-management-legacy-bridge` — wire only the live photo slice and prove the regression.

The feature remains one cohesive implementation/review bundle; stories are
ordered acceptance checkpoints, not five independent ownership assignments.

## Simplification

- Delete the namespace-keyed press POST upload helper/route/handler after the
  library-backed bridge has no caller.
- Stop previewing unsaved state through `photos/:index`; immutable key previews
  remove the saved-config/index coupling that caused the live bug.
- Do not add derived crop objects, a crop dependency, a press-specific asset
  table, or duplicate grant logic.
- Retain the indexed GET route only for the verified live v1 consumer. Its final
  deletion belongs to W3/templates when they replace that consumer, rather than
  breaking v1 early.
- No standalone cleanup/refactor story is warranted; the safe deletion is
  cohesive with the legacy bridge.

## Testing

- **Shared schema examples** protect normalized bounds and legacy additive parsing.
- **Imgproxy unit tests** protect the most error-prone contract: slot height,
  crop center, full-axis `0` sentinel, segment order, float stability, and signing.
- **Press route tests** enumerate every image-bearing field and prove own/admin/
  open/granted acceptance versus private/requestable/unregistered/foreign denial;
  one integration case uses real registrations/grants.
- **Pure crop geometry tests** cover ratio/zoom/clamping without brittle DOM pixel
  assertions. Component tests protect keyboard/pointer behavior and stale signed
  preview handling.
- **Picker/field tests** protect upload→storageKey, library browse useStatus gating,
  required alt, optional credit, controlled replace/remove, and failure states.
- **Regression test** uses two different byte payloads with the same filename and
  proves local preview + saved payload switch keys. It does not assert that
  byte-identical uploads create a new key, because dedup is correct behavior.
- Remove old tests whose only contract is the retired namespace-keyed POST upload.
  Keep indexed GET tests while the compatibility consumer remains.
- Implementation verification: shared tests/typecheck, API unit + focused real
  library integration, web tests/typecheck, then full project unit suites.

## Risks

- **imgproxy normalized full-axis trap**: `c:1:…` means one pixel. The builder's
  `1 → 0` canonicalization and a dedicated test are mandatory.
- **Crop UI/server drift**: client geometry and server URL interpretation could
  disagree. Both consume one shared slot registry, and the signed rendered preview
  is the acceptance view before Apply.
- **Stale async preview**: drag/zoom can race responses. Abort prior requests and
  gate commits by request id; local crop state never depends on response order.
- **Revoked shared use after publication**: `canUseAsset` gates selection and every
  PATCH, but the current library model does not automatically rewrite existing
  press JSON when a grant is later revoked. This is a cross-feature lifecycle
  decision, flagged below rather than hidden in this feature.
- **No-imgproxy environments**: crop metadata still persists and raw images remain
  available, but a pixel-identical signed preview requires imgproxy configuration.
  The editor must show a recoverable unavailable state, not fabricate a crop URL.
- **Transitional dual write**: `gallery` and `photos` can drift if only one is
  updated. The bridge derives both from one local `gallery` state and W3 removes
  the legacy write when v1 is replaced.
- **Library UI overlap**: this picker intentionally stops at browse/select and
  requestable-disabled messaging. Keep request/grant management out so
  `content-library-ui` can own it without a second policy surface.

## Operator flags (non-blocking before implementation starts)

1. **Interaction pattern**: the design selects fixed-frame pan/zoom rather than a
   resizable crop rectangle. It is dependency-free and keyboardable, but it is a
   user-facing interaction choice; change it before Unit 3 if handles are preferred.
2. **Quality guidance copy**: the design pins warnings as non-blocking but does not
   invent marketing-facing per-slot pixel ranges. Confirm exact recommended copy/
   thresholds during W3 visual alignment; authorization and crop behavior do not
   depend on them.
3. **Grant revocation**: decide with `content-library-ui` whether revoking a grant
   should (a) preserve already-published references, (b) block revocation while
   referenced, or (c) remove/hide downstream references. This feature guarantees
   authorization at choose/save time only.

## Pre-mortem

The most likely production failure is a crop that looked correct in the editor
but renders differently in a template because browser pixel geometry was saved
or the builder interpreted a full normalized dimension as one pixel. The design
avoids pixel persistence, centralizes slot ratios, canonicalizes full axes, and
requires the signed eventual render before Apply. If the custom gesture layer
proves unreliable, keep the pure normalized geometry and replace only the UI
adapter with a verified crop library; neither storage nor API contracts change.
The least-certain area is shared-use revocation after a reference is already
published, because that lifecycle is not specified by the current library model.

## Implementation summary

Execution stayed with one direct host worker, per the explicit no-delegation boundary, and carried all child checkpoints in dependency order:

1. `creator-press-page-v2-image-management-contract` — consumed the completed shared crop/slot and server URL contract from `44cc9e4` without reimplementation.
2. `creator-press-page-v2-image-management-api` — completed at `6ab6195`: all-field de-duplicated press/library authorization, signed preview route, real own/open/granted/private/requestable/tombstoned integration proof, and hydrated-role test-fixture repair.
3. `creator-press-page-v2-image-management-crop-editor` — completed at `dca7231`: normalized source-aware crop geometry, fixed-frame pan/zoom editor, pointer/keyboard parity, and stale-safe debounced signed preview.
4. `creator-press-page-v2-image-management-controls` — completed at `c363589`: private library upload, own/shared reuse picker, access-status gating, pagination/recovery, required alt/normalized credit, non-blocking size guidance, and controlled image field.
5. `creator-press-page-v2-image-management-legacy-bridge` — completed at `a01533c`: live manage editor moved to controlled `gallery`, transitional `photos` dual-write, remove→same-name changed-byte regression, passive-grandfather indexed library redirect, and retirement of namespace-keyed POST upload.

No stored derivatives, press-specific asset table, client signing secret, grant mutation, active revocation cleanup, or AF seed image was introduced. Every slot supports an explicit empty state. New edits use `canUseAsset`; already-published references remain passive-grandfathered through public immutable raw delivery.

## Integrated verification

- Shared: no build script exists; `bun run --filter @snc/shared test` passed — 23 files, 723 tests.
- API unit: `bun run --filter @snc/api test:unit` passed — 124 files, 1,976 tests.
- Web unit: `bun run --filter @snc/web test` passed — 182 files, 1,866 tests.
- Type safety: `bun run --filter @snc/web typecheck` and `cd apps/api && npx tsc --noEmit` both passed with zero diagnostics.
- Feature-focused real services: library integration passed — 1 file, 7 tests, including press own/open/granted acceptance and private/requestable/tombstoned denial.
- Full API integration baseline: 46 passed / the same 4 pre-existing failures identified by the operator (three channel-lifecycle creator-profile FK fixtures; one test-control missing-secret message assertion). No feature-related integration failure appeared.
- UI: visually checked actual crop, picker, selected field, and empty field states at 1280×900 and 390×844; no horizontal overflow, off-edge media, duplicated content, or unreadable narrow controls. Keyboard/pointer behavior is covered by component tests. Exact grep confirms `press@s-nc.org` in the touched manage regression and no `press@snc.org` typo.
- `git diff --check` passed. AF photo slots remain empty-capable.

## Review handoff

Review should prioritize authorization completeness across every nested image field, normalized crop math versus `buildPressImageUrl`, stale preview races, Ark dialog focus behavior, and the transitional `gallery`/`photos` single-state derivation. The four full-integration baseline failures are unrelated and intentionally unchanged.
