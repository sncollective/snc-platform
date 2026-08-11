---
id: drop-image-size-magicbyte-imgproxy-info
kind: feature
stage: drafting
tags: [security, media-pipeline, content]
parent: null
depends_on: []
release_binding: null
gate_origin: null
created: 2026-08-11
updated: 2026-08-11
---

# Drop image-size — magic-byte format + imgproxy /info dimensions

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

Replace `image-size` with two mechanisms that keep the public surface identical
(same accepted formats, same content-addressable key scheme, same stored dims,
same API responses) while removing the vulnerable JS parsers entirely:

1. **Format → in-house magic-byte detection** (jpg/png/webp magic; reject
   everything else before any parser runs). No deps, no DoS surface.
2. **Dimensions → imgproxy `/info`** (post-store; imgproxy reads the stored
   `s3://` object). imgproxy is libvips-backed — the hardened parser already in
   the stack, designed for untrusted input with timeouts. Persist width/height
   to the existing `content_blobs` columns exactly as today.

This also *is* the advisory fix: the vulnerable `image-size` parsers leave the
stack completely, so no `--ignore` suppression / backlog mitigation is needed for
these two CVEs.

## Strategic decisions

Locked in the scoping conversation (2026-08-11) — inherited by `feature-design`:

- **Store dimensions, do not call `/info` on demand.** `content_blobs` are
  immutable (sha256-keyed) → stored dims can never drift/stale. The columns
  already exist and are populated today; switching the parser to `/info` is a
  drop-in with zero downstream change. The hot reader is the web client
  (aspect-ratio layout on every render via `library.ts` returning
  `blob.width`/`height`) — on-demand `/info` per render is impractical (web
  can't call imgproxy directly; would need an endpoint = "store" with extra hops
  + a network dep on the render path). Ingest pays for a parse anyway, so
  computing dims once-ever at ingest is the cheapest place; dedup skips repeats.
- **Format via magic-byte, dims via imgproxy `/info`** — not pure `/info` — because
  of the ingest chicken-and-egg: the content-addressable key
  (`library/{ab}/{sha256}.{ext}`) needs the format **before** the S3 put, but
  imgproxy `/info` reads the object **after** it's stored. Magic-byte gives the
  extension pre-store (cheap, in-memory, no vulnerable parsers — we only match
  jpg/png/webp magic); `/info` then supplies dims post-store.
- **press-pdf reads stored dims** (not `imageSize()`). For library-asset keys the
  dims are already on the blob. Legacy pre-library press keys (which may lack
  stored dims) fall back to an imgproxy `/info` call rather than re-introducing
  image-size.
- **Drop `image-size` entirely** (dep + the `.claude/skills/image-size/SKILL.md`
  reference). imgproxy becomes the single image parser in the stack.

## Simplification opportunity

- **Delete** the `image-size` dependency and the `.claude/skills/image-size/SKILL.md`
  skill.
- **Delete** the `imageSize()` call in `press-pdf.ts` (replaced by a stored-dims
  read + legacy `/info` fallback).
- **Consolidate** to one image parser (imgproxy/libvips) for the whole stack
  instead of two (image-size + imgproxy). Today imgproxy already parses every
  served image but we discard its metadata — `/info` surfaces it.
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
    content-addressable key (the chicken-and-egg consumer).
  - ingest caller (~L248–275) — stores `width`/`height` on the blob.
- `apps/api/src/db/schema/content.schema.ts:35–36` — `content_blobs.width`/`height`.
- `apps/api/src/services/press-pdf.ts:189` — `imageSize(readImageBuffer(key))`
  for the 300ppi print-quality warning (the redundant re-parse).
- `apps/api/src/lib/imgproxy.ts` — URL generation only (`buildImgproxyUrl`,
  `buildPressImageUrl`, `buildSrcSet`, `buildDprSrcSet`); **no `/info` client yet**
  — this feature adds one. Config (`IMGPROXY_URL`/`KEY`/`SALT`/bucket) already
  parsed there.

Design notes to resolve in `feature-design`:
- The imgproxy `/info` client shape (signed `/info/{encoded-s3-url}` vs the
  `info:1` URL option) and how it maps imgproxy's format strings to our
  `DetectedType`.
- Ingest flow ordering: sha256 → magic-byte format → derive key → S3 put →
  imgproxy `/info` (dims) → write blob row — all within the ingest handler.
- Error handling when imgproxy is unreachable at ingest (fail the upload vs
  store-with-null-dims-and-backfill). Note: this couples ingest availability to
  imgproxy (a new runtime dep at the ingest path) — call it out.
- Magic-byte detector scope: jpg (FFD8FF), png (89504E470D0A1A0A), webp
  ("RIFF"...."WEBP") — and explicit rejection of everything else (the security
  guarantee).
- Tests: magic-byte detection (accept/reject per format), ingest end-to-end
  (format + dims populated via the new path), press-pdf stored-dims read +
  legacy `/info` fallback, and a regression that a crafted non-jpg/png/webp
  magic is rejected before any parse.

## Status

`stage: drafting` — awaiting `feature-design` to flesh out the design and spawn
child stories (magic-byte detector, imgproxy `/info` client, ingest rewiring,
press-pdf change, dep + skill removal, tests).
