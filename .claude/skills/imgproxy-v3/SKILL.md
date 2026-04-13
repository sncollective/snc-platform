---
name: imgproxy-v3
description: >
  imgproxy v3 image processing proxy reference. Auto-loads when working with
  imgproxy, image optimization, responsive images, srcSet, OptionalImage,
  image proxy, WebP, AVIF, format negotiation, IMGPROXY_.
user-invocable: false
---

# imgproxy v3 Reference

> **Version:** 3.31.x
> **Docs:** https://docs.imgproxy.net/
> **Docker image:** `ghcr.io/imgproxy/imgproxy:v3`

See [reference.md](reference.md) for the full processing options, signing algorithm, and code examples.

## URL Format

```
/{signature}/{processing_options}/plain/{source_url}[@{extension}]
/{signature}/{processing_options}/{base64_source_url}[.{extension}]
```

- **signature** — HMAC-SHA256 digest (base64url). Use `unsafe` or `_` when signing is disabled.
- **processing_options** — slash-separated `option:arg1:arg2:...` segments.
- **source_url** — `plain/https://...` (percent-encoded) or base64url-encoded. For S3: `plain/s3://bucket/key`.
- **extension** — output format override (`@webp`, `.avif`, etc.). Omit to keep source format or use auto-negotiation.

### Common Processing Options

| Option | Format | Purpose |
|--------|--------|---------|
| `rs` | `rs:{type}:{w}:{h}:{enlarge}:{extend}` | Resize (types: `fit`, `fill`, `fill-down`, `force`, `auto`) |
| `s` | `s:{w}:{h}:{enlarge}:{extend}` | Size shortcut (width + height) |
| `w` | `w:{width}` | Width only (0 = auto from height) |
| `h` | `h:{height}` | Height only (0 = auto from width) |
| `g` | `g:{type}:{x}:{y}` | Gravity (`no`, `so`, `ea`, `we`, `ce`, `sm`, `fp:X:Y`) |
| `c` | `c:{w}:{h}:{gravity}` | Crop before resize |
| `q` | `q:{0-100}` | Quality (0 = use server default) |
| `f` | `f:{format}` | Output format (`webp`, `avif`, `jpg`, `png`) |
| `dpr` | `dpr:{ratio}` | Device pixel ratio (e.g. `dpr:2`) |
| `bl` | `bl:{sigma}` | Gaussian blur |
| `sh` | `sh:{sigma}` | Sharpen |
| `bg` | `bg:{R}:{G}:{B}` or `bg:{hex}` | Background fill color |
| `pr` | `pr:{preset1}:{preset2}` | Apply named presets |
| `cb` | `cb:{string}` | Cache buster |
| `exp` | `exp:{unix_ts}` | Expiry timestamp |

### Example URL

```
/AfrOrF3gWeDA6VOlDG4TzxMv39O7MXnF4CXpKUwGqRM/rs:fill:300:400:0/g:sm/plain/s3://media/photos/hero.jpg@webp
```

## S3 Source (Garage Compatibility)

Source URL format: `s3://{bucket}/{key}` (e.g. `s3://snc-media/uploads/photo.jpg`)

Required env vars:

```
IMGPROXY_USE_S3=true
IMGPROXY_S3_ENDPOINT=http://garage:3900
IMGPROXY_S3_ENDPOINT_USE_PATH_STYLE=true
IMGPROXY_S3_REGION=garage
AWS_ACCESS_KEY_ID=<garage-access-key>
AWS_SECRET_ACCESS_KEY=<garage-secret-key>
```

`IMGPROXY_S3_ENDPOINT_USE_PATH_STYLE=true` is required for Garage (and MinIO) because they use path-style URLs by default, not virtual-hosted-style.

## URL Signing

Algorithm: HMAC-SHA256 over the path (everything after the hostname, including leading `/`).

```
IMGPROXY_KEY=<64-hex-chars>
IMGPROXY_SALT=<64-hex-chars>
```

Generate a key/salt pair: `echo $(xxd -g 2 -l 64 -p /dev/random | tr -d '\n')`

Signing is disabled by default but **must be enabled in production** to prevent URL tampering.

`IMGPROXY_SIGNATURE_SIZE` controls the number of bytes used before base64 encoding (default: 32).

## Format Negotiation

**IMGPROXY_ENFORCE_WEBP** (default: `false`) — when `true`, forces WebP output if the client's `Accept` header includes `image/webp`, regardless of the format specified in the URL.

**IMGPROXY_ENFORCE_AVIF** (default: `false`) — same behavior for AVIF. AVIF takes priority over WebP when both are enforced and supported.

**IMGPROXY_PREFERRED_FORMATS** (default: `jpeg,png,gif`) — comma-separated list of preferred output formats. Used by the `best` format selection feature.

**IMGPROXY_FORMAT_QUALITY** (default: `webp=79,avif=63,jxl=77`) — per-format quality overrides. Example: `jpeg=80,webp=75,avif=50`.

**IMGPROXY_QUALITY** (default: `80`) — global default quality when not specified per-format.

## Key Gotchas

### Path-style S3 is Required for Garage

imgproxy defaults to `IMGPROXY_S3_ENDPOINT_USE_PATH_STYLE=true`, which matches Garage's default behavior. Do not set this to `false` unless you have configured `root_domain` in Garage's `garage.toml` for virtual-hosted-style.

### Signing Path Includes the Leading Slash

The HMAC is computed over the path starting with `/`, e.g. `/rs:fill:300:400/plain/s3://bucket/key.jpg`. The signature itself is not included in the signed content.

### DPR Multiplies Dimensions

`dpr:2` with `w:300` produces a 600px-wide image. The `dpr` option multiplies `width`, `height`, and any offset values. This is the correct way to serve retina images — use CSS `width` for the logical size and `dpr` for the physical size.

### Base64 Source URLs Must Be URL-Safe

Use base64url encoding (RFC 4648 section 5): `+` becomes `-`, `/` becomes `_`, no `=` padding. Long encoded strings can be split with `/` for readability.

### Format Extension Syntax Differs by URL Style

- Plain URL: append `@webp` after the URL — `plain/s3://bucket/key.jpg@webp`
- Base64 URL: append `.webp` after the encoded string — `aHR0cDovLy4uLg.webp`

### Enlarge is Off by Default

imgproxy will not upscale images smaller than the target dimensions unless `enlarge` is set to `1`/`t`/`true` in the resize options.

## Anti-Patterns

1. **Don't build imgproxy URLs on the client** — the signing key would be exposed. Generate signed URLs server-side (in Hono route handlers or a shared utility).

2. **Don't use `force` resize type for photos** — it distorts aspect ratio. Use `fit` (contain) or `fill` (cover + crop) instead.

3. **Don't set quality above 85 for WebP/AVIF** — diminishing returns with much larger file sizes. Use `IMGPROXY_FORMAT_QUALITY` to tune per-format globally.

4. **Don't skip signing in production** — unsigned URLs allow anyone to use your imgproxy as an open image proxy, consuming resources and bandwidth.

5. **Don't generate URLs with absolute dimensions for every breakpoint** — use `dpr` combined with logical widths to reduce URL variations and improve cache hit rates.

6. **Don't duplicate format negotiation** — if you set `IMGPROXY_ENFORCE_WEBP=true`, don't also append `@webp` in your URLs. Let the Accept header drive format selection.

## Docker Deployment

```yaml
# docker-compose.yml snippet
imgproxy:
  image: ghcr.io/imgproxy/imgproxy:v3
  environment:
    IMGPROXY_USE_S3: "true"
    IMGPROXY_S3_ENDPOINT: "http://garage:3900"
    IMGPROXY_S3_ENDPOINT_USE_PATH_STYLE: "true"
    IMGPROXY_S3_REGION: "garage"
    AWS_ACCESS_KEY_ID: "${GARAGE_IMGPROXY_ACCESS_KEY}"
    AWS_SECRET_ACCESS_KEY: "${GARAGE_IMGPROXY_SECRET_KEY}"
    IMGPROXY_KEY: "${IMGPROXY_KEY}"
    IMGPROXY_SALT: "${IMGPROXY_SALT}"
    IMGPROXY_ENFORCE_WEBP: "true"
    IMGPROXY_ENFORCE_AVIF: "true"
    IMGPROXY_QUALITY: "80"
    IMGPROXY_FORMAT_QUALITY: "webp=79,avif=50"
    IMGPROXY_TTL: "31536000"
    IMGPROXY_MAX_SRC_RESOLUTION: "50"
    IMGPROXY_STRIP_METADATA: "true"
  ports:
    - "8081:8080"
  depends_on:
    - garage
```

## Resources

- [imgproxy Documentation](https://docs.imgproxy.net/)
- [Processing Options](https://docs.imgproxy.net/usage/processing)
- [S3 Source](https://docs.imgproxy.net/image_sources/amazon_s3)
- [URL Signing](https://docs.imgproxy.net/usage/signing_url)
- [Best Format](https://docs.imgproxy.net/features/best_format)
- [Configuration Options](https://docs.imgproxy.net/configuration/options)
- [GitHub Examples](https://github.com/imgproxy/imgproxy/tree/master/examples)
