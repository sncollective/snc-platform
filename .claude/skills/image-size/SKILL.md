---
name: image-size
description: >
  image-size v2.x reference (pure-JS image dimension + format detection from magic
  bytes). Auto-loads when working with image-size, imageSize, detecting image
  dimensions/format, content-addressable image keying, width/height probing,
  image magic bytes, format detection without decoding.
user-invocable: false
updated: 2026-08-08
---

# image-size v2.x Reference

Pure-JavaScript image dimension + format detector. Reads only file headers
(magic bytes) — no full decode, no native deps, fast. Used by the content
library (`content-library-core`) to (a) detect format from bytes → derive the
content-addressable storage key, and (b) read width/height for the asset
registry. Verified against the installed `image-size@2.0.2`.

## Import (v2 is ESM-only; breaking change from v1)

```ts
// Named export (preferred) — also re-exported as default
import { imageSize } from "image-size";
// or
import imageSize from "image-size";
```

> **v1 → v2 breaking:** v1 used `const sizeOf = require("image-size")` /
> `imageSize`. v2 is **ESM-only** (`"type": "module"`, `.mjs` dist) with a named
> `imageSize` export (default alias also available). No `fromFile` callback —
> `fromFile` is async/promisified in v2.

## API

```ts
declare function imageSize(input: Uint8Array): ISizeCalculationResult;

interface ISize {
  width: number;       // px
  height: number;      // px
  type?: string;       // detected format key, e.g. "jpg" | "png" | "webp" | "gif" | ...
  orientation?: number;// EXIF orientation (JPG), if present
}
type ISizeCalculationResult = { images?: ISize[] } & ISize; // `images` only for multi-image formats (ico/icns)

// Optional: disable specific format detectors (global mutable state)
import { disableTypes } from "image-size";
disableTypes(["svg", "tiff"]);
```

- **Synchronous.** Takes a `Uint8Array` (the whole file in memory — fine for the
  platform's ≤10 MiB image uploads).
- Reads the **first byte** to pick a candidate format, then validates the magic
  bytes, then calculates dimensions from the header (no pixel decode).
- `result.type` is set to the detected key (e.g. `"jpg"`, `"png"`, `"webp"`).

## Detected formats (the keys `type` can take)

`bmp, cur, dds, gif, heif, icns, ico, j2c, jp2, jpg, jxl, jxl-stream, ktx, png,
pnm, psd, svg, tga, tiff, webp` — plus sub-keys for some (`avif`/`heic`/`heif`
under heif; `ktx`/`ktx2`; `bigtiff`/`tiff`).

The platform accepts only **`jpg` | `png` | `webp`** for uploads
(`ACCEPTED_MIME_TYPES.image`); any other detected type must be rejected by the
caller (see gotcha).

## Gotchas

1. **THROWS on unparseable/unrecognized input — does NOT return `{ type: undefined }`.**
   `imageSize()` throws a `TypeError` for: an unrecognized file (`"unsupported
   file type: undefined"`), a corrupt/short buffer (`"Invalid WebP"`,
   `"Corrupt JPG, exceeded buffer limits"`, `"Invalid JPG, no size found"`,
   `"Invalid PNG"`, `"Reached end of input"`, …), or a `disableTypes`-disabled
   type. **Always wrap in try/catch** and map to your validation error — do not
   rely on a falsy-`type` guard alone:
   ```ts
   try {
     const d = imageSize(bytes);
     if (d.type !== "jpg" && d.type !== "png" && d.type !== "webp") {
       throw new Error("unsupported"); // fall through to catch
     }
     return { type: d.type, width: d.width, height: d.height };
   } catch {
     return err(new ValidationError("Unsupported or unrecognized image format"));
   }
   ```
   This is how `services/library.ts` (`detectImage`) uses it.
2. **Format is detected from bytes, not the client-declared MIME.** This is the
   content-addressability invariant: the storage key must be a pure function of
   the bytes, so derive the key extension from `result.type`, never from
   `file.type`. A JPEG relabeled `image/png` still detects as `jpg` → same key.
3. **`width`/`height` can be large numbers** (e.g. PSD/AVIF); the registry stores
   them nullable — a successful detect always has dims, but callers should
   tolerate `0`/unusual values only if they extend accepted formats.
4. **`disableTypes` mutates module-global state** — avoid in request handlers
   unless you mean it process-wide.
5. **ESM-only**: importing via `require()` does not work. The platform's `tsx`
   runtime handles ESM fine.

## Anti-patterns

- ❌ `if (!result.type) return reject;` as the *only* guard — `imageSize` throws
  before returning on bad input; the guard never runs. Use try/catch.
- ❌ Keying the stored asset off `file.type` (client MIME) — breaks dedup
  (relabeled bytes get a different key). Key off `result.type`.
- ❌ Reading the whole file just to detect dims for huge media — `image-size`
  supports many formats but the platform buffers only images (≤10 MiB); for
  audio/video use `ffprobe` (the media-pipeline path), not this.
- ❌ Using `disableTypes` per-request — it's global.

## Why this library (vs alternatives)

- **Pure JS, zero native deps** — works in dev (no imgproxy), in unit tests
  (mocked storage), and CI. `sharp` (libvips) is heavier than needed just to read
  dimensions.
- **Header-only** — no full decode; cheap under concurrency.
- Detects format *and* dims in one call — exactly what content-addressable
  keying + registry population need.
- imgproxy's `/info` endpoint is the alternative for dims, but it requires
  imgproxy configured + a network call and gives no format-detection-for-keying
  benefit; `image-size` is the self-contained choice. (Revisit if the platform
  later needs EXIF/ICC awareness imgproxy provides.)
