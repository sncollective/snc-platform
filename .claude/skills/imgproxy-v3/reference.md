# imgproxy v3 Detailed Reference

## Processing URL Format

### Structure

```
http://imgproxy-host/{signature}/{option1}/{option2}/.../{source_url_type}/{source_url}[@{extension}]
```

Each processing option uses colon-separated arguments: `option_name:arg1:arg2:...:argN`

Options are separated by `/` in the path. Order does not matter.

### Source URL Types

**Plain** (percent-encode special characters):
```
/plain/s3://snc-media/uploads/photo.jpg
/plain/https://example.com/image.jpg
```

**Base64url** (RFC 4648 section 5 — no padding, `+` -> `-`, `/` -> `_`):
```
/czM6Ly9zbmMtbWVkaWEvdXBsb2Fkcy9waG90by5qcGc
```

Long base64 strings may be split with `/` for readability:
```
/czM6Ly9zbmMtbWVk/aWEvdXBsb2Fkcy9w/aG90by5qcGc
```

### Extension (Output Format)

- Plain URLs: append `@ext` — `plain/s3://bucket/key.jpg@webp`
- Base64 URLs: append `.ext` — `czM6Ly8uLi4.webp`
- Or use the `f:` processing option: `f:webp`

---

## Complete Processing Options

### Resize & Dimensions

| Option | Format | Description |
|--------|--------|-------------|
| `rs` | `rs:{type}:{w}:{h}:{enlarge}:{extend}` | Combined resize. Type: `fit`, `fill`, `fill-down`, `force`, `auto` |
| `rt` | `rt:{type}` | Resizing type only |
| `s` | `s:{w}:{h}:{enlarge}:{extend}` | Size shortcut |
| `w` | `w:{width}` | Width (0 = auto-calculate from height) |
| `h` | `h:{height}` | Height (0 = auto-calculate from width) |
| `mw` | `mw:{width}` | Minimum width |
| `mh` | `mh:{height}` | Minimum height |
| `dpr` | `dpr:{ratio}` | Device pixel ratio — multiplies width, height, and offsets |
| `z` | `z:{zoom_x}:{zoom_y}` | Zoom/multiply dimensions |
| `el` | `el:{1\|0}` | Enlarge images smaller than target (default: 0/false) |
| `ex` | `ex:{1\|0}:{gravity}` | Extend canvas to reach target dimensions |
| `exar` | `exar:{1\|0}:{gravity}` | Extend canvas to match aspect ratio |

**Resizing types:**
- `fit` — fit within W x H, preserving aspect ratio (default)
- `fill` — fill W x H, cropping overflow (use with gravity)
- `fill-down` — like `fill` but never upscales
- `force` — exact W x H, ignoring aspect ratio (distorts)
- `auto` — `fill` if both W and H given and image is larger, otherwise `fit`

### Crop & Gravity

| Option | Format | Description |
|--------|--------|-------------|
| `c` | `c:{w}:{h}:{gravity}` | Crop area before resize |
| `g` | `g:{type}:{x_offset}:{y_offset}` | Gravity for crop/fill |

**Gravity types:**
- `no` (north/top), `so` (south/bottom), `ea` (east/right), `we` (west/left)
- `noea`, `nowe`, `soea`, `sowe` (corners)
- `ce` (center — default)
- `sm` (smart — content-aware detection)
- `fp:{x}:{y}` (focus point — normalized 0.0 to 1.0)

### Quality & Format

| Option | Format | Description |
|--------|--------|-------------|
| `q` | `q:{0-100}` | Output quality (0 = use server default) |
| `fq` | `fq:{fmt1}:{q1}:{fmt2}:{q2}` | Per-format quality |
| `mb` | `mb:{bytes}` | Max bytes — degrade quality until file is under limit |
| `f` | `f:{extension}` | Output format |
| `sm` | `sm:{1\|0}` | Strip metadata (EXIF, IPTC, etc.) |
| `kcr` | `kcr:{1\|0}` | Keep copyright info during metadata strip |
| `scp` | `scp:{1\|0}` | Strip color profile (transform to sRGB) |

### Rotation & Orientation

| Option | Format | Description |
|--------|--------|-------------|
| `ar` | `ar:{1\|0}` | Auto-rotate per EXIF orientation |
| `rot` | `rot:{0\|90\|180\|270}` | Rotate by angle |
| `fl` | `fl:{h}:{v}` | Flip horizontal/vertical |

### Effects

| Option | Format | Description |
|--------|--------|-------------|
| `bl` | `bl:{sigma}` | Gaussian blur |
| `sh` | `sh:{sigma}` | Sharpen |
| `pix` | `pix:{size}` | Pixelate |
| `bg` | `bg:{R}:{G}:{B}` or `bg:{hex}` | Background fill color |
| `pd` | `pd:{top}:{right}:{bottom}:{left}` | Padding (CSS-style) |
| `trim` | `trim:{threshold}:{color}:{eq_hor}:{eq_ver}` | Trim surrounding background |

### Watermark (base features)

| Option | Format | Description |
|--------|--------|-------------|
| `wm` | `wm:{opacity}:{position}:{x}:{y}:{scale}` | Apply configured watermark |

### Request Control

| Option | Format | Description |
|--------|--------|-------------|
| `pr` | `pr:{preset1}:{preset2}` | Apply named presets |
| `cb` | `cb:{string}` | Cache buster (ignored by imgproxy, busts CDN cache) |
| `exp` | `exp:{unix_timestamp}` | URL expiry — returns 404 after this time |
| `skp` | `skp:{fmt1}:{fmt2}` | Skip processing for listed formats |
| `raw` | `raw:{1\|0}` | Stream source unprocessed |
| `fn` | `fn:{name}:{encoded}` | Set Content-Disposition filename |
| `att` | `att:{1\|0}` | Force download (Content-Disposition: attachment) |

---

## URL Signing

### Algorithm

1. Decode `IMGPROXY_KEY` and `IMGPROXY_SALT` from hex to binary buffers
2. Create HMAC-SHA256 using the decoded key
3. Update HMAC with the decoded salt, then with the path string (everything after the host, starting with `/`)
4. Produce digest as base64url (URL-safe base64, no padding)
5. Prepend `/{signature}` to the path

### Node.js Implementation

```typescript
import { createHmac } from "node:crypto";

const hexDecode = (hex: string): Buffer => Buffer.from(hex, "hex");

/**
 * Generate a signed imgproxy URL.
 *
 * @param key    Hex-encoded IMGPROXY_KEY
 * @param salt   Hex-encoded IMGPROXY_SALT
 * @param path   Processing path starting with "/" (e.g. "/rs:fill:300:400/plain/s3://bucket/key.jpg@webp")
 * @returns      Full path with signature prepended: "/{signature}{path}"
 */
function signImgproxyPath(key: string, salt: string, path: string): string {
  const hmac = createHmac("sha256", hexDecode(key));
  hmac.update(hexDecode(salt));
  hmac.update(path);
  const signature = hmac.digest("base64url");
  return `/${signature}${path}`;
}

// Usage
const IMGPROXY_KEY = "943b421c9eb07c830af81030552c86009268de4e532ba2ee2eab8247c6da0881";
const IMGPROXY_SALT = "520f986b998545b4785e0defbc4f3c1203f22de2374a3d53cb7a7fe9fea309c5";

const path = "/rs:fit:300:300/plain/s3://snc-media/uploads/photo.jpg@webp";
const signedPath = signImgproxyPath(IMGPROXY_KEY, IMGPROXY_SALT, path);
// => "/oKfUtW34Dvo2BGQe.../rs:fit:300:300/plain/s3://snc-media/uploads/photo.jpg@webp"

const url = `https://img.example.com${signedPath}`;
```

### Disabling Signing

When `IMGPROXY_KEY` and `IMGPROXY_SALT` are not set (or empty), signing is disabled. Use any string as the signature segment (conventionally `unsafe` or `_`):

```
http://imgproxy:8080/unsafe/rs:fit:300:300/plain/s3://snc-media/photo.jpg
```

### Signature Truncation

`IMGPROXY_SIGNATURE_SIZE` (default: `32`) controls how many bytes of the HMAC digest to use before base64url encoding. Smaller values produce shorter URLs at the cost of reduced security. Use the default unless URL length is a concern.

---

## Responsive Image URL Generation

### TypeScript Utility for srcSet

```typescript
import { createHmac } from "node:crypto";

interface ImgproxyConfig {
  baseUrl: string;  // e.g. "https://img.s-nc.org"
  key: string;      // hex-encoded IMGPROXY_KEY
  salt: string;     // hex-encoded IMGPROXY_SALT
  bucket: string;   // S3 bucket name
}

interface ImageParams {
  /** S3 object key (e.g. "uploads/photo.jpg") */
  s3Key: string;
  /** Resize type (default: "fill") */
  resizeType?: "fit" | "fill" | "fill-down" | "force" | "auto";
  /** Gravity (default: "ce") */
  gravity?: string;
  /** Quality 1-100 (default: 0 = server default) */
  quality?: number;
  /** Output format (default: undefined = auto-negotiate via Accept header) */
  format?: "webp" | "avif" | "jpg" | "png";
}

const hexDecode = (hex: string): Buffer => Buffer.from(hex, "hex");

function signPath(key: string, salt: string, path: string): string {
  const hmac = createHmac("sha256", hexDecode(key));
  hmac.update(hexDecode(salt));
  hmac.update(path);
  return hmac.digest("base64url");
}

/**
 * Build a single signed imgproxy URL for the given width.
 */
function buildImgproxyUrl(
  config: ImgproxyConfig,
  params: ImageParams,
  width: number,
): string {
  const rt = params.resizeType ?? "fill";
  const g = params.gravity ?? "ce";
  const ext = params.format ? `@${params.format}` : "";

  const parts = [
    `rs:${rt}:${width}:0`,  // width only, auto height
    `g:${g}`,
  ];

  if (params.quality && params.quality > 0) {
    parts.push(`q:${params.quality}`);
  }

  const processingPath = parts.join("/");
  const sourceUrl = `s3://${config.bucket}/${params.s3Key}`;
  const path = `/${processingPath}/plain/${sourceUrl}${ext}`;

  const signature = signPath(config.key, config.salt, path);
  return `${config.baseUrl}/${signature}${path}`;
}

/**
 * Generate srcSet string for responsive images.
 *
 * @param config   imgproxy connection config
 * @param params   Image parameters (key, resize, gravity, quality, format)
 * @param widths   Array of pixel widths for srcSet entries
 * @returns        srcSet string ready for <img> or <source> element
 */
function buildSrcSet(
  config: ImgproxyConfig,
  params: ImageParams,
  widths: number[] = [320, 640, 960, 1280, 1920],
): string {
  return widths
    .map((w) => `${buildImgproxyUrl(config, params, w)} ${w}w`)
    .join(", ");
}

// --- Usage Example ---

const config: ImgproxyConfig = {
  baseUrl: "https://img.s-nc.org",
  key: "943b421c9eb07c830af81030552c86009268de4e532ba2ee2eab8247c6da0881",
  salt: "520f986b998545b4785e0defbc4f3c1203f22de2374a3d53cb7a7fe9fea309c5",
  bucket: "snc-media",
};

const params: ImageParams = {
  s3Key: "uploads/artists/hero-photo.jpg",
  resizeType: "fill",
  gravity: "sm",
  quality: 80,
  // format omitted — let IMGPROXY_ENFORCE_WEBP/AVIF auto-negotiate
};

const srcSet = buildSrcSet(config, params);
// => "https://img.s-nc.org/{sig}/rs:fill:320:0/g:sm/q:80/plain/s3://snc-media/uploads/artists/hero-photo.jpg 320w,
//     https://img.s-nc.org/{sig}/rs:fill:640:0/g:sm/q:80/plain/s3://snc-media/uploads/artists/hero-photo.jpg 640w,
//     ..."

const singleUrl = buildImgproxyUrl(config, params, 800);
// For a single <img src="...">
```

### Using srcSet in React (TanStack Start / SSR)

```tsx
// This runs on the server during SSR — signing keys never reach the client.

interface ResponsiveImageProps {
  s3Key: string;
  alt: string;
  sizes: string;  // e.g. "(max-width: 768px) 100vw, 50vw"
  widths?: number[];
  className?: string;
  gravity?: string;
  resizeType?: "fit" | "fill" | "fill-down";
}

function ResponsiveImage({
  s3Key,
  alt,
  sizes,
  widths = [320, 640, 960, 1280, 1920],
  className,
  gravity = "ce",
  resizeType = "fill",
}: ResponsiveImageProps) {
  // config and buildSrcSet/buildImgproxyUrl imported from a server utility
  const srcSet = buildSrcSet(config, { s3Key, resizeType, gravity }, widths);
  const fallbackSrc = buildImgproxyUrl(config, { s3Key, resizeType, gravity }, 800);

  return (
    <img
      src={fallbackSrc}
      srcSet={srcSet}
      sizes={sizes}
      alt={alt}
      className={className}
      loading="lazy"
      decoding="async"
    />
  );
}

// Usage:
// <ResponsiveImage
//   s3Key="uploads/shows/poster.jpg"
//   alt="Show poster"
//   sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 600px"
//   gravity="sm"
// />
```

### DPR-Based URLs (Alternative to Width Descriptors)

For fixed-size images (thumbnails, avatars), use DPR instead of width descriptors:

```typescript
function buildDprSrcSet(
  config: ImgproxyConfig,
  params: ImageParams,
  logicalWidth: number,
  logicalHeight: number,
  dprs: number[] = [1, 2, 3],
): string {
  const rt = params.resizeType ?? "fill";
  const g = params.gravity ?? "ce";
  const ext = params.format ? `@${params.format}` : "";
  const sourceUrl = `s3://${config.bucket}/${params.s3Key}`;

  return dprs
    .map((dpr) => {
      const parts = [`rs:${rt}:${logicalWidth}:${logicalHeight}`, `g:${g}`, `dpr:${dpr}`];
      if (params.quality && params.quality > 0) parts.push(`q:${params.quality}`);
      const path = `/${parts.join("/")}/plain/${sourceUrl}${ext}`;
      const signature = signPath(config.key, config.salt, path);
      return `${config.baseUrl}/${signature}${path} ${dpr}x`;
    })
    .join(", ");
}

// For a 64x64 avatar:
const avatarSrcSet = buildDprSrcSet(config, { s3Key: "avatars/user-42.jpg" }, 64, 64);
// => "https://img.s-nc.org/{sig}/rs:fill:64:64/g:ce/dpr:1/plain/s3://... 1x,
//     https://img.s-nc.org/{sig}/rs:fill:64:64/g:ce/dpr:2/plain/s3://... 2x,
//     https://img.s-nc.org/{sig}/rs:fill:64:64/g:ce/dpr:3/plain/s3://... 3x"
```

---

## Configuration Reference

### Server

| Env Var | Default | Description |
|---------|---------|-------------|
| `IMGPROXY_BIND` | `:8080` | Listen address |
| `IMGPROXY_TIMEOUT` | `10` | Max seconds for processing response |
| `IMGPROXY_READ_REQUEST_TIMEOUT` | `10` | Max seconds for reading incoming request |
| `IMGPROXY_WORKERS` | `CPU * 2` | Max concurrent image processing operations |
| `IMGPROXY_MAX_CLIENTS` | `2048` | Max simultaneous connections |
| `IMGPROXY_TTL` | `31536000` | Cache-Control max-age in seconds (default: 1 year) |
| `IMGPROXY_MAX_SRC_RESOLUTION` | `50` | Max source image resolution in megapixels |

### Security

| Env Var | Default | Description |
|---------|---------|-------------|
| `IMGPROXY_KEY` | _(empty)_ | Hex-encoded HMAC key. Empty = signing disabled |
| `IMGPROXY_SALT` | _(empty)_ | Hex-encoded HMAC salt. Empty = signing disabled |
| `IMGPROXY_SIGNATURE_SIZE` | `32` | Bytes of HMAC digest before base64 encoding |
| `IMGPROXY_SECRET` | _(empty)_ | Bearer token for Authorization header (alternative auth) |
| `IMGPROXY_ALLOW_SECURITY_OPTIONS` | `false` | Allow per-URL security overrides |

### S3

| Env Var | Default | Description |
|---------|---------|-------------|
| `IMGPROXY_USE_S3` | `false` | Enable S3 source support |
| `IMGPROXY_S3_REGION` | _(empty)_ | AWS region (set to `garage` for Garage) |
| `IMGPROXY_S3_ENDPOINT` | _(empty)_ | Custom S3 endpoint URL |
| `IMGPROXY_S3_ENDPOINT_USE_PATH_STYLE` | `true` | Use path-style URLs (required for Garage/MinIO) |
| `AWS_ACCESS_KEY_ID` | _(empty)_ | S3 access key |
| `AWS_SECRET_ACCESS_KEY` | _(empty)_ | S3 secret key |
| `IMGPROXY_S3_ASSUME_ROLE_ARN` | _(empty)_ | IAM role ARN for cross-account access |
| `IMGPROXY_S3_ASSUME_ROLE_EXTERNAL_ID` | _(empty)_ | External ID for STS AssumeRole |

### Quality & Format

| Env Var | Default | Description |
|---------|---------|-------------|
| `IMGPROXY_QUALITY` | `80` | Default output quality (1-100) |
| `IMGPROXY_FORMAT_QUALITY` | `webp=79,avif=63,jxl=77` | Per-format quality. Format: `fmt=q,fmt=q` |
| `IMGPROXY_PREFERRED_FORMATS` | `jpeg,png,gif` | Preferred formats for `best` format selection |
| `IMGPROXY_ENFORCE_WEBP` | `false` | Force WebP when Accept header includes `image/webp` |
| `IMGPROXY_ENFORCE_AVIF` | `false` | Force AVIF when Accept header includes `image/avif` |
| `IMGPROXY_AUTO_ROTATE` | `true` | Auto-rotate per EXIF orientation |
| `IMGPROXY_STRIP_METADATA` | `true` | Strip EXIF/IPTC metadata from output |

### Best Format (Pro)

| Env Var | Default | Description |
|---------|---------|-------------|
| `IMGPROXY_BEST_FORMAT_COMPLEXITY_THRESHOLD` | `5.5` | Complexity threshold for lossless vs lossy |
| `IMGPROXY_BEST_FORMAT_MAX_RESOLUTION` | `0` | Skip best format for images above this resolution |
| `IMGPROXY_BEST_FORMAT_BY_DEFAULT` | `false` | Enable best format when no format specified |
| `IMGPROXY_BEST_FORMAT_ALLOW_SKIPS` | `false` | Allow skipping SVG and skip-processing formats |

---

## Docker Compose Service

### Minimal Development Setup

```yaml
services:
  imgproxy:
    image: ghcr.io/imgproxy/imgproxy:v3
    environment:
      IMGPROXY_USE_S3: "true"
      IMGPROXY_S3_ENDPOINT: "http://garage:3900"
      IMGPROXY_S3_ENDPOINT_USE_PATH_STYLE: "true"
      IMGPROXY_S3_REGION: "garage"
      AWS_ACCESS_KEY_ID: "${GARAGE_IMGPROXY_ACCESS_KEY}"
      AWS_SECRET_ACCESS_KEY: "${GARAGE_IMGPROXY_SECRET_KEY}"
      # Signing disabled for local dev — use "unsafe" as signature
      # IMGPROXY_KEY: ""
      # IMGPROXY_SALT: ""
    ports:
      - "8081:8080"
    depends_on:
      - garage
```

### Production Setup

```yaml
services:
  imgproxy:
    image: ghcr.io/imgproxy/imgproxy:v3
    environment:
      # S3 / Garage
      IMGPROXY_USE_S3: "true"
      IMGPROXY_S3_ENDPOINT: "http://garage:3900"
      IMGPROXY_S3_ENDPOINT_USE_PATH_STYLE: "true"
      IMGPROXY_S3_REGION: "garage"
      AWS_ACCESS_KEY_ID: "${GARAGE_IMGPROXY_ACCESS_KEY}"
      AWS_SECRET_ACCESS_KEY: "${GARAGE_IMGPROXY_SECRET_KEY}"
      # Signing (required in production)
      IMGPROXY_KEY: "${IMGPROXY_KEY}"
      IMGPROXY_SALT: "${IMGPROXY_SALT}"
      # Format negotiation
      IMGPROXY_ENFORCE_WEBP: "true"
      IMGPROXY_ENFORCE_AVIF: "true"
      IMGPROXY_QUALITY: "80"
      IMGPROXY_FORMAT_QUALITY: "webp=79,avif=50,jpeg=80"
      # Performance
      IMGPROXY_WORKERS: "4"
      IMGPROXY_MAX_CLIENTS: "256"
      IMGPROXY_TTL: "31536000"
      IMGPROXY_MAX_SRC_RESOLUTION: "50"
      # Metadata
      IMGPROXY_STRIP_METADATA: "true"
      IMGPROXY_AUTO_ROTATE: "true"
    ports:
      - "127.0.0.1:8081:8080"
    deploy:
      resources:
        limits:
          memory: 1G
    depends_on:
      - garage
    healthcheck:
      test: ["CMD", "imgproxy", "health"]
      interval: 30s
      timeout: 5s
      retries: 3
```

### Garage Permissions for imgproxy

imgproxy only needs **read** access to the media bucket. Create a dedicated access key with minimal permissions:

```bash
# Via Garage Admin API
curl -X POST http://garage:3903/v2/CreateKey \
  -H "Authorization: Bearer ${GARAGE_ADMIN_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"name": "imgproxy-reader"}'

# Grant read-only on the media bucket
curl -X POST http://garage:3903/v2/AllowBucketKey \
  -H "Authorization: Bearer ${GARAGE_ADMIN_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"bucketId": "<bucket-id>", "accessKeyId": "<new-key-id>", "permissions": {"read": true, "write": false, "owner": false}}'
```

---

## Supported Image Formats

### Input & Output
PNG, JPEG, WebP, AVIF, GIF, ICO, HEIC, BMP, TIFF

### Input Only
JPEG XL, SVG (output as SVG only when source is SVG)

### Pro Only
PDF (input), PSD/PSB (input), Video formats (input), MP4 (output from animated)

---

## Presets

Define reusable processing option sets via `IMGPROXY_PRESETS`:

```
IMGPROXY_PRESETS=thumb=rs:fill:150:150/g:sm/q:70,hero=rs:fill:1920:600/g:sm/q:85,avatar=rs:fill:96:96/g:ce
```

Apply in URLs: `pr:thumb`, `pr:hero`, `pr:thumb:hero` (chain multiple).

Presets reduce URL complexity, improve cacheability, and keep processing logic centralized.
