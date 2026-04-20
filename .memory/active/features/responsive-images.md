---
id: feature-responsive-images
kind: feature
stage: review
tags: [content, design-system]
release_binding: null
created: 2026-04-18
updated: 2026-04-18
related_decisions: []
related_designs: []
parent: null
---

# Responsive Images

imgproxy Docker service, URL builder, shared types, API resolution, OptionalImage srcSet/sizes, consumer updates, Garage read-only key.

## Sub-units

- [ ] Unit 1: imgproxy Docker Service
- [ ] Unit 2: imgproxy URL Builder (Shared Utility)
- [ ] Unit 3: Image URL Resolution Refactor
- [ ] Unit 4: OptionalImage Responsive Upgrade
- [ ] Unit 5: Update Image Consumers
- [ ] Unit 6: Garage Read-Only Access Key for imgproxy

## Image Infrastructure Decision

imgproxy selected over Thumbor (declining maintenance), Sharp/IPX (Node threadpool constraints, DIY caching), and upload-time generation (storage multiplier, inflexible on breakpoint changes). imgproxy: MIT license, active governance (Evil Martians), native S3/Garage support, Go + libvips performance, fits existing container-based deployment.

## Overview

Add imgproxy as an image processing proxy in front of Garage S3, and update the web app to serve responsive images via `srcSet`/`sizes`. Currently the platform serves full-resolution originals through API proxy routes (`/api/content/{id}/thumbnail`, `/api/creators/{id}/avatar`, `/api/creators/{id}/banner`). This design introduces six implementation units:

1. **imgproxy Docker service** in the existing compose stack
2. **imgproxy URL builder** (server-side utility for signed URL + srcSet generation)
3. **Image URL resolution refactor** (API responses include imgproxy URLs and srcSet data)
4. **OptionalImage responsive upgrade** (add `srcSet`/`sizes` props)
5. **Update image consumers** (pass responsive data through all image surfaces)
6. **Garage read-only access key** for imgproxy (least-privilege S3 credentials)

Format negotiation (WebP/AVIF) is handled by imgproxy via the `Accept` header -- no format is specified in generated URLs. Signing keys never reach the client; all imgproxy URLs are generated server-side in Hono route handlers or during TanStack Start SSR.

---

## Implementation Units

### Unit 1: imgproxy Docker Service

**Files:**
- `platform/docker-compose.yml` (add `snc-imgproxy` service)
- `platform/docker-compose.claude.yml` (add `snc-imgproxy` to `claude-net`)

**docker-compose.yml -- add after `snc-liquidsoap` service:**

```yaml
  snc-imgproxy:
    image: ghcr.io/imgproxy/imgproxy:v3
    container_name: snc-imgproxy
    environment:
      IMGPROXY_USE_S3: "true"
      IMGPROXY_S3_ENDPOINT: "http://snc-garage:3900"
      IMGPROXY_S3_ENDPOINT_USE_PATH_STYLE: "true"
      IMGPROXY_S3_REGION: "garage"
      AWS_ACCESS_KEY_ID: "${GARAGE_IMGPROXY_ACCESS_KEY:-}"
      AWS_SECRET_ACCESS_KEY: "${GARAGE_IMGPROXY_SECRET_KEY:-}"
      # Signing — empty in dev (use "unsafe" prefix), set in production
      IMGPROXY_KEY: "${IMGPROXY_KEY:-}"
      IMGPROXY_SALT: "${IMGPROXY_SALT:-}"
      # Format negotiation
      IMGPROXY_ENFORCE_WEBP: "true"
      IMGPROXY_ENFORCE_AVIF: "true"
      IMGPROXY_QUALITY: "80"
      IMGPROXY_FORMAT_QUALITY: "webp=79,avif=50,jpeg=80"
      # Performance
      IMGPROXY_TTL: "31536000"
      IMGPROXY_MAX_SRC_RESOLUTION: "50"
      IMGPROXY_STRIP_METADATA: "true"
      IMGPROXY_AUTO_ROTATE: "true"
    ports:
      - "8081:8080"
    depends_on:
      snc-garage:
        condition: service_healthy
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "imgproxy", "health"]
      interval: 10s
      timeout: 5s
      retries: 3
```

**docker-compose.claude.yml -- add `snc-imgproxy` to claude-net:**

```yaml
  snc-imgproxy:
    networks:
      - claude-net
```

**New env vars** (added to `platform/.env` or injected at deploy):

| Variable | Dev Value | Production | Description |
|----------|-----------|------------|-------------|
| `GARAGE_IMGPROXY_ACCESS_KEY` | Same as `S3_ACCESS_KEY_ID` until Unit 6 | Dedicated read-only key | S3 access key for imgproxy |
| `GARAGE_IMGPROXY_SECRET_KEY` | Same as `S3_SECRET_ACCESS_KEY` until Unit 6 | Dedicated read-only key | S3 secret key for imgproxy |
| `IMGPROXY_KEY` | _(empty)_ | 64-char hex string | HMAC signing key |
| `IMGPROXY_SALT` | _(empty)_ | 64-char hex string | HMAC signing salt |

**Implementation notes:**
- In dev, `IMGPROXY_KEY` and `IMGPROXY_SALT` are left empty, which disables signing. The URL builder uses the `unsafe` prefix instead of a computed signature.
- The `depends_on` with `service_healthy` ensures Garage is reachable before imgproxy starts.
- Port 8081 on the host maps to imgproxy's default 8080 to avoid conflicts with SRS (which uses 8080).

**Acceptance criteria:**
- [ ] `docker compose -f docker-compose.yml -f docker-compose.claude.yml up -d` starts `snc-imgproxy`
- [ ] `docker exec snc-imgproxy imgproxy health` returns success
- [ ] `http://snc-imgproxy:8080/unsafe/rs:fit:100:100/plain/s3://snc-storage/content/{id}/thumbnail/{file}` returns a resized image (test with an existing uploaded thumbnail)

---

### Unit 2: imgproxy URL Builder (Shared Utility)

**File:** `platform/apps/api/src/lib/imgproxy.ts`

**Types and signatures:**

```typescript
import { createHmac } from "node:crypto";

// ── Public Types ──

/** Resize strategy for imgproxy processing. */
export type ResizeType = "fit" | "fill" | "fill-down" | "force" | "auto";

/** Gravity type for crop/fill alignment. */
export type Gravity = "no" | "so" | "ea" | "we" | "noea" | "nowe" | "soea" | "sowe" | "ce" | "sm";

/** Options for imgproxy URL generation. */
export interface ImgproxyOptions {
  /** Resize type (default: "fill"). */
  readonly resizeType?: ResizeType;
  /** Gravity for crop/fill (default: "ce"). */
  readonly gravity?: Gravity;
  /** Quality 1-100 (default: 0 = server default). */
  readonly quality?: number;
}

/** Resolved imgproxy configuration parsed from environment. */
interface ImgproxyConfig {
  readonly baseUrl: string;
  readonly key: string;
  readonly salt: string;
  readonly bucket: string;
  readonly signingEnabled: boolean;
}

// ── Public Constants ──

/** Standard responsive widths for content thumbnails and banners. */
export const THUMBNAIL_WIDTHS = [320, 640, 960, 1280] as const;

/** Standard responsive widths for hero/banner images. */
export const BANNER_WIDTHS = [640, 960, 1280, 1920] as const;

/** Standard DPR multipliers for fixed-size images. */
export const AVATAR_DPRS = [1, 2, 3] as const;

// ── Private Helpers ──

const hexDecode = (hex: string): Buffer => Buffer.from(hex, "hex");

const signPath = (key: string, salt: string, path: string): string => {
  const hmac = createHmac("sha256", hexDecode(key));
  hmac.update(hexDecode(salt));
  hmac.update(path);
  return hmac.digest("base64url");
};

// ── Module-level Singleton ──

let cachedConfig: ImgproxyConfig | null = null;

/** Lazily resolve imgproxy config from the app config singleton. */
const getConfig = (): ImgproxyConfig => {
  if (cachedConfig) return cachedConfig;
  // Import config at call time, not module load time, so tests can mock it.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { config } = require("../config.js") as { config: import("../config.js").Config };
  cachedConfig = {
    baseUrl: config.IMGPROXY_URL,
    key: config.IMGPROXY_KEY ?? "",
    salt: config.IMGPROXY_SALT ?? "",
    bucket: config.S3_BUCKET ?? "snc-storage",
    signingEnabled: !!(config.IMGPROXY_KEY && config.IMGPROXY_SALT),
  };
  return cachedConfig;
};

// ── Public API ──

/**
 * Build a single signed imgproxy URL for the given S3 key and target width.
 *
 * Height is auto-calculated (set to 0) unless explicitly specified via the
 * processing path. No output format is specified -- imgproxy negotiates
 * WebP/AVIF from the Accept header.
 *
 * @param s3Key - S3 object key (e.g. "content/{id}/thumbnail/photo.jpg")
 * @param width - Target pixel width
 * @param options - Resize type, gravity, and quality overrides
 */
export function buildImgproxyUrl(
  s3Key: string,
  width: number,
  options?: ImgproxyOptions,
): string {
  const cfg = getConfig();
  const rt = options?.resizeType ?? "fill";
  const g = options?.gravity ?? "ce";

  const parts = [`rs:${rt}:${width}:0`, `g:${g}`];
  if (options?.quality && options.quality > 0) {
    parts.push(`q:${options.quality}`);
  }

  const processingPath = parts.join("/");
  const sourceUrl = `s3://${cfg.bucket}/${s3Key}`;
  const path = `/${processingPath}/plain/${sourceUrl}`;

  const signature = cfg.signingEnabled
    ? signPath(cfg.key, cfg.salt, path)
    : "unsafe";

  return `${cfg.baseUrl}/${signature}${path}`;
}

/**
 * Build a width-descriptor srcSet string for responsive images.
 *
 * Each entry is `{url} {width}w`. The browser picks the best match using
 * the `sizes` attribute on the `<img>` element.
 *
 * @param s3Key - S3 object key
 * @param widths - Array of pixel widths for srcSet entries
 * @param options - Resize type, gravity, and quality overrides
 */
export function buildSrcSet(
  s3Key: string,
  widths: readonly number[],
  options?: ImgproxyOptions,
): string {
  return widths
    .map((w) => `${buildImgproxyUrl(s3Key, w, options)} ${w}w`)
    .join(", ");
}

/**
 * Build a DPR-based srcSet string for fixed-size images (avatars, small thumbnails).
 *
 * Each entry is `{url} {dpr}x`. The browser picks the entry matching the
 * device pixel ratio. Both width and height are specified to prevent
 * upscaling artifacts on fixed-dimension containers.
 *
 * @param s3Key - S3 object key
 * @param logicalWidth - CSS pixel width of the image container
 * @param logicalHeight - CSS pixel height of the image container
 * @param options - Resize type, gravity, and quality overrides
 */
export function buildDprSrcSet(
  s3Key: string,
  logicalWidth: number,
  logicalHeight: number,
  options?: ImgproxyOptions,
): string {
  const cfg = getConfig();
  const rt = options?.resizeType ?? "fill";
  const g = options?.gravity ?? "ce";

  return AVATAR_DPRS
    .map((dpr) => {
      const parts = [
        `rs:${rt}:${logicalWidth}:${logicalHeight}`,
        `g:${g}`,
        `dpr:${dpr}`,
      ];
      if (options?.quality && options.quality > 0) {
        parts.push(`q:${options.quality}`);
      }
      const sourceUrl = `s3://${cfg.bucket}/${s3Key}`;
      const path = `/${parts.join("/")}/plain/${sourceUrl}`;
      const signature = cfg.signingEnabled
        ? signPath(cfg.key, cfg.salt, path)
        : "unsafe";
      return `${cfg.baseUrl}/${signature}${path} ${dpr}x`;
    })
    .join(", ");
}

/** Reset cached config. Exposed for tests only. */
export function _resetConfigCache(): void {
  cachedConfig = null;
}
```

**Config changes -- `platform/apps/api/src/config.ts`:**

Add to `ENV_SCHEMA`:

```typescript
  // imgproxy (optional — image proxy disabled when IMGPROXY_URL absent)
  IMGPROXY_URL: z.string().url().optional(),
  IMGPROXY_KEY: z.string().optional(),
  IMGPROXY_SALT: z.string().optional(),
```

Place after the existing S3 variables block (after `S3_SECRET_ACCESS_KEY`).

**Dev `.env` additions:**

```
IMGPROXY_URL=http://snc-imgproxy:8080
```

`IMGPROXY_KEY` and `IMGPROXY_SALT` are omitted in dev (signing disabled, `unsafe` prefix used).

**Implementation notes:**
- `getConfig()` uses lazy initialization to avoid import-time coupling to `config.ts`. This lets tests `vi.doMock("../config.js")` before calling the URL builder functions.
- The `_resetConfigCache()` function follows the existing test-support pattern (underscore prefix for test-only exports).
- When `IMGPROXY_URL` is absent (not yet configured), the URL builder functions will throw when called. Callers (Unit 3) must guard on `config.IMGPROXY_URL` being defined before generating imgproxy URLs, falling back to the existing proxy route URLs.
- No output format extension is appended. imgproxy performs automatic format negotiation via `IMGPROXY_ENFORCE_WEBP` and `IMGPROXY_ENFORCE_AVIF`, selecting the best format the client supports based on the `Accept` header.

**Acceptance criteria:**
- [ ] `buildImgproxyUrl("content/abc/thumbnail/photo.jpg", 640)` returns `http://snc-imgproxy:8080/unsafe/rs:fill:640:0/g:ce/plain/s3://snc-storage/content/abc/thumbnail/photo.jpg`
- [ ] `buildSrcSet("content/abc/thumbnail/photo.jpg", THUMBNAIL_WIDTHS)` returns four `{url} {w}w` entries
- [ ] `buildDprSrcSet("creators/abc/avatar/pic.jpg", 80, 80)` returns three `{url} {dpr}x` entries
- [ ] When `IMGPROXY_KEY`/`IMGPROXY_SALT` are set, signatures are computed (not `unsafe`)
- [ ] Unit tests cover signing enabled/disabled, custom options, and all three public functions
- [ ] `bun run --filter @snc/api build` succeeds

---

### Unit 3: Image URL Resolution Refactor

**Files:**
- `platform/packages/shared/src/content.ts` (add `ResponsiveImage` schema, extend `ContentResponseSchema` and `FeedItemSchema`)
- `platform/packages/shared/src/creator.ts` (extend `CreatorProfileResponseSchema` and `CreatorListItemSchema`)
- `platform/packages/shared/src/index.ts` (no change -- already re-exports both modules)
- `platform/apps/api/src/lib/content-helpers.ts` (update `resolveContentUrls`)
- `platform/apps/api/src/lib/creator-url.ts` (update `resolveCreatorUrls`)
- `platform/apps/api/src/lib/creator-helpers.ts` (update `toProfileResponse`)

#### 3a. Shared types -- `platform/packages/shared/src/content.ts`

Add a `ResponsiveImageSchema` and extend the response schemas:

```typescript
// ── Responsive Image Schema ──

export const ResponsiveImageSchema = z.object({
  /** Primary image URL (fallback src). */
  src: z.string(),
  /** Width-descriptor srcSet string (e.g. "url 320w, url 640w"). */
  srcSet: z.string().nullable(),
  /** Suggested sizes attribute (e.g. "(max-width: 768px) 100vw, 33vw"). */
  sizes: z.string().nullable(),
});

export type ResponsiveImage = z.infer<typeof ResponsiveImageSchema>;
```

Add a `DprImageSchema` for fixed-size images:

```typescript
export const DprImageSchema = z.object({
  /** Primary image URL (1x fallback). */
  src: z.string(),
  /** DPR-descriptor srcSet string (e.g. "url 1x, url 2x, url 3x"). */
  srcSet: z.string().nullable(),
});

export type DprImage = z.infer<typeof DprImageSchema>;
```

Extend `ContentResponseSchema`:

```typescript
export const ContentResponseSchema = z.object({
  // ... existing fields unchanged ...
  thumbnailUrl: z.string().nullable(),
  thumbnail: ResponsiveImageSchema.nullable(),  // NEW
  // ... rest of fields ...
});
```

Extend `FeedItemSchema` (inherits `thumbnail` from `ContentResponseSchema.extend()`).

Extend `CreatorProfileResponseSchema` in `platform/packages/shared/src/creator.ts`:

```typescript
export const CreatorProfileResponseSchema = z.object({
  // ... existing fields unchanged ...
  avatarUrl: z.string().nullable(),
  bannerUrl: z.string().nullable(),
  avatar: DprImageSchema.nullable(),   // NEW
  banner: ResponsiveImageSchema.nullable(),  // NEW
  // ... rest of fields ...
});
```

`CreatorListItemSchema` inherits `avatar` and `banner` from `CreatorProfileResponseSchema.extend()`.

**Inferred types update automatically** -- `ContentResponse`, `FeedItem`, `CreatorProfileResponse`, and `CreatorListItem` gain the new fields via `z.infer`.

#### 3b. API resolution -- `platform/apps/api/src/lib/content-helpers.ts`

Update `resolveContentUrls`:

```typescript
import { buildImgproxyUrl, buildSrcSet, THUMBNAIL_WIDTHS } from "./imgproxy.js";
import { config } from "../config.js";
import type { ContentResponse, ResponsiveImage } from "@snc/shared";

const THUMBNAIL_SIZES = "(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw";

/** Build a ResponsiveImage object for a content thumbnail, or null if no key. */
const buildThumbnail = (
  id: string,
  thumbnailKey: string | null,
): { thumbnailUrl: string | null; thumbnail: ResponsiveImage | null } => {
  const fallbackUrl = thumbnailKey ? `/api/content/${id}/thumbnail` : null;

  if (!thumbnailKey || !config.IMGPROXY_URL) {
    return { thumbnailUrl: fallbackUrl, thumbnail: null };
  }

  const src = buildImgproxyUrl(thumbnailKey, 640);
  const srcSet = buildSrcSet(thumbnailKey, THUMBNAIL_WIDTHS);
  return {
    thumbnailUrl: fallbackUrl,
    thumbnail: { src, srcSet, sizes: THUMBNAIL_SIZES },
  };
};

export const resolveContentUrls = (row: ContentRow): ContentResponse => {
  const { thumbnailUrl, thumbnail } = buildThumbnail(row.id, row.thumbnailKey);
  return {
    id: row.id,
    creatorId: row.creatorId,
    slug: row.slug ?? null,
    type: row.type,
    title: row.title,
    body: row.body ?? null,
    description: row.description ?? null,
    visibility: row.visibility,
    sourceType: row.sourceType,
    thumbnailUrl,
    thumbnail,
    mediaUrl: row.mediaKey ? `/api/content/${row.id}/media` : null,
    publishedAt: toISOOrNull(row.publishedAt),
    createdAt: toISO(row.createdAt),
    updatedAt: toISO(row.updatedAt),
    processingStatus: row.processingStatus ?? null,
    videoCodec: row.videoCodec ?? null,
    audioCodec: row.audioCodec ?? null,
    width: row.width ?? null,
    height: row.height ?? null,
    duration: row.duration ?? null,
    bitrate: row.bitrate ?? null,
  };
};
```

#### 3c. API resolution -- `platform/apps/api/src/lib/creator-url.ts`

Update `resolveCreatorUrls`:

```typescript
import { buildImgproxyUrl, buildDprSrcSet, buildSrcSet, BANNER_WIDTHS } from "./imgproxy.js";
import { config } from "../config.js";
import type { DprImage, ResponsiveImage } from "@snc/shared";

const BANNER_SIZES = "100vw";

/** Resolve avatar/banner URLs for a creator profile, including responsive image data. */
export const resolveCreatorUrls = (
  profile: { id: string; avatarKey: string | null; bannerKey: string | null },
): {
  avatarUrl: string | null;
  bannerUrl: string | null;
  avatar: DprImage | null;
  banner: ResponsiveImage | null;
} => {
  const avatarFallback = profile.avatarKey
    ? `/api/creators/${profile.id}/avatar`
    : null;
  const bannerFallback = profile.bannerKey
    ? `/api/creators/${profile.id}/banner`
    : null;

  if (!config.IMGPROXY_URL) {
    return {
      avatarUrl: avatarFallback,
      bannerUrl: bannerFallback,
      avatar: null,
      banner: null,
    };
  }

  const avatar: DprImage | null = profile.avatarKey
    ? {
        src: buildImgproxyUrl(profile.avatarKey, 96),
        srcSet: buildDprSrcSet(profile.avatarKey, 96, 96),
      }
    : null;

  const banner: ResponsiveImage | null = profile.bannerKey
    ? {
        src: buildImgproxyUrl(profile.bannerKey, 960),
        srcSet: buildSrcSet(profile.bannerKey, BANNER_WIDTHS),
        sizes: BANNER_SIZES,
      }
    : null;

  return {
    avatarUrl: avatarFallback,
    bannerUrl: bannerFallback,
    avatar,
    banner,
  };
};
```

#### 3d. API resolution -- `platform/apps/api/src/lib/creator-helpers.ts`

Update `toProfileResponse` to pass through the new fields:

```typescript
export const toProfileResponse = (
  profile: CreatorProfileRow,
  contentCount: number,
): CreatorProfileResponse => {
  const urls = resolveCreatorUrls(profile);
  return {
    id: profile.id,
    displayName: profile.displayName,
    bio: profile.bio ?? null,
    handle: profile.handle ?? null,
    avatarUrl: urls.avatarUrl,
    bannerUrl: urls.bannerUrl,
    avatar: urls.avatar,
    banner: urls.banner,
    socialLinks: profile.socialLinks ?? [],
    contentCount,
    status: profile.status,
    createdAt: toISO(profile.createdAt),
    updatedAt: toISO(profile.updatedAt),
  };
};
```

**Also update `platform/apps/api/src/services/channels.ts`** where `resolveCreatorUrls` is called. The channels service builds a `creator` sub-object for each channel. Add `avatar` to the creator sub-object shape, or ignore the new fields if the channel API response type doesn't need responsive images. Decision: pass `avatar` through since the live page renders creator avatars.

**Implementation notes:**
- `thumbnailUrl` and `avatarUrl`/`bannerUrl` continue to return the old proxy route URLs. This preserves backward compatibility for:
  - `og:image` meta tags (which crawlers fetch directly -- they don't support srcSet)
  - JSON-LD `thumbnailUrl` and `image` fields
  - Any external consumers of the API
- The `thumbnail`, `avatar`, and `banner` fields are nullable. When `IMGPROXY_URL` is not configured, they are `null` and the web app falls back to the `thumbnailUrl`/`avatarUrl`/`bannerUrl` proxy routes.
- The old proxy routes (`GET /api/content/:id/thumbnail`, `GET /api/creators/:creatorId/avatar`, `GET /api/creators/:creatorId/banner`) remain unchanged. They continue to work for og:image crawlers, as fallback URLs, and during migration.

**Acceptance criteria:**
- [ ] `bun run --filter @snc/shared build` succeeds
- [ ] `bun run --filter @snc/api build` succeeds
- [ ] `GET /api/content?limit=1` returns items with `thumbnail: { src, srcSet, sizes }` when `IMGPROXY_URL` is set
- [ ] `GET /api/content?limit=1` returns items with `thumbnail: null` when `IMGPROXY_URL` is unset
- [ ] `GET /api/creators?limit=1` returns items with `avatar` and `banner` fields
- [ ] `thumbnailUrl`, `avatarUrl`, `bannerUrl` still return the old `/api/...` proxy URLs
- [ ] Existing tests in `@snc/api` continue to pass (they should get `thumbnail: null` since test config won't set `IMGPROXY_URL`)

---

### Unit 4: OptionalImage Responsive Upgrade

**File:** `platform/apps/web/src/components/ui/optional-image.tsx`

**Updated types and component:**

```typescript
import type React from "react";

// ── Public Types ──

export interface OptionalImageProps {
  readonly src: string | null | undefined;
  readonly alt: string;
  readonly className: string;
  readonly placeholderClassName: string;
  readonly loading?: "lazy" | "eager";
  readonly width?: number;
  readonly height?: number;
  /** Width-descriptor or DPR-descriptor srcSet string. */
  readonly srcSet?: string | null;
  /** Sizes attribute for width-descriptor srcSet. */
  readonly sizes?: string | null;
}

// ── Public API ──

/**
 * Render an `<img>` when a src URL is provided, or a styled placeholder
 * `<div>` when src is null/undefined.
 *
 * When `srcSet` and `sizes` are provided, the browser selects the best
 * image variant. `src` is the fallback for browsers without srcSet support.
 */
export function OptionalImage({
  src,
  alt,
  className,
  placeholderClassName,
  loading,
  width,
  height,
  srcSet,
  sizes,
}: OptionalImageProps): React.ReactElement {
  if (src) {
    return (
      <img
        src={src}
        alt={alt}
        className={className}
        loading={loading}
        decoding="async"
        width={width}
        height={height}
        {...(srcSet ? { srcSet } : {})}
        {...(sizes ? { sizes } : {})}
      />
    );
  }

  return <div className={placeholderClassName} />;
}
```

**Implementation notes:**
- `srcSet` and `sizes` are optional -- no breaking change. Callers that don't pass them get the same behavior as before.
- Nullish values (`null`, `undefined`) are excluded from the rendered attributes via conditional spread. This prevents `srcSet=""` from appearing in the DOM.
- The `src` prop continues to serve as the fallback URL (for browsers that don't support srcSet, and for og:image/JSON-LD uses).

**Acceptance criteria:**
- [ ] Existing callers (without srcSet/sizes) render unchanged HTML
- [ ] `<OptionalImage src="/fallback.jpg" srcSet="img1 320w, img2 640w" sizes="100vw" ... />` renders `<img src="/fallback.jpg" srcSet="..." sizes="...">`
- [ ] `<OptionalImage src="/fallback.jpg" srcSet={null} sizes={null} ... />` renders `<img src="/fallback.jpg">` with no srcSet/sizes attributes
- [ ] `bun run --filter @snc/web build` succeeds

---

### Unit 5: Update Image Consumers

Update each component that renders images to pass responsive data from the API response.

#### 5a. ContentCard -- `platform/apps/web/src/components/content/content-card.tsx`

```diff
 export function ContentCard({ item }: ContentCardProps): React.ReactElement {
-  const thumbnailSrc = item.thumbnailUrl;
+  const thumbnailSrc = item.thumbnail?.src ?? item.thumbnailUrl;
+  const thumbnailSrcSet = item.thumbnail?.srcSet ?? null;
+  const thumbnailSizes = item.thumbnail?.sizes ?? null;

   // ...

           <OptionalImage
             src={thumbnailSrc}
             alt={item.title}
             className={styles.thumbnail!}
             placeholderClassName={styles.thumbnailPlaceholder!}
             loading="lazy"
+            srcSet={thumbnailSrcSet}
+            sizes={thumbnailSizes}
           />
```

#### 5b. VideoDetailView -- `platform/apps/web/src/components/content/video-detail-view.tsx`

The poster image is currently a raw `<img>` (not OptionalImage). Update to pass srcSet:

```diff
-  const posterSrc = item.thumbnailUrl;
+  const posterSrc = item.thumbnail?.src ?? item.thumbnailUrl;

   // In the play overlay button:
-  {posterSrc && <img src={posterSrc} alt="" className={styles.poster} width={640} height={360} />}
+  {posterSrc && (
+    <img
+      src={posterSrc}
+      alt=""
+      className={styles.poster}
+      width={640}
+      height={360}
+      {...(item.thumbnail?.srcSet ? { srcSet: item.thumbnail.srcSet } : {})}
+      sizes="(max-width: 768px) 100vw, 640px"
+    />
+  )}
```

Also update the `posterUrl` in `MediaMetadata` to use the imgproxy 1x URL:

```diff
   const videoMetadata: MediaMetadata = {
     id: item.id,
     contentType: "video",
     title: item.title,
     artist: item.creatorName,
-    posterUrl: item.thumbnailUrl,
+    posterUrl: item.thumbnail?.src ?? item.thumbnailUrl,
     source: { src: mediaSrc, type: "video/mp4" },
     streamType: "on-demand",
     contentUrl,
   };
```

#### 5c. AudioDetailView -- `platform/apps/web/src/components/content/audio-detail-view.tsx`

Multiple raw `<img>` tags render cover art. Update each:

```diff
-  const coverArtSrc = item.thumbnailUrl;
+  const coverArtSrc = item.thumbnail?.src ?? item.thumbnailUrl;
+  const coverArtSrcSet = item.thumbnail?.srcSet ?? undefined;
```

Apply `srcSet` and `sizes="280px"` to each `<img>` rendering `coverArtSrc`:

```diff
   <img
     src={coverArtSrc}
     alt={...}
     className={styles.coverArt}
     width={280}
     height={280}
+    {...(coverArtSrcSet ? { srcSet: coverArtSrcSet, sizes: "280px" } : {})}
   />
```

Update `posterUrl` in `MediaMetadata` similarly to VideoDetailView.

#### 5d. CreatorCard -- `platform/apps/web/src/components/creator/creator-card.tsx`

```diff
-  const avatarSrc = creator.avatarUrl;
+  const avatarSrc = creator.avatar?.src ?? creator.avatarUrl;
+  const avatarSrcSet = creator.avatar?.srcSet ?? null;

   // Grid view (80x80 avatar):
   <OptionalImage
     src={avatarSrc}
     alt={`${creator.displayName} avatar`}
     className={styles.avatar!}
     placeholderClassName={styles.avatarPlaceholder!}
     loading="lazy"
     width={80}
     height={80}
+    srcSet={avatarSrcSet}
   />

   // List view (40x40 avatar):
   <OptionalImage
     src={avatarSrc}
     alt={`${creator.displayName} avatar`}
     className={styles.listAvatar!}
     placeholderClassName={styles.listAvatarPlaceholder!}
     loading="lazy"
     width={40}
     height={40}
+    srcSet={avatarSrcSet}
   />
```

Note: DPR-based srcSet does not use `sizes` -- the browser selects based on device pixel ratio. The `width`/`height` attributes communicate the CSS pixel dimensions.

#### 5e. CreatorHeader -- `platform/apps/web/src/components/creator/creator-header.tsx`

```diff
-  const bannerSrc = creator.bannerUrl;
-  const avatarSrc = creator.avatarUrl;
+  const bannerSrc = creator.banner?.src ?? creator.bannerUrl;
+  const bannerSrcSet = creator.banner?.srcSet ?? null;
+  const bannerSizes = creator.banner?.sizes ?? null;
+  const avatarSrc = creator.avatar?.src ?? creator.avatarUrl;
+  const avatarSrcSet = creator.avatar?.srcSet ?? null;

   // Banner:
   <OptionalImage
     src={bannerSrc}
     alt={`${creator.displayName} banner`}
     className={styles.banner!}
     placeholderClassName={styles.bannerPlaceholder!}
     width={800}
     height={200}
+    srcSet={bannerSrcSet}
+    sizes={bannerSizes}
   />

   // Avatar:
   <OptionalImage
     src={avatarSrc}
     alt={`${creator.displayName} avatar`}
     className={styles.avatar!}
     placeholderClassName={styles.avatarPlaceholder!}
     width={96}
     height={96}
+    srcSet={avatarSrcSet}
   />
```

#### 5f. Landing page sections

`RecentContent` and `FeaturedCreators` already delegate to `ContentCard` and `CreatorCard` respectively. No changes needed in the landing components themselves -- the responsive data flows through the existing `FeedItem` and `CreatorListItem` types.

#### 5g. ChatPanel -- `platform/apps/web/src/components/chat/chat-panel.tsx`

Chat avatars are small (20px) and come from the WebSocket message payload, not the REST API response. These images use user avatar URLs, not creator profile URLs. **No change needed for chat avatars in this unit** -- the chat message type would need a separate schema update, and the 20px avatar size does not benefit meaningfully from responsive images.

#### 5h. Live page -- `platform/apps/web/src/routes/live.tsx`

Creator avatars in the channel bar use raw `<img>` tags with `creator.avatarUrl`. Update to use `creator.avatar`:

```diff
-  {creator.avatarUrl && (
+  {(creator.avatar?.src ?? creator.avatarUrl) && (
     <img
-      src={creator.avatarUrl}
+      src={creator.avatar?.src ?? creator.avatarUrl}
       alt=""
       className={styles.creatorAvatar}
+      {...(creator.avatar?.srcSet ? { srcSet: creator.avatar.srcSet } : {})}
     />
   )}
```

This depends on the channel API response including `avatar` in its creator sub-object (handled in Unit 3's channels service update).

#### 5i. og:image and JSON-LD -- no changes

`og:image` tags in route `head()` functions and JSON-LD helpers (`lib/json-ld.ts`) continue to use `thumbnailUrl`, `avatarUrl`, and `bannerUrl` (the old proxy route URLs). These are absolute URLs that crawlers can fetch directly. Switching them to imgproxy URLs would work but adds complexity for no benefit -- crawlers don't support srcSet.

#### 5j. ThumbnailEditSection -- `platform/apps/web/src/components/content/thumbnail-edit-section.tsx`

The edit section receives `thumbnailSrc` as a prop from the manage content view. The parent component should prefer `thumbnail?.src ?? thumbnailUrl`. No changes needed in ThumbnailEditSection itself -- it already renders a simple `<img src={thumbnailSrc}>` which is appropriate for the management UI.

**Acceptance criteria:**
- [ ] ContentCard renders `<img srcSet="..." sizes="...">` when thumbnail data includes responsive fields
- [ ] ContentCard renders `<img src="...">` without srcSet when `thumbnail` is null
- [ ] CreatorCard renders `<img srcSet="... 1x, ... 2x, ... 3x">` for avatars
- [ ] CreatorHeader renders responsive banner and DPR-based avatar
- [ ] VideoDetailView and AudioDetailView poster/cover art use srcSet
- [ ] og:image meta tags still use `/api/content/{id}/thumbnail` proxy URLs
- [ ] `bun run --filter @snc/web build` succeeds

---

### Unit 6: Garage Read-Only Access Key for imgproxy

**File:** `scripts/platform/init-garage.sh`

Add a new section after the existing bucket creation block to create a dedicated read-only key for imgproxy:

```bash
# Create read-only API key for imgproxy
IMGPROXY_KEY_NAME="imgproxy-reader"

if $GARAGE key info "$IMGPROXY_KEY_NAME" >/dev/null 2>&1; then
  echo "API key '$IMGPROXY_KEY_NAME' already exists"
else
  echo "Creating read-only API key '$IMGPROXY_KEY_NAME'..."
  IMGPROXY_KEY_OUTPUT=$($GARAGE key create "$IMGPROXY_KEY_NAME" 2>&1)

  IMGPROXY_ACCESS=$(echo "$IMGPROXY_KEY_OUTPUT" | grep "Key ID:" | awk '{print $NF}')
  IMGPROXY_SECRET=$(echo "$IMGPROXY_KEY_OUTPUT" | grep "Secret key:" | awk '{print $NF}')

  # Grant read-only access to the storage bucket
  $GARAGE bucket allow --read "$BUCKET" --key "$IMGPROXY_KEY_NAME" 2>&1 | tail -1

  echo ""
  echo "=== imgproxy S3 Credentials (read-only) ==="
  echo "GARAGE_IMGPROXY_ACCESS_KEY=$IMGPROXY_ACCESS"
  echo "GARAGE_IMGPROXY_SECRET_KEY=$IMGPROXY_SECRET"
  echo "=== Add these to platform/.env ==="
  echo ""
fi
```

**Implementation notes:**
- The key is created with Garage's `key create` CLI command, then granted **read-only** bucket access via `bucket allow --read` (no `--write`, no `--owner`).
- This is idempotent -- if the key already exists, the script skips creation.
- The key name `imgproxy-reader` clearly communicates its purpose.
- In dev, operators can initially reuse the main `snc-dev-key` credentials for imgproxy (by setting `GARAGE_IMGPROXY_ACCESS_KEY` = `S3_ACCESS_KEY_ID`). This dedicated key is the production-ready path.
- The output instructs the user to add the credentials to `.env`, matching the existing pattern for the `snc-dev-key`.

**Acceptance criteria:**
- [ ] Running `scripts/platform/init-garage.sh` creates an `imgproxy-reader` key
- [ ] Running the script again does not error (idempotent)
- [ ] The key has read-only access to `snc-storage` bucket (can `GetObject`, cannot `PutObject`)
- [ ] `snc-imgproxy` can fetch images from Garage using this key

---

## Implementation Order

```
Unit 1 (Docker service)
  |
  +---> Unit 6 (Garage read-only key) -- can run in parallel with Unit 2
  |
  +---> Unit 2 (URL builder)
          |
          +---> Unit 3 (URL resolution refactor) -- depends on shared types + URL builder
                  |
                  +---> Unit 4 (OptionalImage upgrade) -- can start in parallel with Unit 3
                  |       |
                  |       +---> Unit 5 (Update consumers) -- depends on both Unit 3 and Unit 4
                  |
                  +---> Unit 5
```

**Recommended sequence:**
1. **Unit 1** -- get imgproxy running in Docker
2. **Unit 6** -- create the read-only key (quick, pairs with Unit 1)
3. **Unit 2** -- build and test the URL builder utility
4. **Unit 3** -- refactor shared types and API resolution (rebuild `@snc/shared` first, then `@snc/api`)
5. **Unit 4** -- upgrade OptionalImage (can overlap with late Unit 3 work)
6. **Unit 5** -- wire everything together across all consumers

Units 1+6 and Unit 4 have no code dependencies on each other and can be implemented in parallel by different agents.

---

## Testing

### Unit 2 tests -- `platform/apps/api/tests/lib/imgproxy.test.ts`

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// vi.doMock pattern for config singleton
const mockConfig = {
  IMGPROXY_URL: "http://snc-imgproxy:8080",
  IMGPROXY_KEY: "",
  IMGPROXY_SALT: "",
  S3_BUCKET: "snc-storage",
};

vi.doMock("../../src/config.js", () => ({ config: mockConfig }));

const {
  buildImgproxyUrl,
  buildSrcSet,
  buildDprSrcSet,
  THUMBNAIL_WIDTHS,
  BANNER_WIDTHS,
  _resetConfigCache,
} = await import("../../src/lib/imgproxy.js");

describe("imgproxy URL builder", () => {
  beforeEach(() => {
    _resetConfigCache();
    mockConfig.IMGPROXY_KEY = "";
    mockConfig.IMGPROXY_SALT = "";
  });

  afterEach(() => {
    vi.resetModules();
  });

  describe("buildImgproxyUrl", () => {
    it("generates unsigned URL when signing is disabled", () => {
      const url = buildImgproxyUrl("content/abc/thumbnail/photo.jpg", 640);
      expect(url).toBe(
        "http://snc-imgproxy:8080/unsafe/rs:fill:640:0/g:ce/plain/s3://snc-storage/content/abc/thumbnail/photo.jpg",
      );
    });

    it("generates signed URL when key and salt are set", () => {
      mockConfig.IMGPROXY_KEY = "943b421c9eb07c830af81030552c86009268de4e532ba2ee2eab8247c6da0881";
      mockConfig.IMGPROXY_SALT = "520f986b998545b4785e0defbc4f3c1203f22de2374a3d53cb7a7fe9fea309c5";
      _resetConfigCache();

      const url = buildImgproxyUrl("content/abc/thumbnail/photo.jpg", 640);
      expect(url).not.toContain("/unsafe/");
      expect(url).toContain("/rs:fill:640:0/g:ce/plain/s3://snc-storage/");
    });

    it("applies custom resize type and gravity", () => {
      const url = buildImgproxyUrl("key.jpg", 400, {
        resizeType: "fit",
        gravity: "sm",
      });
      expect(url).toContain("/rs:fit:400:0/g:sm/");
    });

    it("includes quality when specified", () => {
      const url = buildImgproxyUrl("key.jpg", 400, { quality: 75 });
      expect(url).toContain("/q:75/");
    });
  });

  describe("buildSrcSet", () => {
    it("generates width-descriptor srcSet", () => {
      const srcSet = buildSrcSet("key.jpg", THUMBNAIL_WIDTHS);
      const entries = srcSet.split(", ");
      expect(entries).toHaveLength(4);
      expect(entries[0]).toMatch(/ 320w$/);
      expect(entries[1]).toMatch(/ 640w$/);
      expect(entries[2]).toMatch(/ 960w$/);
      expect(entries[3]).toMatch(/ 1280w$/);
    });
  });

  describe("buildDprSrcSet", () => {
    it("generates DPR-descriptor srcSet", () => {
      const srcSet = buildDprSrcSet("avatar.jpg", 96, 96);
      const entries = srcSet.split(", ");
      expect(entries).toHaveLength(3);
      expect(entries[0]).toMatch(/ 1x$/);
      expect(entries[1]).toMatch(/ 2x$/);
      expect(entries[2]).toMatch(/ 3x$/);
    });

    it("includes width and height in path", () => {
      const srcSet = buildDprSrcSet("avatar.jpg", 80, 80);
      expect(srcSet).toContain("rs:fill:80:80");
    });
  });
});
```

### Unit 3 tests -- update existing content/creator helper tests

Existing tests for `resolveContentUrls` and `resolveCreatorUrls` should be updated to verify the new `thumbnail`, `avatar`, and `banner` fields. When `IMGPROXY_URL` is not set in the test config, these fields should be `null`.

### Unit 4 tests -- `platform/apps/web/tests/components/ui/optional-image.test.tsx`

```typescript
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { OptionalImage } from "../../../src/components/ui/optional-image.js";

describe("OptionalImage", () => {
  it("renders img with srcSet and sizes when provided", () => {
    const { container } = render(
      <OptionalImage
        src="/fallback.jpg"
        alt="test"
        className="img"
        placeholderClassName="ph"
        srcSet="img1.jpg 320w, img2.jpg 640w"
        sizes="100vw"
      />,
    );
    const img = container.querySelector("img")!;
    expect(img.getAttribute("srcSet")).toBe("img1.jpg 320w, img2.jpg 640w");
    expect(img.getAttribute("sizes")).toBe("100vw");
    expect(img.getAttribute("src")).toBe("/fallback.jpg");
  });

  it("omits srcSet and sizes when null", () => {
    const { container } = render(
      <OptionalImage
        src="/fallback.jpg"
        alt="test"
        className="img"
        placeholderClassName="ph"
        srcSet={null}
        sizes={null}
      />,
    );
    const img = container.querySelector("img")!;
    expect(img.hasAttribute("srcSet")).toBe(false);
    expect(img.hasAttribute("sizes")).toBe(false);
  });

  it("renders placeholder when src is null", () => {
    const { container } = render(
      <OptionalImage
        src={null}
        alt="test"
        className="img"
        placeholderClassName="ph"
        srcSet="img1.jpg 320w"
        sizes="100vw"
      />,
    );
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector(".ph")).not.toBeNull();
  });
});
```

### Integration verification

After all units are deployed, verify end-to-end:

1. Upload a thumbnail via the manage content UI
2. Load the feed page and inspect the `<img>` element in DevTools
3. Confirm `srcSet` contains multiple width descriptors
4. Confirm the browser requests an appropriately sized image (check Network tab)
5. Confirm WebP or AVIF is served when the browser supports it (check response Content-Type)
6. Confirm the og:image meta tag still uses the proxy route URL

---

## Verification Checklist

- [ ] `docker compose up -d` starts `snc-imgproxy` and it passes health checks
- [ ] imgproxy can read from Garage S3 (test with `unsafe` prefix and an existing key)
- [ ] `bun run --filter @snc/shared build` succeeds with new schemas
- [ ] `bun run --filter @snc/api build` succeeds with imgproxy URL builder and config changes
- [ ] `bun run --filter @snc/web build` succeeds with OptionalImage changes
- [ ] `bun run --filter @snc/api test:unit` passes (including new imgproxy tests)
- [ ] `bun run --filter @snc/web test` passes (including new OptionalImage tests)
- [ ] Feed API response includes `thumbnail: { src, srcSet, sizes }` for items with thumbnails
- [ ] Creator API response includes `avatar` and `banner` with responsive data
- [ ] ContentCard, CreatorCard, CreatorHeader render `srcSet` attributes in the DOM
- [ ] Format negotiation works: requesting with `Accept: image/webp` returns WebP from imgproxy
- [ ] Old proxy routes (`/api/content/{id}/thumbnail`) still work
- [ ] og:image URLs in page source still use `/api/content/{id}/thumbnail` (not imgproxy URLs)
- [ ] No signing keys appear in client-side JavaScript bundles or rendered HTML
- [ ] `imgproxy-reader` Garage key has read-only permissions (cannot write)
