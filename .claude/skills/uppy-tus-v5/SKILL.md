---
name: uppy-tus-v5
description: >
  @uppy/tus v5 resumable upload plugin reference. Auto-loads when working with
  @uppy/tus, Uppy tus, resumable uploads, tus-js-client, upload resume,
  Tus plugin, uppy.use(Tus).
user-invocable: false
updated: 2026-04-23
---

# @uppy/tus v5 Reference

> **Package:** `@uppy/tus` v5 (wraps `tus-js-client ^4.2.3`)
> **Peer dependency:** `@uppy/core ^5.2.0`
> **Docs:** https://uppy.io/docs/tus/
> **Source:** https://github.com/transloadit/uppy/tree/main/packages/%40uppy/tus

See [reference.md](reference.md) for full options, code examples, and migration guide.

## v5 context

The `@uppy/tus` plugin API is **unchanged from v4** — same options, same event surface, same `tus-js-client` wrap. The major version bump is Uppy-ecosystem-wide alignment (coordinated monorepo release), not a plugin-level rewrite. What actually changed across the ecosystem:

- **CSS import paths** — `@uppy/<pkg>/dist/styles.min.css` → `@uppy/<pkg>/css/styles.min.css`. Applies to packages with CSS (`@uppy/dashboard`, etc.); `@uppy/tus` has no CSS.
- **Strict export maps** — deep imports like `@uppy/core/lib/foo.js` no longer work; only explicitly exported entry points resolve.
- **Package consolidation** — `@uppy/status-bar` and `@uppy/informer` merged into `@uppy/dashboard`; `@uppy/progress-bar`, `@uppy/drag-drop`, `@uppy/file-input` deprecated.
- **Peer-dep subpaths in `@uppy/react`** — `@uppy/react/dashboard` etc., so consumers install only needed peers.

None of those affect code that uses `@uppy/tus` as a standalone plugin on top of `@uppy/core`. Existing v4 code migrates unchanged.

## Installation

```bash
bun add @uppy/tus @uppy/core
# tus-js-client is a direct dependency of @uppy/tus — installed automatically
```

## Minimal Setup

```typescript
import Uppy from "@uppy/core";
import Tus from "@uppy/tus";

const uppy = new Uppy().use(Tus, {
  endpoint: "https://tusd.example.com/files/",
});
```

## Options Quick Reference

| Option | Type | Default | Notes |
|--------|------|---------|-------|
| `endpoint` | `string` | `""` | tusd server URL (required) |
| `headers` | `Record<string,string> \| (file) => Record<string,string>` | `{}` | Static or per-file headers |
| `chunkSize` | `number` | `Infinity` | Max PATCH body size; only set if server requires it |
| `retryDelays` | `number[]` | `[100, 1000, 3000, 5000]` | ms between retries; exponential backoff on 429 |
| `limit` | `number` | `20` | Concurrent uploads; 0 = unlimited |
| `withCredentials` | `boolean` | `false` | Send cookies cross-origin |
| `allowedMetaFields` | `boolean \| string[]` | `true` | `true` = all, `false` = none, array = whitelist |
| `onBeforeRequest` | `(req, file) => void \| Promise<void>` | — | Mutate request before send (add auth) |
| `onShouldRetry` | `(err, attempt, opts, next) => boolean` | — | Custom retry logic |
| `onAfterResponse` | `(req, res) => void \| Promise<void>` | — | Inspect response after receive |

### tus-js-client passthrough options (not in Uppy docs but accepted)

| Option | Type | Default | Notes |
|--------|------|---------|-------|
| `storeFingerprintForResuming` | `boolean` | `true` | Store upload URL in localStorage for cross-session resume |
| `removeFingerprintOnSuccess` | `boolean` | `false` | Clean localStorage entry after successful upload |
| `uploadDataDuringCreation` | `boolean` | `false` | Use creation-with-upload tus extension |
| `overridePatchMethod` | `boolean` | `false` | POST + X-HTTP-Method-Override instead of PATCH |
| `urlStorage` | `object` | `localStorage` | Custom storage backend for fingerprints |

## How Cross-Session Resume Works

1. **Fingerprint generation:** Uppy overrides tus-js-client's default fingerprint with `'tus-' + uppyFile.id + '-' + endpoint`. The `uppyFile.id` includes file name, type, size, and `relativePath` (for folder uploads).

2. **URL storage:** When `storeFingerprintForResuming` is `true` (default), tus-js-client stores the upload URL in `localStorage` keyed by the fingerprint.

3. **Resume check:** On next upload of the same file, `findPreviousUploads()` looks up the fingerprint in localStorage, finds the stored URL, and sends a HEAD request to get the server's `Upload-Offset`.

4. **Continuation:** If the server responds with a valid offset, the upload resumes from that byte. If the server returns 404 (expired/deleted), a new upload is created.

5. **Cleanup:** When `removeFingerprintOnSuccess` is `true`, the localStorage entry is deleted after successful upload. Otherwise it persists (harmless but accumulates).

## Metadata Handling

Uppy maps file metadata to tus `Upload-Metadata` header fields:
- `file.meta.name` becomes `filename`
- `file.meta.type` becomes `filetype`
- Custom meta fields are passed through as-is

Filter with `allowedMetaFields: ["purpose", "resourceId"]` to send only specific fields.

## Key Gotchas

### CORS with tusd

tusd must expose these headers for tus-js-client to work:
```
Access-Control-Expose-Headers: Upload-Offset, Upload-Length, Location, Tus-Resumable, Upload-Metadata
Access-Control-Allow-Methods: POST, PATCH, HEAD, DELETE, OPTIONS
```

### Fingerprint collisions

Two different files with the same name, type, size, and relativePath will produce the same fingerprint. This is unlikely in practice but can cause one upload to "resume" from another file's offset, resulting in corruption. Mitigate by including a unique ID (like `contentId`) in the Uppy file's `id` or meta.

### Stale fingerprints in localStorage

If the tusd server purges incomplete uploads (common with `-behind-proxy` or TTL configs), localStorage still holds the old URL. The HEAD request returns 404, and tus-js-client falls back to creating a new upload. No user action needed, but localStorage accumulates stale entries. Use `removeFingerprintOnSuccess: true` to limit this, and periodically prune entries prefixed with `tus::` if localStorage quota is a concern.

### chunkSize: don't set it unless you must

From the tus-js-client docs: "Do not set this value, unless you are being forced to." Setting a chunkSize creates multiple PATCH requests per file, adding overhead. Only set it if: (a) the server or reverse proxy enforces a request body size limit, or (b) you need progress callbacks at sub-file granularity.

### limit vs parallelUploads

`limit` (Uppy option, default 20) controls how many files upload concurrently. `parallelUploads` (tus-js-client option, default 1) controls how many chunks of a single file upload in parallel. These are independent. For most cases, only adjust `limit`.

## Anti-Patterns

- **Calling `uppy.upload()` manually with `autoProceed: true`** -- double-fires uploads. Use one or the other.
- **Setting `storeFingerprintForResuming: false`** and expecting cross-session resume -- resume only works within the same Uppy instance (same page load). For cross-session, this must be `true`.
- **Using `headers` for auth tokens that expire** -- the `headers` object is set once at plugin init. Use `onBeforeRequest` to fetch a fresh token per request.
- **Passing all metadata to tusd** -- with `allowedMetaFields: true` (default), every meta field is sent as tus metadata. This can leak internal state. Whitelist explicitly.
- **Not handling `upload-error` events** -- tus retries transparently, but after exhausting `retryDelays`, the error surfaces. Always wire up error handling.
