---
source_handle: tusd-src-2-9-2
source_class: github-readme
fetched: 2026-06-18
source_path: platform/.research/reference/input/tusd
source_url: https://github.com/tus/tusd
provenance: source-direct
version: tag v2.9.2 @ commit 1215a10c30218b42ace3eed6db952928472d9545
---

# tusd v2.9.2 — Source Attestation

Clone command: `git clone --depth 1 --branch v2.9.2 https://github.com/tus/tusd.git`
Resolved commit: `1215a10c30218b42ace3eed6db952928472d9545`

Key packages read:
- `pkg/handler/unrouted_handler.go` — tus protocol handler, hook lifecycle
- `pkg/handler/hooks.go` — HookEvent type definition
- `pkg/hooks/hooks.go` — hook dispatch, HookType constants, sync/async invocation
- `pkg/hooks/http/http.go` — HTTP hook backend (what tusd POSTs to our API)
- `pkg/s3store/s3store.go` — S3 backend implementation

---

## Hook Type Constants

Source: `pkg/hooks/hooks.go:93-101`

```go
const (
    HookPostFinish    HookType = "post-finish"
    HookPostTerminate HookType = "post-terminate"
    HookPostReceive   HookType = "post-receive"
    HookPostCreate    HookType = "post-create"
    HookPreCreate     HookType = "pre-create"
    HookPreFinish     HookType = "pre-finish"
    HookPreTerminate  HookType = "pre-terminate"
)
```

All seven hook types exist. Only hooks listed in `-hooks-enabled-events` are fired.

---

## Hook Blocking vs Async

Source: `pkg/hooks/hooks.go:257-308` (`NewHandlerWithHooks`)

Pre-create, pre-finish, and pre-terminate are **synchronous** — installed as callbacks on `config.PreUploadCreateCallback`, `config.PreFinishResponseCallback`, `config.PreUploadTerminateCallback` respectively. The handler blocks waiting for the callback to return.

Post-create, post-finish, post-terminate, and post-receive are **asynchronous** — the handler sends on an unbuffered channel (`CompleteUploads`, `TerminatedUploads`, `CreatedUploads`, `UploadProgress`), and a goroutine consumes the channel and calls `invokeHookAsync` (which spawns another goroutine). The channel send blocks until the consumer goroutine reads, but `invokeHookAsync` launches a goroutine immediately after reading, so the block is transient.

Key passage for post-finish: `pkg/hooks/hooks.go:296-298`:
```go
case event := <-handler.CompleteUploads:
    invokeHookAsync(HookPostFinish, event, hookHandler)
```

---

## Hook Ordering

Source: `pkg/handler/unrouted_handler.go:1003-1019` (`emitFinishEvents`)

```go
func (handler *UnroutedHandler) emitFinishEvents(...) (HTTPResponse, error) {
    if handler.config.PreFinishResponseCallback != nil {
        resp2, err := handler.config.PreFinishResponseCallback(newHookEvent(c, info))
        // ...
    }
    // ...
    if handler.config.NotifyCompleteUploads {
        handler.CompleteUploads <- newHookEvent(c, info)
    }
    return resp, nil
}
```

Order within `emitFinishEvents`: pre-finish completes first (synchronous), then the CompleteUploads channel is sent. The post-finish goroutine spawns after the send is consumed. The response to the tus client goes out AFTER `emitFinishEvents` returns.

So the ordering guarantee for post-finish:
- pre-finish is synchronous and blocks the response
- post-finish is triggered after pre-finish (via channel send in emitFinishEvents), but the HTTP response to the tus client is sent before post-finish completes
- A `post-finish` hook call at our API arrives after the tus upload is fully committed to S3

---

## Hook Failure Contract

Source: `pkg/hooks/http/http.go:85-88`

```go
if httpRes.StatusCode < http.StatusOK || httpRes.StatusCode >= http.StatusMultipleChoices {
    return hookRes, fmt.Errorf("unexpected response code from hook endpoint (%d): %s", httpRes.StatusCode, string(httpBody))
}
```

A non-2xx response causes `InvokeHook` to return an error.

**Pre-create failure**: `preCreateCallback` (`pkg/hooks/hooks.go:106-126`) returns the error. The handler (`PostFile` in `unrouted_handler.go:366-391`) calls `handler.sendError(c, err)` and aborts — no upload resource is created.

**Post-finish failure**: `invokeHookAsync` (`pkg/hooks/hooks.go:206-210`) discards all return values including the error (only logs it at error level in `invokeHookSync`). The tus client has already received its 204 response. The failure is silent to the tus client.

**Content-Type requirement**: `pkg/hooks/http/http.go:95-106` — tusd requires the hook response to have `Content-Type: application/json` or it returns an error. Missing Content-Type causes hook failure with the same async/sync failure consequence depending on hook type.

---

## RejectUpload Mechanism

Source: `pkg/hooks/hooks.go:115-121`

```go
if hookRes.RejectUpload {
    err := handler.ErrUploadRejectedByServer
    err.HTTPResponse = err.HTTPResponse.MergeWith(httpRes)
    return handler.HTTPResponse{}, handler.FileInfoChanges{}, err
}
```

`ErrUploadRejectedByServer` is the error returned, which has `StatusCode: 400` by default (`unrouted_handler.go:62`). The hook's `HTTPResponse` (including `StatusCode`) is merged on top, so our custom status code (401, 400) wins.

---

## S3 Backend: Object Layout

Source: `pkg/s3store/s3store.go:311-362` (`NewUpload`)

Upload ID format: `objectId + "+" + multipartId` where `objectId = uid.Uid()` (a random UUID-like string).

Storage info in hook payload: `pkg/s3store/s3store.go:350-354`
```go
info.Storage = map[string]string{
    "Type":   "s3store",
    "Bucket": store.Bucket,
    "Key":    *store.keyWithPrefix(objectId),
}
```

The `Key` in the Storage payload is `keyWithPrefix(objectId)` — using `ObjectPrefix` (not `MetadataObjectPrefix`). For our config with `-s3-object-prefix=tus/`, this means the final assembled file key is `tus/<objectId>`.

The `.info` sidecar uses `metadataKeyWithPrefix(objectId + ".info")`. When `MetadataObjectPrefix` is empty (our config sets no `-s3-metadata-object-prefix`), `metadataKeyWithPrefix` falls back to `ObjectPrefix` (lines 1241-1243):
```go
func (store S3Store) metadataKeyWithPrefix(key string) *string {
    prefix := store.MetadataObjectPrefix
    if prefix == "" {
        prefix = store.ObjectPrefix
    }
    // ...
    return aws.String(prefix + key)
}
```

So for our config: `.info` lives at `tus/<objectId>.info`. The `Key` in the hook payload does NOT include the `.info` suffix.

---

## S3 Backend: .info Retention After Completion

Source: `pkg/s3store/s3store.go:842-899` (`FinishUpload`)

`FinishUpload` calls `CompleteMultipartUpload` — it does NOT delete `.info`. The package documentation (`s3store.go:44-46`) states:
> "The info object, containing meta data is not deleted. It is recommended to copy the finished upload to another bucket to avoid it being deleted by the Termination extension."

So the `.info` sidecar persists after upload completion until explicitly deleted (e.g., by our `post-finish` handler) or the `Terminate()` method is called.

---

## S3 Backend: Terminate

Source: `pkg/s3store/s3store.go:776-840` (`Terminate`)

Terminate runs two parallel goroutines:
1. `AbortMultipartUpload` (cleans up any in-progress multipart)
2. `DeleteObjects` with three keys: `objectId` (final file), `objectId.part` (incomplete part temp file), `objectId.info` (info sidecar)

So `Terminate` fully cleans up all three objects. This is the cleanup path for when a `post-terminate` hook fires — tusd has already done the cleanup.

---

## S3 Backend: FinishUpload Does NOT Delete .info

The FinishUpload path (completing the upload) only calls `CompleteMultipartUpload` and returns. The `.info` file remains alive at `tus/<objectId>.info`. Our `post-finish` handler that deletes `tusKey` and `tusKey.info` is doing the right thing for cleanup — it's not redundant with tusd's own cleanup (tusd doesn't delete `.info` on completion, only on termination).

---

## Hook Response: Content-Type Enforcement

Source: `pkg/hooks/http/http.go:95-106`

tusd enforces `Content-Type: application/json` on all hook responses. Missing or wrong Content-Type causes `InvokeHook` to return an error. For pre-create this would abort the upload. For post-finish this is logged and discarded.

Hono's `c.json()` sets `Content-Type: application/json; charset=UTF-8` — the `mime.ParseMediaType` in tusd extracts just the `application/json` media type, ignoring parameters. This is compatible.

---

## tus Protocol Version

Source: `pkg/handler/unrouted_handler.go:27-32`

tusd v2.9.2 supports both tus v1.0.0 and the IETF resumable uploads draft (experimental, interop versions 3-6). Standard tus v1.0.0 requires `Tus-Resumable: 1.0.0` header.

Our client (`@uppy/tus`) sends `Tus-Resumable: 1.0.0` (tus v1 protocol). The `usesIETFDraft` check at line 1470-1473 requires `EnableExperimentalProtocol: true` and a `Upload-Draft-Interop-Version` header — absent from our setup, so we always use the standard tus v1 path.

---

## Version Currency

Docker-compose pins `tusproject/tusd:latest` (unpinned). v2.9.2 was the resolved image at time of clone. Upstream released v2.10.0 after v2.9.2 (confirmed by the clone being at the v2.9.2 tag, with the note that upstream has moved to v2.10.0). The `:latest` tag means any `docker pull` could bring in v2.10.0+ silently.
