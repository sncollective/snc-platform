---
id: feature-prod-playout-fixes-multipart-upload
kind: feature
stage: done
tags: [streaming, media-pipeline]
release_binding: 0.3.0
created: 2026-04-18
updated: 2026-04-18
related_decisions: []
related_designs: []
parent: prod-playout-fixes
---

# Streaming Multipart Upload Fix

*(conditional: verify with large files in prod)*

Ships Issue 2 from the parent epic: server-side uploads above ~5GB fail on S3/Garage, and files under 5GB can OOM due to full-buffer `arrayBuffer()` in `storage.upload()`. Fix: use `@aws-sdk/lib-storage` `Upload` utility in `uploadFromTemp()` above a 100MB threshold; falls back to existing `storage.upload()` for local storage or small files. Applies to all three callers: `playout-ingest`, `transcode`, `extract-thumbnail`.

## Sub-units (all done)

- [x] Install `@aws-sdk/lib-storage`
- [x] Export `s3Client` + `s3Bucket` from storage index
- [x] Streaming `uploadFromTemp()` dual-path implementation

## Design

### Unit 4: Install `@aws-sdk/lib-storage`

**File**: `platform/apps/api/package.json`

```bash
bun add --filter @snc/api @aws-sdk/lib-storage
```

**Acceptance Criteria**:

- [ ] `@aws-sdk/lib-storage` appears in `dependencies`

---

### Unit 5: Export `s3Client` from Storage Index

**File**: `platform/apps/api/src/storage/index.ts`

Export the existing `s3Client` so `uploadFromTemp` can pass it to the `Upload` utility.

```typescript
// Change line 16 from:
const s3Client = config.STORAGE_TYPE === "s3" ? createS3Client(config) : null;
// To:
export const s3Client = config.STORAGE_TYPE === "s3" ? createS3Client(config) : null;
```

Also export `S3_BUCKET` for the Upload params (needed since `Upload` takes `Bucket` directly):

```typescript
/** S3 bucket name; null when using local storage. */
export const s3Bucket: string | null = config.STORAGE_TYPE === "s3" ? config.S3_BUCKET! : null;
```

**Implementation Notes**:

- `s3Client` is already created at module level (line 16) and shared between `storage` and `s3Multipart` — this just makes it importable
- Adding `s3Bucket` avoids importing `config` in `processing-jobs.ts` just for the bucket name

**Acceptance Criteria**:

- [ ] `s3Client` is exported (type `S3Client | null`)
- [ ] `s3Bucket` is exported (type `string | null`)
- [ ] Existing `storage` and `s3Multipart` singletons unchanged

---

### Unit 6: Streaming `uploadFromTemp()` with `@aws-sdk/lib-storage`

**File**: `platform/apps/api/src/services/processing-jobs.ts`

Replace the current `uploadFromTemp` implementation that buffers via `storage.upload()` with a dual-path approach: streaming multipart via `Upload` for S3, or existing `storage.upload()` for local storage.

```typescript
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";
import { Upload } from "@aws-sdk/lib-storage";
import { AppError, ok, err } from "@snc/shared";
import type { Result } from "@snc/shared";
import { storage, s3Client, s3Bucket } from "../storage/index.js";
import { rootLogger } from "../logging/logger.js";

/** Minimum file size (in bytes) to use multipart upload. Below this, single PutObject is fine. */
const MULTIPART_THRESHOLD = 100 * 1024 * 1024; // 100 MB

/**
 * Upload a local temp file to storage.
 * Uses streaming multipart upload via @aws-sdk/lib-storage for S3 files above
 * the threshold; falls back to StorageProvider.upload() for small files or
 * local storage.
 *
 * @returns err(AppError) when upload fails or storage is unreachable
 */
export const uploadFromTemp = async (
  tempPath: string,
  storageKey: string,
  contentType: string,
): Promise<Result<void, AppError>> => {
  try {
    const fileStats = await stat(tempPath);

    if (s3Client && s3Bucket && fileStats.size >= MULTIPART_THRESHOLD) {
      const upload = new Upload({
        client: s3Client,
        params: {
          Bucket: s3Bucket,
          Key: storageKey,
          ContentType: contentType,
          Body: createReadStream(tempPath),
        },
      });
      await upload.done();
      return ok(undefined);
    }

    // Small files or local storage — use existing StorageProvider
    const nodeStream = createReadStream(tempPath);
    const webStream = Readable.toWeb(nodeStream) as ReadableStream<Uint8Array>;
    const uploadResult = await storage.upload(storageKey, webStream, {
      contentType,
      contentLength: fileStats.size,
    });
    if (!uploadResult.ok) return err(uploadResult.error);
    return ok(undefined);
  } catch (e) {
    rootLogger.error(
      { error: e instanceof Error ? e.message : String(e) },
      "Failed to upload from temp",
    );
    return err(
      new AppError("PROCESSING_ERROR", "Failed to upload processed media", 500),
    );
  }
};
```

**Implementation Notes**:

- `MULTIPART_THRESHOLD` at 100MB is conservative — multipart adds overhead for small files but is essential for anything approaching the 5GB limit. The `Upload` utility handles single-part internally for very small files, but we skip it entirely for local storage
- `s3Client && s3Bucket` check ensures we only use `Upload` when S3 is configured. In dev with local storage, `s3Client` is null and we fall through to the existing path
- `createReadStream(tempPath)` streams from disk — Node.js `Readable` is accepted by the `Upload` utility's `Body` param. Memory stays bounded to the `partSize` (default 5MB × `queueSize` 4 = ~20MB peak)
- The `Upload` utility automatically handles chunking, multipart initiation, part upload, and completion. On failure, it aborts and cleans up (default `leavePartsOnError: false`)
- The `storage.upload()` fallback path for small files remains unchanged — the `arrayBuffer()` buffering in `s3-storage.ts` is fine for files under 100MB
- This fixes all three callers (`playout-ingest`, `transcode`, `extract-thumbnail`) since they all use `uploadFromTemp`

**Acceptance Criteria**:

- [ ] Files >= 100MB on S3 use `Upload` (streaming multipart) — no full-file buffering
- [ ] Files < 100MB on S3 use existing `storage.upload()` path
- [ ] Local storage (dev) uses existing `storage.upload()` regardless of size
- [ ] Returns `ok` on successful upload
- [ ] Returns `err(AppError)` wrapping S3 errors on failure
- [ ] Memory usage stays bounded for large files (no `arrayBuffer()` spike)

## Testing

### Unit Tests: `tests/services/processing-jobs.test.ts`

Add tests for the multipart upload path. The existing mock setup mocks `storage` — add mocks for `s3Client`, `s3Bucket`, and `Upload`:

```typescript
describe("uploadFromTemp with streaming multipart", () => {
  it("uses Upload for large files on S3", async () => {
    mockStat.mockResolvedValue({ size: 200 * 1024 * 1024 }); // 200MB
    mockCreateReadStream.mockReturnValue({ pipe: vi.fn() });
    mockUploadDone.mockResolvedValue({});

    const { uploadFromTemp } = await setupProcessingJobsWithS3();
    const result = await uploadFromTemp("/tmp/large.mp4", "output/key.mp4", "video/mp4");

    expect(result.ok).toBe(true);
    expect(mockUploadConstructor).toHaveBeenCalledWith(
      expect.objectContaining({
        client: expect.anything(),
        params: expect.objectContaining({
          Bucket: "snc-storage",
          Key: "output/key.mp4",
          ContentType: "video/mp4",
        }),
      }),
    );
    expect(mockUpload).not.toHaveBeenCalled();
  });

  it("uses storage.upload for small files on S3", async () => {
    mockStat.mockResolvedValue({ size: 1024 });
    mockCreateReadStream.mockReturnValue({ pipe: vi.fn() });
    mockUpload.mockResolvedValue({ ok: true, value: undefined });

    const { uploadFromTemp } = await setupProcessingJobsWithS3();
    const result = await uploadFromTemp("/tmp/small.mp4", "output/key.mp4", "video/mp4");

    expect(result.ok).toBe(true);
    expect(mockUpload).toHaveBeenCalled();
  });

  it("returns err when Upload.done() throws", async () => {
    mockStat.mockResolvedValue({ size: 200 * 1024 * 1024 });
    mockCreateReadStream.mockReturnValue({ pipe: vi.fn() });
    mockUploadDone.mockRejectedValue(new Error("S3 upload failed"));

    const { uploadFromTemp } = await setupProcessingJobsWithS3();
    const result = await uploadFromTemp("/tmp/large.mp4", "output/key.mp4", "video/mp4");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("PROCESSING_ERROR");
    }
  });
});
```

## Verification

```bash
bun run --filter @snc/api test:unit
bun run --filter @snc/api build

# Prod verification (manual, after deploy):
# 1. Upload a >5GB file → ingest job completes without OOM or "data is too long"
# 2. Memory during upload stays bounded (no full-buffer spike)
```
