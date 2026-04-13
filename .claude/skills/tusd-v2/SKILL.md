---
name: tusd-v2
description: >
  tusd v2 tus protocol server reference. Auto-loads when working with
  tusd, tus protocol, resumable uploads, tus hooks, pre-create, post-finish,
  tus S3 backend, upload server, TUSD_.
user-invocable: false
---

# tusd v2 Reference

> **Version:** 2.x (latest 2.9.2)
> **Docs:** https://tus.github.io/tusd/
> **Image:** `tusproject/tusd:latest`

See [reference.md](reference.md) for Docker Compose examples, HTTP hook TypeScript types, and reverse proxy configuration.

tusd is the official reference server for the [tus resumable upload protocol](https://tus.io/), written in Go. It accepts chunked uploads from tus clients, reassembles them, and stores the result in a configured backend (local disk, S3, GCS, Azure). For the S/NC platform, tusd sits between Uppy (tus client) and Garage S3, with HTTP hooks calling back to the Hono API.

## S3 Backend Configuration

### Required Environment Variables

```
AWS_ACCESS_KEY_ID=<garage-access-key>
AWS_SECRET_ACCESS_KEY=<garage-secret-key>
AWS_REGION=garage            # Garage ignores region but SDK requires it
```

### CLI Flags

| Flag | Default | Description |
|------|---------|-------------|
| `-s3-bucket` | _(required)_ | Bucket name |
| `-s3-endpoint` | _(AWS default)_ | Custom endpoint URL (must start with `http://` or `https://`) |
| `-s3-object-prefix` | `""` | Prefix for all objects (e.g. `uploads/`) |
| `-s3-part-size` | 50 MiB | Multipart upload part size |
| `-s3-min-part-size` | _(varies)_ | Minimum multipart part size |
| `-s3-transfer-acceleration` | `false` | Enable S3 Transfer Acceleration |
| `-s3-log-api-calls` | `false` | Log all S3 API calls (may contain sensitive info) |

### S3 Object Layout

For an upload with ID `abc123`:

| Object | Purpose |
|--------|---------|
| `{prefix}abc123.info` | JSON metadata (size, offset, client metadata) |
| `{prefix}abc123` | Final assembled file (created on upload completion) |
| `{prefix}abc123.part` | Temporary partial data for paused uploads |

The `.info` object preserves original metadata without character replacement. Non-ASCII characters in S3 object metadata headers are replaced with `?`, but the `.info` object retains the originals.

If the client sets a `filetype` metadata key, its value becomes the `Content-Type` of the final S3 object.

### Required IAM / Garage Permissions

```
s3:AbortMultipartUpload
s3:DeleteObject
s3:GetObject
s3:ListMultipartUploadParts
s3:PutObject
```

### Garage S3 Compatibility Notes

- Garage requires path-style access. tusd uses path-style by default when `-s3-endpoint` is set, so no extra flag is needed.
- Set `AWS_REGION` to any non-empty value (e.g. `garage`) -- Garage ignores it but the AWS SDK requires it.
- During PATCH requests, tusd temporarily buffers data to local disk before transferring to S3. Ensure the container has sufficient scratch space (at least one part size worth).
- Garage does not support S3 Transfer Acceleration -- do not use `-s3-transfer-acceleration`.

## Hook System

### Hook Types

| Hook | Blocking | Default Enabled | When |
|------|----------|-----------------|------|
| `pre-create` | Yes | Yes | Before upload resource is created |
| `post-create` | No | Yes | After upload resource is created |
| `post-receive` | No | Yes | Periodically during data transfer |
| `pre-finish` | Yes | No | After all data received, before response to client |
| `post-finish` | No | Yes | After upload is complete and client notified |
| `pre-terminate` | Yes | No | Before upload deletion |
| `post-terminate` | No | Yes | After upload deletion |

**Ordering guarantee:** `pre-create` is always first. `post-finish` starts after `pre-finish` completes. No other ordering is guaranteed between non-blocking hooks.

**Retry behavior:** Hooks are NOT retried by tusd. If your post-processing fails, tusd will not retry it. Design your hook handler to be idempotent and handle its own retries.

### HTTP Hook Delivery

```
tusd -hooks-http http://api:3000/hooks/tusd \
     -hooks-http-forward-headers Authorization,Cookie \
     -hooks-http-retry 3 \
     -hooks-http-backoff 2 \
     -hooks-http-timeout 15
```

| Flag | Default | Description |
|------|---------|-------------|
| `-hooks-http` | _(none)_ | HTTP(S) endpoint URL |
| `-hooks-http-forward-headers` | _(none)_ | Comma-separated headers to forward from client |
| `-hooks-http-retry` | 3 | Retry count on failure |
| `-hooks-http-backoff` | 1 | Backoff between retries (seconds) |
| `-hooks-http-timeout` | 15 | Request timeout (seconds) |
| `-hooks-http-size-limit` | 5 KiB | Maximum response body size |
| `-hooks-enabled-events` | `pre-create,post-create,post-receive,post-finish,post-terminate` | Comma-separated list of enabled hooks |

**Important:** tusd requires `Content-Type: application/json` in all hook responses.

### Hook Request Body (tusd -> your API)

```json
{
  "Type": "post-finish",
  "Event": {
    "Upload": {
      "ID": "5d892c228ec8d0451dfec588697e8930",
      "Size": 432724,
      "SizeIsDeferred": false,
      "Offset": 432724,
      "MetaData": {
        "filename": "photo.png",
        "filetype": "image/png"
      },
      "IsPartial": false,
      "IsFinal": false,
      "PartialUploads": null,
      "Storage": {
        "Type": "s3store",
        "Bucket": "snc-uploads",
        "Key": "uploads/5d892c228ec8d0451dfec588697e8930"
      }
    },
    "HTTPRequest": {
      "Method": "PATCH",
      "URI": "/files/5d892c228ec8d0451dfec588697e8930",
      "RemoteAddr": "172.18.0.1:59395",
      "Header": {
        "Authorization": ["Bearer eyJ..."],
        "Tus-Resumable": ["1.0.0"]
      }
    }
  }
}
```

Header values are arrays (headers can repeat, e.g. cookies). `Storage` contains `Bucket` and `Key` when using S3 (instead of `Path`/`InfoPath` for filestore).

### Hook Response Body (your API -> tusd)

All fields are optional. Only include what you need.

**Rejecting an upload (pre-create):**
```json
{
  "RejectUpload": true,
  "HTTPResponse": {
    "StatusCode": 403,
    "Body": "{\"error\":\"unauthorized\"}",
    "Header": { "Content-Type": "application/json" }
  }
}
```

**Field applicability:**

| Field | Applicable hooks |
|-------|-----------------|
| `HTTPResponse` | pre-create, pre-finish, post-receive |
| `RejectUpload` | pre-create only |
| `RejectTermination` | pre-terminate only |
| `ChangeFileInfo` | pre-create only |
| `StopUpload` | post-receive only |

`ChangeFileInfo` can set a custom upload ID, modify metadata, or change the storage path. Custom IDs must be URI-safe per RFC 3986.

### Using pre-create for Auth Validation

The `pre-create` hook fires before any upload resource is created. Use `-hooks-http-forward-headers Authorization` to receive the client's auth token. Validate it in your API and return `RejectUpload: true` with an appropriate status code to deny.

### Using post-finish to Trigger Processing

The `post-finish` hook fires after the upload is complete. The `Storage.Bucket` and `Storage.Key` fields tell you exactly where the file landed in S3. Enqueue a pg-boss job from your hook handler to process the file asynchronously.

## Network & Protocol Configuration

| Flag | Default | Description |
|------|---------|-------------|
| `-host` | `0.0.0.0` | Listen address |
| `-port` | `8080` | Listen port |
| `-base-path` | `/files/` | Upload endpoint path prefix |
| `-behind-proxy` | `false` | Respect `X-Forwarded-*` / `Forwarded` headers |
| `-max-size` | `0` (unlimited) | Maximum upload size in bytes |
| `-disable-download` | `false` | Disable GET retrieval of uploads |
| `-disable-termination` | `false` | Disable tus termination extension |
| `-disable-cors` | `false` | Disable built-in CORS handling |
| `-enable-h2c` | `false` | Enable HTTP/2 cleartext |
| `-shutdown-timeout` | `10` | Graceful shutdown timeout (seconds) |
| `-unix-sock` | _(none)_ | Listen on UNIX socket instead of TCP |

### CORS Flags

| Flag | Description |
|------|-------------|
| `-cors-allow-origin` | Regex pattern for allowed origins |
| `-cors-allow-credentials` | Include credentials in CORS |
| `-cors-allow-headers` | Additional allowed headers |
| `-cors-expose-headers` | Additional exposed headers |
| `-cors-max-age` | Preflight cache duration (seconds) |

### TLS Flags

| Flag | Description |
|------|-------------|
| `-tls-certificate` | Path to TLS certificate file |
| `-tls-key` | Path to TLS private key file |
| `-tls-mode` | `tls12` (default), `tls12-strong`, `tls13` |

## Key Gotchas

### CORS Double-Header Problem

If both tusd and a reverse proxy (Caddy/Nginx) set CORS headers, browsers reject the response due to duplicate headers. Either use `-disable-cors` on tusd and handle CORS in the proxy, or let tusd handle CORS and don't add CORS headers in the proxy.

### `-behind-proxy` Is Required Behind a Reverse Proxy

Without this flag, tusd ignores `X-Forwarded-Host`, `X-Forwarded-Proto`, and `Forwarded` headers. Upload URLs returned to clients will contain the wrong host/scheme, breaking resumability.

### Temporary Disk During S3 Uploads

tusd buffers incoming PATCH data to local disk before transferring to S3. The buffer is cleaned up after each part upload. Ensure the container's temp directory has at least `-s3-part-size` bytes free.

### No Auth Between Resumption Requests

tusd does not enforce that the same user who created an upload is the one resuming it. The upload ID is the only "credential." If upload IDs are guessable or leaked, anyone can resume/complete the upload. Use `pre-create` hooks to embed auth context in metadata if needed.

### Hook Ordering Is Not Fully Guaranteed

Non-blocking hooks (`post-create`, `post-receive`, `post-finish`, `post-terminate`) execute concurrently. A `post-finish` callback may arrive at your API before `post-create` finishes processing. Design handlers to be idempotent and order-independent.

### NFS / Shared Filesystem Lock Errors

The local disk backend requires hard links for locking. NFS and some shared filesystems don't support this. Use the S3 backend to avoid the issue entirely.

## Anti-Patterns

1. **Don't rely on hook retries for critical processing** -- tusd does not retry hooks. Your hook handler should enqueue durable work (e.g. pg-boss job) rather than doing heavy processing synchronously.

2. **Don't set `-s3-transfer-acceleration` with Garage** -- Garage does not support Transfer Acceleration. The flag will cause errors.

3. **Don't expose tusd directly to the internet without `-behind-proxy`** -- always run behind a reverse proxy with TLS termination and set `-behind-proxy`.

4. **Don't handle CORS in both tusd and the reverse proxy** -- pick one. Duplicate headers cause browser rejections.

5. **Don't assume upload IDs are secret** -- they appear in URLs. Don't use them as authorization tokens.

6. **Don't do heavy processing in blocking hooks (pre-create, pre-finish)** -- tusd waits for the response. Keep them fast (auth checks, metadata validation). Offload work to post-finish or a job queue.

7. **Don't skip `-hooks-enabled-events`** -- enable only the hooks you need. `pre-finish` and `pre-terminate` are disabled by default for performance.

## Resources

- [tusd Documentation](https://tus.github.io/tusd/)
- [tusd GitHub](https://github.com/tus/tusd)
- [tus Protocol Specification](https://tus.io/protocols/resumable-upload)
- [Hook Examples](https://github.com/tus/tusd/tree/main/examples/hooks)
- [Docker Hub](https://hub.docker.com/r/tusproject/tusd)
