---
id: drop-image-size-magicbyte-header-dims
kind: feature
stage: done
tags: [security, media-pipeline, content]
parent: null
depends_on: []
release_binding: null
gate_origin: null
created: 2026-08-11
updated: 2026-08-11
---

# Drop image-size — magic-byte format + in-house header dimensions

## Brief

`image-size` (resolved 2.0.2 in `@snc/api`, a direct dep) carries two unfixed
**high-severity DoS advisories** — GHSA-w3rx-r6r6-pgpr (ICNS parser infinite
loop) and GHSA-5p2g-fcmc-qvqq (JXL/HEIF parser infinite loops). There is **no
upstream fix**: 2.0.2 is the latest published release. The vulnerable parsers
run during format auto-detection, *before* our jpg/png/webp acceptance check, so
a crafted ICNS/JXL/HEIF fed to `imageSize()` hangs the API process. The throw
never happens — it's an infinite loop — so the existing try/catch around
`imageSize()` does not help.

The exploitable surface is **`apps/api/src/services/library.ts` `detectImage()`**
— the content-library ingest path. Any authenticated creator uploading a crafted
image can trigger a single-process DoS. (`press-pdf.ts` also calls `imageSize()`
but on already-validated images — not a new surface.)

Replace `image-size` with in-house logic that keeps the public surface identical
(same accepted formats, same content-addressable key scheme, same stored dims,
same API responses) while removing the vulnerable JS parsers entirely:

1. **Format → magic-byte detection** (jpg/png/webp magic; reject everything else
   before any header read beyond the magic). No deps, no DoS surface.
2. **Dimensions → in-house header parser** for the three accepted formats (png /
   webp at fixed offsets; jpg via a bounds-checked, file-size-bounded SOF-marker
   scan). This is header parsing, not pixel decode — the same thing `image-size`
   does — and it **never invokes the ICNS/JXL/HEIF parsers** (the vulnerable
   ones). Persist width/height to the existing `content_blobs` columns as today.

This also *is* the advisory fix: the vulnerable `image-size` parsers leave the
stack completely, so no `--ignore` suppression / backlog mitigation is needed for
these two CVEs.

## Design pivot (2026-08-11)

The originally-scoped dimensions mechanism was **imgproxy `/info`**. A design
probe (2026-08-11) found imgproxy `/info` is **Pro-only**: the platform runs the
OSS image `ghcr.io/imgproxy/imgproxy:v3.31`, where both the `/info` endpoint and
the `info:1` processing option return 404 (verified live against `snc-imgproxy`;
normal signed processing URLs are healthy). The operator greenlit the pivot to an
**in-house header parser**. This is strictly better than the `/info` plan: it
adds **no new runtime dependency** (the `/info` plan would have coupled ingest
availability to imgproxy) and removes the ingest chicken-and-egg (dims now come
from the same in-memory bytes as format, before storage).

## Strategic decisions

Locked in the scoping conversation (2026-08-11); dimensions-source revised in the
pivot above. Inherited by `feature-design`:

- **Store dimensions, do not compute on demand.** `content_blobs` are immutable
  (sha256-keyed) → stored dims can never drift/stale. The columns already exist
  and are populated today; switching the source to the in-house parser is a
  drop-in with zero downstream change. The hot reader is the web client
  (aspect-ratio layout on every render via `library.ts` returning
  `blob.width`/`height`) — on-demand computation per render is impractical. Ingest
  parses the bytes anyway, so computing dims once-ever at ingest is the cheapest
  place; dedup skips repeats.
- **Format via magic-byte, dims via in-house header parse — both from the same
  in-memory bytes, before storage.** With no external parser, there is no
  chicken-and-egg: the content-addressable key (`library/{ab}/{sha256}.{ext}`)
  gets its extension from the magic byte, and dims come from the same buffer, all
  pre-S3-put. Flow: bytes → magic-byte format + header dims → sha256 → derive key
  → S3 put → write blob row (with dims).
- **press-pdf reads stored dims** (not `imageSize()`). For library-asset keys the
  dims are already on the blob. Legacy pre-library press keys (which may lack
  stored dims) fall back to an in-house header parse of the stored bytes — never
  re-introducing `image-size`.
- **Drop `image-size` entirely** (dep + the `.claude/skills/image-size/SKILL.md`
  reference). No external image parser is added; imgproxy remains the
  render/transform layer only.

## Simplification opportunity

- **Delete** the `image-size` dependency and the `.claude/skills/image-size/SKILL.md`
  skill.
- **Delete** the `imageSize()` call in `press-pdf.ts` (replaced by a stored-dims
  read + legacy in-house header fallback).
- **No new parser dependency** — dims come from a small, owned, bounds-checked
  header reader. imgproxy's role is unchanged (render/transform only).
- **Retain** the content-addressable key scheme (format in key) and the
  jpg/png/webp-only acceptance — unchanged.

## Context for feature-design

Call sites (verified 2026-08-11):

- `apps/api/src/services/library.ts`
  - `detectImage(bytes)` (~L165–178) — current `imageSize()` use; returns
    `{ type: DetectedType; width; height }`, accepts jpg/png/webp only.
  - `TYPE_TO_EXT` / `TYPE_TO_MIME` (L~34–43) — the format → ext/mime maps the
    magic-byte detector must feed.
  - `deriveLibraryKey(sha256, type)` (L58) — bakes the extension into the
    content-addressable key.
  - ingest caller (~L248–275) — stores `width`/`height` on the blob.
- `apps/api/src/db/schema/content.schema.ts:35–36` — `content_blobs.width`/`height`.
- `apps/api/src/services/press-pdf.ts:189` — `imageSize(readImageBuffer(key))`
  for the 300ppi print-quality warning (the redundant re-parse).
- `apps/api/src/lib/imgproxy.ts` — URL generation only; **unchanged by this
  feature** (no `/info` client added).

Design notes to resolve in `feature-design`:
- The header parser module shape (a single `detectImage(bytes)` replacement
  returning `{ type; width; height }` keeps `library.ts` minimal). Place under
  `apps/api/src/lib/` (e.g. `image-detect.ts`).
- Per-format header reads:
  - **png** — width/height at IHDR (bytes 16–23, big-endian).
  - **webp** — RIFF…WEBP + VP8/VP8L/VP8X chunk dims.
  - **jpg** — scan markers (0xFF…) to the SOF (Start Of Frame); width/height
    follow. **Bounds-checked and bounded by `MAX_FILE_SIZES.image`** — a crafted
    jpg can force at most O(file-size) marker scanning, no infinite loop.
- Magic-byte scope: jpg (`FF D8 FF`), png (`89 50 4E 47 0D 0A 1A 0A`), webp
  (`RIFF….WEBP`). Explicit rejection of everything else is the security guarantee.
- Graceful handling of malformed/truncated headers (return the format from the
  magic byte + null dims, or reject — make a deliberate choice; null-dims is
  acceptable since dims are best-effort metadata, format is the identity).
- Tests: magic-byte + header detection (accept + correct dims per format; reject
  non-matching magic), ingest end-to-end (format + dims populated via the new
  path), press-pdf stored-dims read + legacy header fallback, and a **regression
  that a crafted non-jpg/png/webp magic is rejected before any header parse**, and
  that a truncated jpg yields bounded work (no hang).

## Design decisions

- **Header-parser module shape**: Export one `detectImage(bytes)` boundary from
  `apps/api/src/lib/image-detect.ts`; it performs the allowlisted magic-byte
  classification first, then dispatches only to private jpg/png/webp dimension
  readers. Keeping format and dimensions inseparable makes it structurally hard
  for a caller to run a parser before the format allowlist.
- **Malformed or truncated accepted-format headers**: Return the detected
  allowlisted format with `width: null` and `height: null`. Dimensions are
  best-effort nullable metadata, while the byte signature is the storage identity;
  this keeps malformed work bounded without turning metadata extraction into a
  second format gate. Press rendering requires concrete positive dimensions and
  therefore omits an unvalidated image rather than guessing.
- **JPG work bound**: Scan no farther than
  `min(bytes.byteLength, MAX_FILE_SIZES.image)`, require bounds before every
  multi-byte read, reject invalid/zero segment lengths, and ensure every loop path
  advances or exits. This makes adversarial marker scanning at most O(10 MiB).
- **Execution topology**: Direct-read design and one cohesive inline feature
  implementation. The touched integration points and tests are bounded and share
  one detector contract, so exploratory fan-out would add handoff cost without
  resolving a named unknown.

## Architectural choice

Use one small owned detector module with private per-format readers and a single
public result type. `detectImage(bytes)` returns `null` only when the initial bytes
do not match jpg/png/webp; once magic matches, it returns the format plus either a
positive dimension pair or null dimensions. Library ingest maps the `null` format
case to its existing `ValidationError`; press PDF reads stored dimensions for
library keys and calls the same detector only for legacy stored bytes.

Two alternatives were rejected. Separate public `detectFormat` and
`readDimensions` functions would make it possible for a future caller to parse
before enforcing the allowlist, weakening the security invariant. A registry of
codec/parser objects would add extension machinery for a deliberately closed
three-format set without improving the bounded reads.

## Implementation units

### Unit 1: Allowlisted image detector

**Files**:
- `apps/api/src/lib/image-detect.ts`
- `apps/api/tests/lib/image-detect.test.ts`

**Story**: `drop-image-size-magicbyte-header-dims-detector`

```ts
export type DetectedImageType = "jpg" | "png" | "webp";
export type DetectedImage = {
  type: DetectedImageType;
  width: number | null;
  height: number | null;
};

export const detectImage = (bytes: Uint8Array): DetectedImage | null;
```

**Implementation notes**:
- Check jpg/png/webp magic before dispatching to any dimension reader; all other
  signatures return `null` immediately.
- PNG reads a valid IHDR at bytes 8–23. WebP handles VP8, VP8L, and VP8X first
  chunks with chunk-size and buffer bounds checks. JPG scans length-delimited
  markers to a supported SOF and stops at SOS/EOI or malformed input.
- Readers never throw for attacker-controlled bytes. A recognized signature with
  a missing, malformed, zero, or out-of-range dimension pair returns null dims.

**Acceptance criteria**:
- [ ] Synthetic jpg/png and all three WebP headers report the exact dimensions.
- [ ] ICNS, JXL, HEIF, and arbitrary bytes return `null` at the magic boundary.
- [ ] Truncated JPG and zero/invalid segment lengths return promptly, and a
  maximum-size marker stream cannot exceed the configured scan bound.

### Unit 2: Library ingest rewiring

**Files**:
- `apps/api/src/services/library.ts`
- `apps/api/tests/services/library.test.ts`
- `apps/api/tests/integration/library.test.ts`

**Story**: `drop-image-size-magicbyte-header-dims-library-ingest`

```ts
const detected = detectImage(file.bytes);
if (!detected) {
  return err(new ValidationError("Unsupported or unrecognized image format"));
}
```

**Implementation notes**:
- Remove the service-local `imageSize()` wrapper and use the detector result for
  extension, MIME, and stored dimensions before storage is touched.
- Keep size enforcement, sha256 key derivation, dedup behavior, storage ordering,
  database columns, and response shapes unchanged.

**Acceptance criteria**:
- [ ] Relabeled PNG bytes still produce a `.png` key and `image/png` metadata.
- [ ] The content-blob write receives the detector's width and height.
- [ ] Unsupported magic is rejected before database or storage work.

### Unit 3: Press PDF stored dimensions and legacy fallback

**Files**:
- `apps/api/src/services/press-pdf.ts`
- `apps/api/tests/services/press-pdf.test.ts`

**Story**: `drop-image-size-magicbyte-header-dims-press-pdf`

```ts
type ImageDimensions = { width: number; height: number };

const loadPrintImageDimensions = async (
  key: string,
): Promise<ImageDimensions>;
```

**Implementation notes**:
- Library keys query `content_blobs` by storage key and require positive stored
  width/height; they do not download and reparse immutable blob bytes.
- Legacy owned press keys download at most `MAX_FILE_SIZES.image` bytes and use
  `detectImage`; missing dims raise `ValidationError` inside the existing
  render-without-image catch boundary.

**Acceptance criteria**:
- [ ] A library key uses stored dimensions without a storage download.
- [ ] A legacy key uses the in-house detector on downloaded bytes.
- [ ] Missing, oversized, malformed, or unavailable image metadata preserves the
  existing warning-and-omit behavior.

### Unit 4: Remove the vulnerable dependency surface

**Files**:
- `apps/api/package.json`
- `bun.lock`
- `.claude/skills/image-size/SKILL.md` (delete)
- `apps/api/tests/integration/content-library-migration.test.ts`
- `packages/shared/src/content-library.ts`

**Story**: `drop-image-size-magicbyte-header-dims-remove-dependency`

**Implementation notes**:
- Replace the integration test's output-dimension assertion with the owned
  detector, remove stale source commentary, then remove the direct dependency,
  lockfile nodes, and obsolete skill.
- Preserve the root `resolutions.nanoid: "^5.1.16"` entry and its resolved
  lockfile version exactly.

**Acceptance criteria**:
- [ ] No source, test, manifest, skill, or lockfile reference to `image-size`
  remains.
- [ ] `bun audit` reports only the known TanStack moderate and Babel low findings;
  nanoid remains resolved and absent from the audit.

## Implementation order

1. `drop-image-size-magicbyte-header-dims-detector`
2. `drop-image-size-magicbyte-header-dims-library-ingest` and
   `drop-image-size-magicbyte-header-dims-press-pdf`
3. `drop-image-size-magicbyte-header-dims-remove-dependency`
4. Integrated API, web, dependency, and audit verification; advance the feature
   to `stage: review` without self-review.

## Simplification

- Delete both `imageSize()` call paths, their try/catch wrapper in library ingest,
  the direct dependency and lockfile package, and the obsolete reference skill.
- Keep imgproxy URL generation unchanged and add no parser abstraction or runtime
  dependency beyond the owned three-format utility.

## Testing

- Complex-unit tests protect exact header arithmetic, early magic rejection, and
  bounded JPG scanning.
- Service tests protect ingest key/MIME/dimension persistence and press's
  stored-dimension/legacy-fallback seam.
- Existing integration coverage proves real content-blob persistence and both
  library/legacy press PDF paths; its imgproxy output check moves to the owned
  detector so the dependency can leave the full tree.
- No tests are removed; dependency-specific test code is replaced in place.

## Risks

- **Riskiest unit**: JPG marker walking, because malformed lengths can otherwise
  stall or read out of bounds. Explicit scan limits, minimum segment lengths,
  monotonic offsets, and adversarial fixtures are the fallback against parser
  mistakes.
- **Format variation**: WebP has three dimension layouts. Each gets a separate
  exact fixture; unknown or malformed chunk layouts retain format identity but
  produce null metadata.
- **Stored-dimension assumption**: Existing library blobs already carry columns.
  A missing/null row is treated as unavailable metadata and omitted from press
  output rather than silently re-downloading, preserving the locked source of
  truth.

## Implementation notes

- Execution capability: direct inline implementation by one feature owner; the
  security contract, two consumers, and dependency cleanup formed one cohesive
  change surface.
- Review weight: `standard` from the plugin default. The caller explicitly set a
  stop-at-review boundary; independent cross-model review runs next.
- Child checkpoints completed:
  `drop-image-size-magicbyte-header-dims-detector`,
  `drop-image-size-magicbyte-header-dims-library-ingest`,
  `drop-image-size-magicbyte-header-dims-press-pdf`, and
  `drop-image-size-magicbyte-header-dims-remove-dependency` are all `stage: done`.
- Production files changed: `apps/api/src/lib/image-detect.ts`,
  `apps/api/src/services/library.ts`, `apps/api/src/services/press-pdf.ts`,
  `apps/api/package.json`, `bun.lock`, and
  `packages/shared/src/content-library.ts`; deleted
  `.claude/skills/image-size/SKILL.md`.
- Test files added/changed: added
  `apps/api/tests/lib/image-detect.test.ts`; changed library and press PDF unit
  tests plus library and migration integration tests. Coverage protects all
  three accepted formats and WebP variants, non-allowlisted early rejection,
  bounded malformed JPG work, blob-dimension persistence, stored press
  dimensions, and legacy fallback.
- Simplification: removed both vulnerable parser call paths, the service wrapper,
  redundant parsing of library blobs, the direct dependency/lock node, and its
  reference skill. No new runtime dependency or imgproxy change was introduced.
- Discrepancy from initial grounding: `content_blobs` is defined in
  `apps/api/src/db/schema/library.schema.ts`, not `content.schema.ts`; no schema
  or migration change was required.
- Adjacent issues parked: none.

## Integrated verification

- `node scripts/dev/check-undici-alignment.mjs`: passed; Node and Nitro both
  resolve undici 7.29.0 (major 7).
- `bun run --filter @snc/api test:unit`: passed — 126 files, 2,019 tests.
- `bun run --filter @snc/api typecheck`: passed.
- `bun run --filter @snc/web typecheck`: passed.
- `bun run --filter @snc/web test`: passed — 185 files, 1,910 tests; the noted
  media-picker flake did not reproduce.
- `bun run --filter @snc/api test:integration`: passed — 12 files, 54 tests
  against the real dev services.
- `bun audit`: expected nonzero audit status with exactly 2 remaining findings
  (1 `@tanstack/start-server-core` moderate, 1 `@babel/core` low), down from 4
  before removal (the two removed findings were both image-size high).
- Dependency checks: `bun why image-size` reports no matching lockfile package;
  source/test/package/lock searches are clear. `bun why nanoid` reports
  `nanoid@5.1.16`, matching the unchanged root `^5.1.16` resolution.
- `git diff --check`: passed.

## Status

`stage: done` — implemented, cross-model reviewed (gpt-5.6-sol,
approve-with-nits), hardened. Review confirmed the DoS guarantee intact
(adversarial 10 MiB JPEG marker stream bounded ~10–16 ms; ICNS/JXL/HEIF/arbitrary
bytes rejected before any parser). Three Low nits fixed: WebP first-chunk now
bounded against the declared RIFF size (regression test added); legacy oversized
downloads cancel the stream; press-pdf failure modes covered. Verification: api
unit 2020, api integration 54, web 1910, typechecks clean, drift guard green,
`bun audit` 4→2 (image-size + nanoid gone; only @tanstack/start-server-core
moderate + @babel/core low remain — both pre-existing/unrelated).
