# Content Management

Content is the core publishing domain: creators produce audio, video, and written items that flow through a draft-to-published lifecycle with visibility gating. The system supports two storage backends (local filesystem for development, Garage S3-compatible for production) and two upload paths (legacy multipart-form for local, presigned-URL/multipart-chunked for S3). Content access is controlled by a 5-priority rule system that determines whether a user can view gated content based on authentication state, creator team membership, platform roles, and subscription status.

## How It Works

### Content Types

Three content types defined in `packages/shared/src/content.ts` as `CONTENT_TYPES`:

- **video** -- requires a media file (`mediaKey`) before publishing; served via streaming endpoint
- **audio** -- requires a media file (`mediaKey`) before publishing; served via streaming endpoint
- **written** -- body text only; no media file required or supported for upload

### Lifecycle

1. **Draft** -- created via `POST /api/content` with `publishedAt: null`. Written content requires a `body` field at creation. Video/audio content starts as an empty shell.
2. **Upload** -- media and thumbnails attached via upload endpoints (see [Upload Paths](#upload-paths) below). Storage keys recorded in `mediaKey` and `thumbnailKey` columns.
3. **Publish** -- `POST /api/content/:id/publish` sets `publishedAt` to the current timestamp. Video and audio content cannot be published without a `mediaKey`.
4. **Unpublish** -- `POST /api/content/:id/unpublish` reverts to draft by nullifying `publishedAt`.
5. **Soft-delete** -- `DELETE /api/content/:id` sets `deletedAt` timestamp and deletes associated storage files (media + thumbnail). Soft-deleted content is excluded from all queries.

### Visibility and Content Access

Content visibility is either `"public"` or `"subscribers"` (defined in `packages/shared/src/content.ts` as `VISIBILITY`).

The `checkContentAccess` function in `apps/api/src/services/content-access.ts` enforces 5 priority rules evaluated in order. The first matching rule wins:

| Priority | Rule | Result |
|----------|------|--------|
| 1 | Content visibility is `"public"` | Allowed |
| 2 | No authenticated user (guest) | Denied -- `AUTHENTICATION_REQUIRED` |
| 3 | User holds the `stakeholder` role, or is a member of any creator team | Allowed (free perk -- `hasPlatformSubscription: true` in batch context) |
| 4 | User has an active subscription covering this creator (platform-wide plan or creator-specific plan) | Allowed |
| 5 | None of the above | Denied -- `SUBSCRIPTION_REQUIRED` |

"Active subscription" means `status = "active"`, or `status = "canceled"` with `currentPeriodEnd` still in the future.

**Two access patterns exist:**

- **Batch (feed):** `buildContentAccessContext()` pre-fetches memberships and subscriptions once per request, then `hasContentAccess()` runs synchronously per item. Denied items have `mediaUrl` and `body` nullified but remain in the feed.
- **Per-item (detail/media):** `checkContentAccess()` delegates to the batch path internally, returning a `ContentGateResult` discriminated union (`{ allowed: true } | { allowed: false; reason; creatorId }`).

**Draft access** is separate: unpublished content is only visible to admins and creator team members (any team role: owner, editor, viewer). Stakeholders must be on the creator's team to see drafts -- there is no blanket stakeholder access for unpublished content. Enforced by `requireDraftAccess()`. Unauthorized users receive a 404 (not 403) to avoid leaking draft existence.

See [auth.md](auth.md) for role definitions and session middleware.

### Slugs

Content items receive auto-generated URL slugs scoped per creator via `generateUniqueSlug()`. Slugs are re-generated when the title changes. The `content_creator_slug_idx` unique index enforces uniqueness within a creator. Content can be resolved by either slug or UUID via the `by-creator` endpoint.

### Upload Paths

The system selects between three upload paths based on upload purpose and S3 availability. The client-side `UploadProvider` (`apps/web/src/contexts/upload-context.tsx`) maintains two Uppy instances — a tus-backed instance for large media and an S3-presign-backed instance for everything else — and routes each file to the appropriate one.

**tus path (large media — `content-media` + `playout-media`):** Client uploads through the `@uppy/tus` v5 plugin to the `snc-tusd` sidecar (a [tusd](https://tus.io/) tus-protocol server), which writes to Garage under the `tus/` prefix. On successful upload, tusd fires a `post-finish` webhook to `POST /api/tusd/hooks`; the hook validates the session from forwarded `Authorization`/`Cookie` headers, S3-copies the object into the canonical `<prefix>/<resourceId>/<field>/<filename>` path, deletes the tus source (+ its `.info` sidecar), then runs the standard completion flow via `completeUploadFlow`. Cross-session resume is automatic via tus-js-client's localStorage fingerprinting — re-dropping the same file picks up from the last offset.

**S3 presign path (small files — thumbnails, avatars, banners):** Client obtains a presigned PUT URL from `POST /api/uploads/presign`, uploads directly to storage, then calls `POST /api/uploads/complete` to record the key in the database. The complete endpoint verifies the file exists via `HEAD` and enforces size limits server-side.

**S3 presign multipart path (S3 only, files above `MULTIPART_THRESHOLD` = 50 MB that are not routed through tus):** The original chunked path, still wired but largely superseded by the tus path for media. Retained for callers that don't go through the Uppy tus instance:

1. `POST /api/uploads/s3/multipart` — create upload, get `uploadId` + `key`
2. `GET /api/uploads/s3/multipart/:uploadId/:partNumber?key=...` — sign each part
3. Upload each chunk (50 MB per `MULTIPART_CHUNK_SIZE`) directly to the presigned URL
4. `POST /api/uploads/s3/multipart/:uploadId/complete` — finalize with parts manifest
5. `POST /api/uploads/complete` — record in database

Aborted multipart uploads can be cleaned up via `DELETE /api/uploads/s3/multipart/:uploadId?key=...`. In-progress parts can be listed via `GET /api/uploads/s3/multipart/:uploadId?key=...` for resumption.

**Legacy direct-upload path (local development only):** Client sends the file as multipart form data to `POST /api/content/:id/upload?field=media|thumbnail`. The API server streams it to local disk. This path is only reachable when S3 is unavailable.

**Orphan cleanup:** a daily pg-boss cron job (`storage/cleanup-incomplete-uploads`, 3 AM) aborts incomplete multipart uploads ≥24h old, preferring the Garage Admin API and falling back to S3 `ListMultipartUploads` + `AbortMultipartUpload`.

### Media Streaming

Media and thumbnails are served through proxy endpoints that stream from the storage backend:

- `GET /api/content/:id/media` -- streams the main media file. Gated content requires access check (returns 401 for guests, 403 for users without a subscription). Cache: `private, max-age=3600`.
- `GET /api/content/:id/thumbnail` -- streams the thumbnail image. No access check (always public). Cache: `public, max-age=86400`.

The `streamFile` helper in `apps/api/src/lib/file-utils.ts` downloads from storage, infers MIME type from the file extension, and sets `Content-Type`, `Content-Length`, `Content-Disposition`, and `Cache-Control` headers.

Content responses never expose raw storage keys. The `resolveContentUrls` helper in `apps/api/src/lib/content-helpers.ts` maps `mediaKey` to `/api/content/{id}/media` and `thumbnailKey` to `/api/content/{id}/thumbnail`.

## Routes

All content routes are mounted under `/api/content`. Upload routes are mounted under `/api/uploads`.

### Content CRUD (`apps/api/src/routes/content.routes.ts`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/content` | Optional | Published content feed with cursor pagination. Filters: `type`, `creatorId`. Excludes video/audio without `mediaKey`. |
| `POST` | `/api/content` | Required | Create content draft. Requires `manageContent` permission on the target creator. |
| `GET` | `/api/content/drafts` | Required | List unpublished drafts for a creator. Requires `manageContent` permission. |
| `GET` | `/api/content/by-creator/:creatorIdentifier/:contentIdentifier` | Optional | Resolve content by creator handle/ID + content slug/ID. Draft access enforced. |
| `GET` | `/api/content/:id` | Optional | Get content by ID. Draft access enforced. Gated content has `mediaUrl`/`body` nullified. |
| `PATCH` | `/api/content/:id` | Required | Update content metadata. Can `clearThumbnail`/`clearMedia` to delete files. Slug regenerated on title change. |
| `DELETE` | `/api/content/:id` | Required | Soft-delete content and remove storage files. |
| `POST` | `/api/content/:id/publish` | Required | Publish a draft. Rejects if already published or if video/audio lacks media. |
| `POST` | `/api/content/:id/unpublish` | Required | Revert to draft. Rejects if already a draft. |

### Content Media (`apps/api/src/routes/content-media.routes.ts`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/api/content/:id/upload?field=media\|thumbnail` | Required | Legacy file upload (local storage). Validates MIME type and file size. |
| `GET` | `/api/content/:id/media` | Optional | Stream media file. Access-gated for `"subscribers"` visibility. |
| `GET` | `/api/content/:id/thumbnail` | None | Stream thumbnail image. Always public. |

### Uploads (`apps/api/src/routes/upload.routes.ts`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/api/uploads/presign` | Required | Get presigned PUT URL for direct-to-S3 upload. 503 if S3 not configured. |
| `POST` | `/api/uploads/s3/multipart` | Required | Create S3 multipart upload. |
| `GET` | `/api/uploads/s3/multipart/:uploadId/:partNumber?key=...` | Required | Sign a multipart part. |
| `POST` | `/api/uploads/s3/multipart/:uploadId/complete` | Required | Complete multipart upload (parts manifest). |
| `DELETE` | `/api/uploads/s3/multipart/:uploadId?key=...` | Required | Abort multipart upload. |
| `GET` | `/api/uploads/s3/multipart/:uploadId?key=...` | Required | List uploaded parts (for resumption). |
| `POST` | `/api/uploads/complete` | Required | Record upload in DB after direct-to-storage upload. Verifies file via HEAD, enforces size limits, deletes old file if replacing. |

### tus hooks (`apps/api/src/routes/tusd-hooks.routes.ts`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/api/tusd/hooks` | Forwarded session headers | tusd webhook dispatch. `pre-create` validates the forwarded session + purpose + resourceId; `post-finish` copies `tus/<id>` to the canonical key, deletes the tus source and `.info` sidecar, then runs `completeUploadFlow`; `post-terminate` logs the event. |

Upload routes handle both content files and creator profile images. The `purpose` field (`content-media`, `content-thumbnail`, `creator-avatar`, `creator-banner`, `playout-media`) determines the selected upload path and DB update target. See [creators.md](creators.md) for creator-specific upload context.

## Schema

### `content` table (`apps/api/src/db/schema/content.schema.ts`)

| Column | Type | Notes |
|--------|------|-------|
| `id` | `text` PK | UUID, generated at creation |
| `creator_id` | `text` FK | References `creator_profiles.id`, CASCADE delete |
| `type` | `text` | `"video"`, `"audio"`, or `"written"` |
| `title` | `text` NOT NULL | Max 200 characters |
| `slug` | `text` | Auto-generated, unique per creator |
| `body` | `text` | Written content body (nullable) |
| `description` | `text` | Max 2000 characters (nullable) |
| `visibility` | `text` | `"public"` (default) or `"subscribers"` |
| `source_type` | `text` | `"upload"` (default) or `"stream-recording"` |
| `thumbnail_key` | `text` | Storage key for thumbnail image (nullable) |
| `media_key` | `text` | Storage key for media file (nullable) |
| `published_at` | `timestamptz` | Null = draft, set = published |
| `deleted_at` | `timestamptz` | Soft-delete timestamp (nullable) |
| `created_at` | `timestamptz` | Auto-set |
| `updated_at` | `timestamptz` | Updated on every mutation |

**Indexes:**

- `content_creator_active_idx` on `(creator_id, deleted_at)` -- active content per creator
- `content_type_active_idx` on `(type, deleted_at)` -- filter by type
- `content_feed_idx` on `(visibility, deleted_at, published_at)` -- feed queries
- `content_creator_slug_idx` UNIQUE on `(creator_id, slug)` -- slug uniqueness per creator

### Shared types (`packages/shared/src/content.ts`)

- `ContentType`: `"video" | "audio" | "written"`
- `Visibility`: `"public" | "subscribers"`
- `ContentStatus`: `"draft" | "published"` (derived via `getContentStatus()`)
- `SourceType`: `"upload" | "stream-recording"` (from `packages/shared/src/uploads.ts`)
- `CreateContentSchema` / `UpdateContentSchema` -- Zod validation schemas
- `ContentResponseSchema` / `FeedItemSchema` / `FeedResponseSchema` -- API response schemas with cursor pagination
- `MAX_TITLE_LENGTH`: 200, `MAX_DESCRIPTION_LENGTH`: 2000

## Configuration

### Storage provider (`apps/api/src/config.ts`, `apps/api/src/storage/index.ts`)

| Env var | Default | Description |
|---------|---------|-------------|
| `STORAGE_TYPE` | `"local"` | `"local"` or `"s3"` |
| `STORAGE_LOCAL_DIR` | `"./uploads"` | Local filesystem base directory |
| `S3_ENDPOINT` | -- | S3-compatible endpoint URL (required when `STORAGE_TYPE=s3`) |
| `S3_REGION` | `"garage"` | S3 region (defaults to `"garage"` for Garage S3-compatible storage) |
| `S3_BUCKET` | -- | Bucket name (required when `STORAGE_TYPE=s3`) |
| `S3_ACCESS_KEY_ID` | -- | Access key (required when `STORAGE_TYPE=s3`) |
| `S3_SECRET_ACCESS_KEY` | -- | Secret key (required when `STORAGE_TYPE=s3`) |
| `FEATURE_CONTENT` | `"true"` | Feature flag to enable/disable the content domain |

The S3 client uses `forcePathStyle: true` for Garage compatibility. A single `S3Client` instance is shared between the `StorageProvider` and `S3MultipartService` singletons.

### File validation (`packages/shared/src/storage.ts`)

**ACCEPTED_MIME_TYPES:**

| Category | Types |
|----------|-------|
| video | `video/mp4`, `video/webm`, `video/quicktime` |
| audio | `audio/mpeg`, `audio/wav`, `audio/flac`, `audio/ogg`, `audio/aac` |
| image | `image/jpeg`, `image/png`, `image/webp` |

**MAX_FILE_SIZES:**

| Category | Limit |
|----------|-------|
| video | 20 GB |
| audio | 100 MB |
| image | 10 MB |

Thumbnails always use image constraints regardless of content type.

### Multipart upload thresholds (`packages/shared/src/uploads.ts`)

| Constant | Value | Description |
|----------|-------|-------------|
| `MULTIPART_THRESHOLD` | 50 MB | Files above this size use multipart upload |
| `MULTIPART_CHUNK_SIZE` | 50 MB | Size of each part in a multipart upload |

Presigned URLs expire after 3600 seconds (1 hour), configured in `upload.routes.ts` as `PRESIGN_EXPIRY_SECONDS`.

## Key Decisions

- **Storage keys, not URLs, in the database.** The `mediaKey` and `thumbnailKey` columns store storage-provider-agnostic keys (e.g., `content/{id}/media/filename.mp4`). The `resolveContentUrls` helper maps these to serving URLs at response time, decoupling storage layout from the API contract.

- **Proxy streaming, not direct S3 URLs for reads.** Media is served through `/api/content/:id/media` proxy endpoints rather than redirecting to signed S3 URLs. This enables access control enforcement at the proxy layer and avoids leaking storage topology to clients.

- **Direct-to-S3 for writes, proxy for reads.** Uploads bypass the API server by using presigned URLs, avoiding memory pressure from large files. The API only validates metadata and records the key after upload completes.

- **Dual upload paths with automatic detection.** The `UploadProvider` probes S3 availability and falls back to legacy multipart form upload transparently. This lets the same client code work in both local development and production.

- **Soft-delete for content, hard-delete for files.** Content rows are soft-deleted via `deletedAt` to allow potential recovery. Storage files (media + thumbnail) are hard-deleted immediately to reclaim space.

- **Creator team permission model.** Content ownership is checked via `requireCreatorPermission(userId, creatorId, "manageContent")` rather than a direct user-content FK. A creator is an entity with team members, not a single user. See [creators.md](creators.md) for the creator team model.

- **Feed excludes incomplete media content.** The feed query has a belt-and-suspenders filter: `type = "written" OR mediaKey IS NOT NULL`. This prevents video/audio items without uploaded media from appearing in the feed even if somehow published.

## Gotchas

- **Local storage does not support presigned uploads.** `getPresignedUploadUrl` returns a 501 error on the local provider. The client detects this and falls back to legacy upload. Direct-to-storage upload routes (`/api/uploads/presign`, `/api/uploads/s3/*`) return 503 when S3 is not configured.

- **The `complete` endpoint does double-duty.** `POST /api/uploads/complete` handles both content uploads and creator profile image uploads. The `purpose` field drives which DB table gets updated. Key prefix validation ensures the key matches the expected path for the purpose.

- **Written content cannot have media uploads.** Calling the legacy upload endpoint with `field=media` on written content throws a `ValidationError`. The presign path validates similarly via `getUploadConstraints`.

- **Draft content returns 404, not 403.** `requireDraftAccess` throws `NotFoundError` for unauthorized users to avoid revealing that a draft exists. Only admins and the creator's team members (any role) can see drafts.

- **Slug collisions are handled silently.** `generateUniqueSlug` appends a numeric suffix when a slug already exists for the same creator. Renaming content re-generates the slug, which could change the public URL.

- **The upload context probes S3 once per session.** The `s3AvailableRef` in `UploadProvider` caches the result of the first presign attempt. If S3 becomes available mid-session (unlikely but possible during development), the client continues using the legacy path until page reload.

- **Multipart completion has retry logic.** The `completeUpload` call after S3 upload success retries up to 3 times with exponential backoff (1s, 2s, 4s). This guards against transient network errors between the client and API when recording the upload.

- **Storage file deletion is best-effort.** Failed storage deletions (during content update, delete, or file replacement) are logged as warnings but do not fail the request. Orphaned files may accumulate.
