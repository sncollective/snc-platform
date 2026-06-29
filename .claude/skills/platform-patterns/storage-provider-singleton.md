# Pattern: Storage Provider Singleton

StorageProvider interface + exhaustive-switch factory + module-level singleton export; route files import the singleton directly; tests replace it with `vi.doMock()`.

## Rationale

A `StorageProvider` interface defines the backend-agnostic contract (upload/download/delete/getSignedUrl). A `createStorageProvider(cfg)` factory selects the implementation at startup via an exhaustive switch on `STORAGE_TYPE`, crashing loudly for unknown types. The result is exported as a module-level singleton so routes import it with a single statement; `vi.doMock()` swaps the singleton per test.

## Examples

### Example 1: StorageProvider interface in shared package
**File**: `packages/shared/src/storage.ts:33-66`
```typescript
export type StorageProvider = {
  upload(
    key: string,
    stream: ReadableStream<Uint8Array>,
    metadata?: UploadMetadata,
  ): Promise<Result<UploadResult, AppError>>;

  download(key: string): Promise<Result<DownloadResult, AppError>>;
  downloadRange(key: string, start: number, end: number): Promise<Result<RangeDownloadResult, AppError>>;
  delete(key: string): Promise<Result<void, AppError>>;
  getSignedUrl(key: string, expiresInSeconds: number): Promise<Result<string, AppError>>;
  head(key: string): Promise<Result<{ size: number; contentType: string }, AppError>>;
  getPresignedUploadUrl(
    key: string,
    contentType: string,
    expiresInSeconds: number,
    contentLength: number,
  ): Promise<Result<string, AppError>>;
};
```

### Example 2: Factory + singleton in storage/index.ts
**File**: `apps/api/src/storage/provider.ts:45-59` and `apps/api/src/storage/index.ts:19-21`
```typescript
export const createStorageProvider = (cfg: Config): StorageProvider => {
  switch (cfg.STORAGE_TYPE) {
    case "local":
      return createLocalStorage({ baseDir: cfg.STORAGE_LOCAL_DIR });
    case "s3": {
      const client = createS3Client(cfg);
      return createS3Storage({ client, bucket: cfg.S3_BUCKET! });
    }
    default: {
      const exhaustive: never = cfg.STORAGE_TYPE;
      throw new AppError("STORAGE_CONFIG_ERROR", `Unknown storage type: ${exhaustive}`, 500);
    }
  }
};

export const storage: StorageProvider = s3Client
  ? createS3Storage({ client: s3Client, bucket: config.S3_BUCKET! })
  : createLocalStorage({ baseDir: config.STORAGE_LOCAL_DIR });
```

### Example 3: Route file imports singleton; test mocks it via vi.doMock
**File**: `apps/api/src/routes/content-media.routes.ts:21,187-193`
```typescript
import { storage } from "../storage/index.js";

// Usage inside a route handler:
const uploadResult = await storage.upload(key, stream, {
  contentType: file.type,
  contentLength: file.size,
});
```

**File**: `apps/api/tests/routes/content.routes.test.ts:65-132`
```typescript
// Individual method stubs assembled into a mock object
const mockStorageUpload = vi.fn();
const mockStorageDownload = vi.fn();
const mockStorageDelete = vi.fn();
const mockStorage = {
  upload: mockStorageUpload,
  download: mockStorageDownload,
  delete: mockStorageDelete,
  getSignedUrl: vi.fn(),
};

vi.doMock("../../src/storage/index.js", () => ({
  storage: mockStorage,
  createStorageProvider: vi.fn(),
}));

// Default responses in beforeEach:
mockStorageUpload.mockResolvedValue(ok({ key: "test-key", size: 100 }));
mockStorageDownload.mockResolvedValue(ok(new ReadableStream()));
mockStorageDelete.mockResolvedValue(ok(undefined));
```

## When to Use

- Implementing a new storage backend (S3, GCS, etc.) — add a `case` to the switch and export a new `create*Storage()` factory
- Injecting storage into route files — import `storage` directly from `storage/index.ts`
- Testing routes that call storage methods — use `vi.doMock` with per-method stubs assembled into the `mockStorage` object

## When NOT to Use

- Do not pass storage as a parameter to route handlers — the singleton import is the DI mechanism
- Do not add a default that silently falls back; always keep the `const exhaustive: never` trick so TypeScript catches missing cases at compile time

## Common Violations

- Importing `createLocalStorage` directly into routes — routes should only import the singleton `storage`
- Testing with a single mock object stub instead of individual `vi.fn()` per method — individual stubs allow per-test return-value control via `mockResolvedValue`
