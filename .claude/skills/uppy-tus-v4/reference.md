# @uppy/tus v4 Full Reference

## Table of Contents

- [Full Options Reference](#full-options-reference)
- [TypeScript Types](#typescript-types)
- [Code Examples](#code-examples)
- [Events and Progress Tracking](#events-and-progress-tracking)
- [Cross-Session Resume Deep Dive](#cross-session-resume-deep-dive)
- [Migration from @uppy/aws-s3 to @uppy/tus](#migration-from-uppyaws-s3-to-uppytus)

---

## Full Options Reference

### Uppy-level options

#### `endpoint` (string, default: `""`)

URL of the tus server's upload creation endpoint. Required.

```typescript
.use(Tus, { endpoint: "https://tusd.example.com/files/" })
```

#### `headers` (Record<string, string> | (file: UppyFile) => Record<string, string>, default: `{}`)

Static headers applied to all tus requests (POST creation, PATCH upload, HEAD resume). Can be an object or a function that receives the Uppy file and returns headers.

```typescript
// Static
.use(Tus, { endpoint, headers: { "X-API-Key": "abc123" } })

// Per-file (synchronous only in the headers option)
.use(Tus, {
  endpoint,
  headers: (file) => ({
    "X-Upload-Purpose": file.meta.purpose as string,
  }),
})
```

For async header generation (e.g., fetching a fresh JWT), use `onBeforeRequest` instead.

#### `chunkSize` (number, default: `Infinity`)

Maximum size of each PATCH request body in bytes. `Infinity` means the entire file is sent in a single PATCH. Only set this if your server or reverse proxy enforces a request body size limit.

```typescript
// 10 MB chunks (only if needed)
.use(Tus, { endpoint, chunkSize: 10 * 1024 * 1024 })
```

#### `retryDelays` (number[], default: `[100, 1000, 3000, 5000]`)

Array of millisecond delays between retry attempts after a failed request. After exhausting all delays, the upload fails with an error event. The array length determines the maximum number of retries.

```typescript
// More aggressive retry: 6 attempts with longer waits
.use(Tus, { endpoint, retryDelays: [0, 1000, 3000, 5000, 10000, 30000] })

// Disable retries
.use(Tus, { endpoint, retryDelays: [] })
```

tus-js-client has built-in exponential backoff on HTTP 429 (Too Many Requests).

#### `limit` (number, default: `20`)

Maximum number of simultaneous file uploads. Set to `0` for no limit (not recommended). This controls concurrency across files, not chunks within a file.

#### `withCredentials` (boolean, default: `false`)

Set `xhr.withCredentials = true` on the underlying XMLHttpRequest. Required when the tus server is on a different origin and you need to send cookies.

#### `allowedMetaFields` (boolean | string[], default: `true`)

Controls which Uppy file metadata fields are sent as tus `Upload-Metadata`:
- `true` -- send all metadata (default)
- `false` -- send no metadata
- `string[]` -- send only named fields

```typescript
// Only send purpose and resourceId as tus metadata
.use(Tus, {
  endpoint,
  allowedMetaFields: ["purpose", "resourceId"],
})
```

Note: `name` is mapped to `filename` and `type` to `filetype` in the tus metadata automatically by Uppy.

#### `onBeforeRequest` ((req: HttpRequest, file: UppyFile) => void | Promise<void>)

Hook called before every HTTP request (POST, PATCH, HEAD, DELETE). Use this for dynamic auth headers.

```typescript
.use(Tus, {
  endpoint,
  async onBeforeRequest(req, file) {
    const token = await getAuthToken();
    req.setHeader("Authorization", `Bearer ${token}`);
  },
})
```

The `req` object exposes:
- `req.setHeader(name, value)` -- set a request header
- `req.getHeader(name)` -- get a request header
- `req.getUnderlyingObject()` -- access the raw XMLHttpRequest
- `req.getMethod()` -- get HTTP method
- `req.getURL()` -- get request URL

#### `onShouldRetry` ((err: DetailedError, retryAttempt: number, options: TusOpts, next: (err) => boolean) => boolean)

Custom retry logic. Called when a request fails before applying the retry delay. Return `true` to retry, `false` to fail immediately. The `next` function contains the default retry logic.

```typescript
.use(Tus, {
  endpoint,
  onShouldRetry(err, retryAttempt, options, next) {
    const status = err?.originalResponse?.getStatus();

    // Don't retry auth failures -- refresh token and retry
    if (status === 401) {
      return true; // will call onBeforeRequest again with fresh token
    }

    // Don't retry client errors (except 429)
    if (status && status >= 400 && status < 500 && status !== 429) {
      return false;
    }

    // Default behavior for everything else
    return next(err);
  },
})
```

#### `onAfterResponse` ((req: HttpRequest, res: HttpResponse) => void | Promise<void>)

Hook called after every HTTP response. Useful for extracting custom headers from the tus server.

```typescript
.use(Tus, {
  endpoint,
  onAfterResponse(req, res) {
    const uploadId = res.getHeader("X-Upload-Id");
    if (uploadId) {
      console.log("Server assigned upload ID:", uploadId);
    }
  },
})
```

### tus-js-client passthrough options

These are accepted by @uppy/tus and passed directly to tus-js-client. They are not documented on the Uppy website but are part of the tus-js-client API.

#### `storeFingerprintForResuming` (boolean, default: `true`)

When `true`, the upload URL is stored in `urlStorage` (default: localStorage) keyed by the file fingerprint. This is what enables cross-session resume. Setting to `false` means uploads can only resume within the same Uppy instance lifecycle (same page load).

#### `removeFingerprintOnSuccess` (boolean, default: `false`)

When `true`, the fingerprint-to-URL mapping is deleted from localStorage after a successful upload. Prevents stale entries from accumulating. The tradeoff: if the user re-uploads the same file, no resume is possible (a new upload is always created).

#### `uploadDataDuringCreation` (boolean, default: `false`)

Uses the tus "creation-with-upload" extension to include file data in the initial POST request. Reduces round trips from 2 to 1 for small files. Requires server support (tusd supports this).

#### `overridePatchMethod` (boolean, default: `false`)

Send `POST` with `X-HTTP-Method-Override: PATCH` instead of `PATCH`. Required by some proxies/load balancers that block PATCH requests.

#### `urlStorage` (object, default: `localStorage`)

Custom storage backend for fingerprint-to-URL mappings. Must implement:
```typescript
interface UrlStorage {
  findAllUploads(): Promise<PreviousUpload[]>;
  findUploadsByFingerprint(fingerprint: string): Promise<PreviousUpload[]>;
  removeUpload(urlStorageKey: string): Promise<void>;
  addUpload(fingerprint: string, upload: PreviousUpload): Promise<string>;
}
```

#### `parallelUploads` (number, default: `1`)

Number of concurrent PATCH requests for a single file. Requires server support for the tus "concatenation" extension. Independent of Uppy's `limit` option.

---

## TypeScript Types

```typescript
import Uppy from "@uppy/core";
import Tus, { type TusBody } from "@uppy/tus";
import type { Meta, UppyFile } from "@uppy/core";

// Custom metadata interface
interface UploadMeta extends Meta {
  purpose: string;
  resourceId: string;
  contentId?: string;
}

// Typed Uppy instance
const uppy = new Uppy<UploadMeta, TusBody>();

// TusBody provides typed access to response.body in upload-success
uppy.on("upload-success", (file, response) => {
  // response.body is typed as TusBody
  const uploadURL = response.uploadURL; // string - the tus upload URL
});
```

---

## Code Examples

### Basic Uppy + Tus setup in React

```typescript
import { useRef, useEffect } from "react";
import Uppy from "@uppy/core";
import Tus from "@uppy/tus";

function useUppy() {
  const uppyRef = useRef<Uppy | null>(null);

  if (!uppyRef.current) {
    uppyRef.current = new Uppy({ autoProceed: true }).use(Tus, {
      endpoint: "/api/uploads/",
      retryDelays: [0, 1000, 3000, 5000],
      removeFingerprintOnSuccess: true,
      allowedMetaFields: ["purpose", "resourceId", "contentId"],
    });
  }

  useEffect(() => {
    return () => {
      uppyRef.current?.destroy();
      uppyRef.current = null;
    };
  }, []);

  return uppyRef.current;
}
```

### Adding auth headers via onBeforeRequest

```typescript
import Uppy from "@uppy/core";
import Tus from "@uppy/tus";

// Token fetcher -- replace with your auth mechanism
async function getAuthToken(): Promise<string> {
  const resp = await fetch("/api/auth/token");
  const data = await resp.json();
  return data.token;
}

const uppy = new Uppy({ autoProceed: true }).use(Tus, {
  endpoint: "/api/uploads/",
  async onBeforeRequest(req) {
    const token = await getAuthToken();
    req.setHeader("Authorization", `Bearer ${token}`);
  },
  onShouldRetry(err, retryAttempt, options, next) {
    const status = err?.originalResponse?.getStatus();
    // Retry on 401 -- onBeforeRequest will fetch a fresh token
    if (status === 401) return true;
    return next(err);
  },
});
```

### Passing custom metadata (contentId, creatorId, purpose)

```typescript
import Uppy from "@uppy/core";
import Tus from "@uppy/tus";

const uppy = new Uppy({ autoProceed: true }).use(Tus, {
  endpoint: "/api/uploads/",
  // Only send these fields as tus Upload-Metadata
  allowedMetaFields: ["purpose", "resourceId", "contentId", "creatorId"],
});

// When adding a file, attach metadata
function startUpload(file: File, meta: {
  purpose: string;
  resourceId: string;
  contentId: string;
  creatorId: string;
}) {
  uppy.addFile({
    name: file.name,
    type: file.type,
    data: file,
    meta: {
      purpose: meta.purpose,
      resourceId: meta.resourceId,
      contentId: meta.contentId,
      creatorId: meta.creatorId,
    },
  });
}
```

The tusd server receives these as the `Upload-Metadata` header:
```
Upload-Metadata: filename <base64>,filetype <base64>,purpose <base64>,resourceId <base64>,contentId <base64>,creatorId <base64>
```

### Handling upload completion events

```typescript
import Uppy from "@uppy/core";
import type { Body, Meta, UppyFile } from "@uppy/core";
import Tus from "@uppy/tus";

const uppy = new Uppy({ autoProceed: true }).use(Tus, {
  endpoint: "/api/uploads/",
});

// Per-file progress
uppy.on("upload-progress", (file, progress) => {
  if (!file || !progress.bytesTotal) return;
  const pct = Math.round((progress.bytesUploaded / progress.bytesTotal) * 100);
  console.log(`${file.name}: ${pct}%`);
});

// Single file complete
uppy.on("upload-success", (file, response) => {
  console.log(`${file?.name} uploaded to ${response.uploadURL}`);
  // response.uploadURL is the tus URL (e.g., /api/uploads/abc123)
  // Extract the upload ID from the URL if needed
});

// Single file error (after all retries exhausted)
uppy.on("upload-error", (file, error) => {
  console.error(`${file?.name} failed:`, error.message);
});

// All files in the batch complete
uppy.on("complete", (result) => {
  console.log("Successful:", result.successful?.length);
  console.log("Failed:", result.failed?.length);
});
```

### Cross-session resume behavior

No special code is needed. Resume is automatic when:
1. `storeFingerprintForResuming` is `true` (default)
2. The user adds a file with the same name, type, size, and relativePath
3. The tusd server still has the incomplete upload

```typescript
// This setup automatically resumes across page reloads
const uppy = new Uppy({ autoProceed: true }).use(Tus, {
  endpoint: "/api/uploads/",
  // These are the defaults, shown for clarity:
  // storeFingerprintForResuming: true,
  // removeFingerprintOnSuccess: false,
});

// What happens internally when a file is added:
// 1. Uppy generates fingerprint: "tus-{fileId}-{endpoint}"
// 2. tus-js-client calls findPreviousUploads() on urlStorage (localStorage)
// 3. If a matching URL is found:
//    a. HEAD request to that URL
//    b. Server responds with Upload-Offset header
//    c. PATCH request starts from that offset
// 4. If no match or HEAD returns 404:
//    a. POST to create a new upload
//    b. Store the returned URL in localStorage
//    c. PATCH request starts from offset 0
```

### S/NC platform context: UploadProvider with Tus

This example shows what the migration from `@uppy/aws-s3` to `@uppy/tus` looks like in the context of the platform's existing `upload-context.tsx` pattern.

```typescript
import Uppy from "@uppy/core";
import type { Body, Meta, UppyFile } from "@uppy/core";
import Tus from "@uppy/tus";
import type { UploadPurpose } from "@snc/shared";

// Replace AwsS3 plugin with Tus
if (!uppyRef.current) {
  uppyRef.current = new Uppy({ autoProceed: true }).use(Tus, {
    endpoint: "/api/uploads/",
    retryDelays: [100, 1000, 3000, 5000],
    removeFingerprintOnSuccess: true,
    allowedMetaFields: ["purpose", "resourceId"],

    async onBeforeRequest(req) {
      // If your API uses cookie auth, this isn't needed.
      // If using bearer tokens:
      const token = await getAuthToken();
      req.setHeader("Authorization", `Bearer ${token}`);
    },
  });
}

// Event wiring is nearly identical to the AwsS3 version.
// Key difference: response.uploadURL is a tus URL, not an S3 key.
uppy.on("upload-success", (file, response) => {
  // response.uploadURL = "https://tusd.example.com/files/abc123"
  // Extract the upload ID or notify your API of completion
  const tusUrl = response.uploadURL;
  const uploadId = tusUrl?.split("/").pop();

  // Call your completion endpoint
  completeUpload({
    uploadId: uploadId ?? "",
    purpose: file?.meta.purpose as UploadPurpose,
    resourceId: file?.meta.resourceId as string,
  });
});
```

---

## Events and Progress Tracking

### Uppy-level events (same regardless of uploader plugin)

| Event | Signature | When |
|-------|-----------|------|
| `upload-progress` | `(file, { bytesUploaded, bytesTotal })` | During PATCH transfer |
| `upload-success` | `(file, response)` | Single file complete |
| `upload-error` | `(file, error)` | Single file failed (after retries) |
| `complete` | `(result)` | All files in batch done |
| `file-added` | `(file)` | File added to Uppy |
| `file-removed` | `(file, reason)` | File removed |
| `upload` | `(data)` | Upload batch started |

### tus-js-client callbacks (set via Uppy options)

These are set per-file internally by the Tus plugin. You generally don't set them directly; use Uppy events instead. The exception is `onBeforeRequest`, `onAfterResponse`, and `onShouldRetry` which are meant for user configuration.

---

## Cross-Session Resume Deep Dive

### Fingerprint composition

Uppy overrides tus-js-client's default fingerprint function:

```typescript
// From @uppy/tus/src/getFingerprint.ts
function getFingerprint(uppyFile) {
  return (file, options) => {
    const uppyFingerprint = ["tus", uppyFile.id, options.endpoint].join("-");
    return Promise.resolve(uppyFingerprint);
  };
}
```

Where `uppyFile.id` is computed by Uppy core as: `uppy-{name}-{type}-{size}-{relativePath}` (simplified). This means the fingerprint is stable across page reloads for the same file.

### localStorage structure

tus-js-client stores entries under keys like:
```
tus::https://tusd.example.com/files/::tus-uppy-video.mp4-video/mp4-1073741824--https://tusd.example.com/files/
```

The value is a JSON object containing:
```json
{
  "size": 1073741824,
  "metadata": {},
  "creationTime": "2026-04-06T12:00:00.000Z",
  "uploadUrl": "https://tusd.example.com/files/abc123def456"
}
```

### Resume flow

```
User drops file
  |
  v
Uppy generates fingerprint
  |
  v
tus-js-client.findPreviousUploads(fingerprint)
  |
  +-- Found in localStorage?
  |     |
  |     +-- YES: HEAD request to stored uploadUrl
  |     |     |
  |     |     +-- 200 + Upload-Offset: resume from offset
  |     |     +-- 404/410: create new upload (POST)
  |     |
  |     +-- NO: create new upload (POST)
  |
  v
PATCH request(s) from offset to end
  |
  v
Upload complete -> Uppy "upload-success" event
```

---

## Migration from @uppy/aws-s3 to @uppy/tus

### What changes

| Aspect | @uppy/aws-s3 | @uppy/tus |
|--------|-------------|-----------|
| Package | `@uppy/aws-s3` | `@uppy/tus` |
| Server | Your API generates presigned URLs | tusd server handles uploads |
| Resume | No cross-session resume | Cross-session via localStorage fingerprints |
| Protocol | HTTP PUT / S3 multipart | tus protocol (POST + PATCH) |
| Response | S3 key in response body | tus upload URL in `response.uploadURL` |
| CORS | S3 bucket CORS policy | tusd CORS headers |
| Completion | Call `completeUpload({ key })` | Call `completeUpload({ uploadId })` |

### What stays the same

- Uppy core instance creation
- `autoProceed` behavior
- Event names (`upload-progress`, `upload-success`, `upload-error`, `complete`)
- File metadata attachment via `uppy.addFile({ meta })` or `uppy.setFileMeta()`
- React context/reducer structure (state shape, dispatch actions)
- `beforeunload` guard
- `uppy.destroy()` cleanup

### Step-by-step migration

1. **Replace the import:**
   ```diff
   - import AwsS3 from "@uppy/aws-s3";
   + import Tus from "@uppy/tus";
   ```

2. **Replace plugin registration:**
   ```diff
   - .use(AwsS3, {
   -   shouldUseMultipart: (file) => (file.size ?? 0) > MULTIPART_THRESHOLD,
   -   getChunkSize: () => MULTIPART_CHUNK_SIZE,
   -   async getUploadParameters(file) { ... },
   -   async createMultipartUpload(file) { ... },
   -   async signPart(file, opts) { ... },
   -   async completeMultipartUpload(file, opts) { ... },
   -   async abortMultipartUpload(file, opts) { ... },
   -   async listParts(file, opts) { ... },
   - })
   + .use(Tus, {
   +   endpoint: "/api/uploads/",
   +   retryDelays: [100, 1000, 3000, 5000],
   +   removeFingerprintOnSuccess: true,
   +   allowedMetaFields: ["purpose", "resourceId"],
   + })
   ```

3. **Update the success handler:**
   ```diff
   - const key = (response.body as Record<string, unknown>)?.key as string
   -   ?? file?.meta?.key as string ?? "";
   + const uploadURL = response.uploadURL ?? "";
   + const uploadId = uploadURL.split("/").pop() ?? "";
   ```

4. **Update the completion call:**
   ```diff
   - retryWithBackoff(() => completeUpload({ key, purpose, resourceId }), 3)
   + retryWithBackoff(() => completeUpload({ uploadId, purpose, resourceId }), 3)
   ```

5. **Remove S3-specific imports and helpers:**
   ```diff
   - import {
   -   presignUpload,
   -   createMultipartUpload,
   -   signPart,
   -   completeMultipartUpload,
   -   abortMultipartUpload,
   -   listParts,
   -   completeUpload,
   -   retryWithBackoff,
   - } from "../lib/uploads.js";
   + import { completeUpload, retryWithBackoff } from "../lib/uploads.js";
   ```

6. **Remove S3 availability probe:**
   The `probeS3Availability` helper and its ref are no longer needed. tusd is always the upload target.

7. **Remove legacy fallback (optional):**
   If tusd replaces all upload paths, the `uploadLegacy` function and its form-data uploads can be removed.

### Server-side changes (not covered by this skill)

- Deploy tusd (or embed tus protocol in your API)
- Configure tusd to store files in S3/Garage (tusd supports S3 backends natively)
- Add a completion webhook or polling endpoint so your API knows when uploads finish
- Configure CORS on tusd to accept requests from your web origin
