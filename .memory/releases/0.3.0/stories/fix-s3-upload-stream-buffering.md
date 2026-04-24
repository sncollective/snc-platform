---
id: story-fix-s3-upload-stream-buffering
kind: story
stage: done
tags: [media-pipeline, content]
release_binding: 0.3.0
created: 2026-04-24
updated: 2026-04-24
related_decisions: []
related_designs: []
parent: null
---

Surfaced by the 0.3.0 refactor-gate scan (api/infra). [`s3-storage.ts:46`](../../apps/api/src/storage/s3-storage.ts#L46)'s `upload` implementation buffers the entire incoming `ReadableStream<Uint8Array>` into memory via `new Response(stream).arrayBuffer()` before passing to `PutObjectCommand`. A 4 GB upload becomes a 4 GB Node heap allocation.

Immediately-relevant for 0.3.0 because [resumable-uploads-tus](../features/resumable-uploads-tus.md) just shipped: tusd writes files into S3 via its own S3 backend, so tus uploads don't hit this path. But our own completion flow and processing pipeline (transcode output, extract-thumbnail output, playout ingest) do call `storage.upload()` for large transcoded files. A 4 GB HEVC source transcoded to a 1 GB H.264 output still streams through this path during `uploadFromTemp` — and the 1 GB ArrayBuffer allocation per upload will cascade to OOM under concurrent jobs or larger sources.

Also — the `HeadObjectCommand` call immediately after `PutObjectCommand` (to populate `ContentLength` in the `UploadResult`) is redundant: the stream's total size is already known from the buffered `ArrayBuffer.byteLength`. After fix this HEAD becomes unnecessary.

## What changes

[apps/api/src/storage/s3-storage.ts](../../apps/api/src/storage/s3-storage.ts) — `upload` method:

1. **Pass the stream directly** to `PutObjectCommand` as `Body`, converting `ReadableStream<Uint8Array>` to a Node `Readable` via `Readable.fromWeb(stream)`. No more `.arrayBuffer()` buffering.
2. **Drop the HEAD-after-PUT call** for size. Track bytes streamed into the PUT (either via a `Transform` stream counter or by accepting that the `UploadResult.size` field is optional / derived from a separate `head()` call when callers need it). `UploadMetadata` already carries `contentLength` hints from callers in many cases.

Alternative worth considering during implementation: route this code path through `@aws-sdk/lib-storage`'s `Upload` class, which already handles streaming multipart correctly for large payloads. That's the same library `uploadFromTemp` uses for files ≥ `MULTIPART_THRESHOLD`. The existing `StorageProvider.upload` contract may already be served by a thin wrapper around `Upload.done()`.

## Tasks

- [ ] Replace the `arrayBuffer()` buffering with a streaming body on `PutObjectCommand` (or route through `lib-storage.Upload`).
- [ ] Decide whether to drop, defer, or preserve the size field on `UploadResult`. If preserving, count bytes via a stream transform; if dropping, update the `StorageProvider.upload` contract in `packages/shared/src/storage.ts` and all callers.
- [ ] Remove the redundant `HeadObjectCommand` call at the end of `upload`.
- [ ] Run the storage contract tests (`tests/storage/s3-storage.test.ts`) — they should still pass unchanged if `UploadResult.size` semantics are preserved.
- [ ] Add a test that uploads a stream larger than 100 MiB via the mock S3 and asserts memory stays bounded (heap-snapshot-based, or just assert via `setBody` assertion that no `ArrayBuffer` is materialized).

## Verification

- Manual: upload a 2 GB test file via the transcode output path in dev and observe heap usage via `node --inspect` or `process.memoryUsage()`. Pre-fix: heap peaks at ≥2 GB. Post-fix: heap should stay within ~100 MiB (multipart buffer size).
- Unit tests continue to pass.

## Risks

Medium. The `StorageProvider` interface contract needs careful handling if `UploadResult.size` becomes optional or derived differently. Callers (multipart completion, tusd hook, storage-provider tests) all read the returned key and occasionally the size. Audit during implementation.

The alternative of routing through `lib-storage.Upload` is lower-risk (proven path) but larger-diff.
