# tusd v2 Reference Examples

## Docker Compose Service (Garage S3 Backend)

```yaml
services:
  tusd:
    image: tusproject/tusd:latest
    ports:
      - "8070:8080"
    environment:
      AWS_ACCESS_KEY_ID: ${GARAGE_ACCESS_KEY_ID}
      AWS_SECRET_ACCESS_KEY: ${GARAGE_SECRET_ACCESS_KEY}
      AWS_REGION: garage
    command:
      - -s3-bucket=snc-uploads
      - -s3-endpoint=http://garage:3900
      - -s3-object-prefix=uploads/
      - -behind-proxy
      - -hooks-http=http://api:3000/hooks/tusd
      - -hooks-http-forward-headers=Authorization,Cookie
      - -hooks-http-retry=3
      - -hooks-http-backoff=2
      - -hooks-enabled-events=pre-create,post-finish,post-terminate
      - -cors-allow-origin=https?://localhost(:\d+)?
      - -max-size=5368709120
    depends_on:
      - garage
      - api
    # Scratch space for temporary part buffering during S3 uploads.
    # Needs at least one -s3-part-size worth of space (default 50 MiB).
    tmpfs:
      - /tmp:size=256M
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "wget", "--spider", "-q", "http://localhost:8080/files/"]
      interval: 10s
      timeout: 5s
      retries: 3
```

### Notes on This Configuration

- `command` entries are tusd CLI flags passed as Docker CMD arguments.
- `-s3-endpoint=http://garage:3900` uses the Docker network hostname for Garage.
- `-behind-proxy` is set because tusd will be behind Caddy/Nginx in production.
- `-hooks-enabled-events` only enables the three hooks we actually handle, avoiding unnecessary HTTP calls for `post-create` and `post-receive`.
- `-max-size=5368709120` sets a 5 GiB upload limit.
- `tmpfs` provides fast scratch space for the temporary disk buffer tusd uses during S3 uploads.

## HTTP Hook TypeScript Types

These types match the JSON schema tusd sends to the `-hooks-http` endpoint and the response it expects back.

```typescript
// ---------- Hook Request (tusd -> Hono API) ----------

/** Top-level hook request body sent by tusd. */
export interface TusdHookRequest {
  Type: TusdHookType
  Event: TusdHookEvent
}

export type TusdHookType =
  | "pre-create"
  | "post-create"
  | "post-receive"
  | "pre-finish"
  | "post-finish"
  | "pre-terminate"
  | "post-terminate"

export interface TusdHookEvent {
  Upload: TusdUpload
  HTTPRequest: TusdHTTPRequest
}

export interface TusdUpload {
  /** Unique upload identifier (URI-safe string). */
  ID: string
  /** Total upload size in bytes. 0 if deferred. */
  Size: number
  /** True if size was not known at creation time. */
  SizeIsDeferred: boolean
  /** Number of bytes received so far. */
  Offset: number
  /**
   * Client-defined metadata from Upload-Metadata header.
   * Common keys: filename, filetype.
   * Values are always strings.
   */
  MetaData: Record<string, string>
  /** True if this is a partial upload (concatenation extension). */
  IsPartial: boolean
  /** True if this is a final concatenated upload. */
  IsFinal: boolean
  /** Upload IDs of partial uploads (if IsFinal is true). */
  PartialUploads: string[] | null
  /** Backend-specific storage details. */
  Storage: TusdStorageS3 | TusdStorageFile
}

/** Storage info when using S3 backend. */
export interface TusdStorageS3 {
  Type: "s3store"
  Bucket: string
  Key: string
}

/** Storage info when using local filestore backend. */
export interface TusdStorageFile {
  Type: "filestore"
  Path: string
  InfoPath: string
}

export interface TusdHTTPRequest {
  Method: string
  URI: string
  RemoteAddr: string
  /**
   * HTTP headers from the client request.
   * Values are string arrays (headers can repeat).
   * Only includes headers listed in -hooks-http-forward-headers
   * plus standard tus headers.
   */
  Header: Record<string, string[]>
}

// ---------- Hook Response (Hono API -> tusd) ----------

/**
 * Response body returned to tusd from the hook endpoint.
 * All fields are optional. Only include what you need.
 */
export interface TusdHookResponse {
  /** Override the HTTP response sent to the tus client. */
  HTTPResponse?: TusdHTTPResponse
  /** Reject the upload (pre-create only). */
  RejectUpload?: boolean
  /** Reject the termination (pre-terminate only). */
  RejectTermination?: boolean
  /** Modify upload info before creation (pre-create only). */
  ChangeFileInfo?: TusdChangeFileInfo
  /** Abort an in-progress upload (post-receive only). */
  StopUpload?: boolean
}

export interface TusdHTTPResponse {
  StatusCode: number
  Body: string
  Header: Record<string, string>
}

export interface TusdChangeFileInfo {
  /** Custom upload ID (must be URI-safe per RFC 3986). */
  ID?: string
  /** Override or add metadata. */
  MetaData?: Record<string, string>
  /** Override storage path. */
  Storage?: { Path?: string }
}
```

## Hono Hook Handler Example

```typescript
import { Hono } from "hono"
import type { TusdHookRequest, TusdHookResponse } from "./types/tusd.js"

const hooks = new Hono()

hooks.post("/hooks/tusd", async (c) => {
  const body = await c.req.json<TusdHookRequest>()
  const logger = c.var.logger

  switch (body.Type) {
    case "pre-create":
      return c.json(await handlePreCreate(body, c))

    case "post-finish":
      await handlePostFinish(body, c)
      return c.json({})

    case "post-terminate":
      await handlePostTerminate(body, c)
      return c.json({})

    default:
      logger.warn({ hookType: body.Type }, "unhandled tusd hook type")
      return c.json({})
  }
})

async function handlePreCreate(
  body: TusdHookRequest,
  c: Context,
): Promise<TusdHookResponse> {
  // Extract auth token forwarded by tusd (-hooks-http-forward-headers)
  const authHeader = body.Event.HTTPRequest.Header["Authorization"]?.[0]
  if (!authHeader) {
    return {
      RejectUpload: true,
      HTTPResponse: {
        StatusCode: 401,
        Body: JSON.stringify({ error: "missing authorization" }),
        Header: { "Content-Type": "application/json" },
      },
    }
  }

  // Validate token, check permissions, enforce quotas...
  // Return empty object to allow the upload.
  return {}
}

async function handlePostFinish(
  body: TusdHookRequest,
  c: Context,
): Promise<void> {
  const { Upload } = body.Event

  // The file is now in S3. Enqueue a processing job.
  const boss = c.var.boss
  await boss.send("media/probe-codec", {
    uploadId: Upload.ID,
    bucket: (Upload.Storage as TusdStorageS3).Bucket,
    key: (Upload.Storage as TusdStorageS3).Key,
    filename: Upload.MetaData.filename,
    filetype: Upload.MetaData.filetype,
    size: Upload.Size,
  })
}

async function handlePostTerminate(
  body: TusdHookRequest,
  c: Context,
): Promise<void> {
  // Client or tusd deleted the upload. Clean up any DB records.
  const { Upload } = body.Event
  await c.var.db
    .delete(uploads)
    .where(eq(uploads.tusId, Upload.ID))
}

export { hooks }
```

## Caddy Reverse Proxy Configuration

```caddyfile
# tusd behind Caddy with TLS termination.
# tusd handles its own CORS, so do NOT add header directives for CORS here.
#
# The handle_path strips /uploads before proxying, matching tusd's
# default -base-path of /files/. Alternatively, set tusd's -base-path
# to /uploads/ and use handle instead of handle_path.

app.example.com {
    # API routes
    handle /api/* {
        reverse_proxy api:3000
    }

    # tusd upload endpoint
    # Clients connect to https://app.example.com/uploads/
    handle /uploads/* {
        reverse_proxy tusd:8080 {
            # Forward original host for correct upload URLs
            header_up Host {host}
            header_up X-Forwarded-Host {host}
            header_up X-Forwarded-Proto {scheme}

            # tusd uploads can be large and long-running
            transport http {
                read_timeout 0
                write_timeout 0
            }
        }
    }

    # SPA / static assets
    handle {
        reverse_proxy web:3000
    }
}
```

### Caddy Notes

- `read_timeout 0` and `write_timeout 0` disable timeouts for the upload proxy. Large uploads over slow connections can take hours.
- tusd must be started with `-behind-proxy` to respect the `X-Forwarded-*` headers.
- Do NOT add CORS headers in Caddy if tusd's built-in CORS is enabled. Duplicate CORS headers cause browsers to reject the response.
- If tusd's `-base-path` differs from the external path, adjust accordingly. The simplest setup is matching them (e.g. both `/uploads/`).

## Nginx Reverse Proxy Configuration

```nginx
# tusd behind Nginx with TLS termination.
# Disable CORS in tusd (-disable-cors) if Nginx handles CORS.

location /uploads/ {
    proxy_pass http://tusd:8080/files/;

    proxy_set_header Host              $host;
    proxy_set_header X-Forwarded-Host  $host;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Real-IP         $remote_addr;

    # Required for large uploads
    proxy_request_buffering off;
    client_max_body_size 0;

    # Disable timeouts for long-running uploads
    proxy_read_timeout 0;
    proxy_send_timeout 0;
}
```

### Nginx Notes

- `proxy_request_buffering off` is critical. Without it, Nginx buffers the entire upload body before forwarding, defeating the purpose of chunked/resumable uploads.
- `client_max_body_size 0` disables Nginx's body size limit. Use tusd's `-max-size` flag instead.

## Uppy Client Configuration (tus mode)

```typescript
import Uppy from "@uppy/core"
import Dashboard from "@uppy/dashboard"
import Tus from "@uppy/tus"

const uppy = new Uppy({
  restrictions: {
    maxFileSize: 5 * 1024 * 1024 * 1024, // 5 GiB — match tusd's -max-size
  },
})
  .use(Dashboard, {
    inline: true,
    target: "#upload-area",
  })
  .use(Tus, {
    endpoint: "/uploads/", // Proxied to tusd
    chunkSize: 50 * 1024 * 1024, // 50 MiB — match tusd's -s3-part-size
    retryDelays: [0, 1000, 3000, 5000],
    // Pass auth token so tusd can forward it to the hook endpoint
    headers: () => ({
      Authorization: `Bearer ${getAccessToken()}`,
    }),
    // Store upload URLs in localStorage for cross-session resumability
    storeFingerprintForResuming: true,
    removeFingerprintOnSuccess: true,
  })

uppy.on("complete", (result) => {
  console.log("Upload complete:", result.successful)
})
```

### Uppy Notes

- `chunkSize` should match tusd's `-s3-part-size` for optimal throughput. If chunks are smaller than the S3 part size, tusd buffers them to disk until it has enough for one S3 part.
- `storeFingerprintForResuming: true` enables cross-session resumability -- the core reason for using tus.
- The `headers` function is called per-request, allowing token refresh between chunks.
- `removeFingerprintOnSuccess: true` cleans up localStorage after successful uploads.
