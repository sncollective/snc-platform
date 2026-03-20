# Pattern: Storage Contract Test

`runStorageContractTests(createProvider, cleanup)` generates a standard `describe` block verifying any `StorageProvider` implementation; `textToStream`/`streamToText` helpers convert between strings and `ReadableStream<Uint8Array>` for assertions.

## Rationale

Every StorageProvider implementation must satisfy the same behavioral contract (upload → download roundtrip, idempotent delete, NotFoundError on missing key, etc.). Encoding these expectations in a shared factory — rather than duplicating them in each implementation's test file — ensures all backends are held to the same bar. The `textToStream`/`streamToText` utilities are exported for reuse in route tests that mock streaming responses.

## Examples

### Example 1: Contract test definition in shared package
**File**: `packages/shared/src/storage-contract.ts:36`
```typescript
export const runStorageContractTests = (
  createProvider: () => StorageProvider,
  cleanup: () => Promise<void>,
): void => {
  describe("StorageProvider contract", () => {
    let provider: StorageProvider;

    beforeEach(() => { provider = createProvider(); });
    afterEach(async () => { await cleanup(); });

    it("upload returns ok with key and size", async () => {
      const content = "hello world";
      const result = await provider.upload(
        "test/file.txt",
        textToStream(content),
        { contentType: "text/plain" },
      );
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.key).toBe("test/file.txt");
        expect(result.value.size).toBe(new TextEncoder().encode(content).byteLength);
      }
    });

    it("delete non-existent key returns ok (idempotent)", async () => {
      const result = await provider.delete("test/does-not-exist-" + Date.now() + ".txt");
      expect(result.ok).toBe(true);
    });

    it("download non-existent key returns err with NotFoundError", async () => {
      const result = await provider.download("test/never-uploaded-" + Date.now() + ".txt");
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBeInstanceOf(NotFoundError);
      }
    });
  });
};
```

### Example 2: Using the contract test for LocalStorage
**File**: `apps/api/tests/storage/local-storage.test.ts:1`
```typescript
import { runStorageContractTests } from "@snc/shared";

const TEST_BASE_DIR = node_path.join("/tmp", `snc-storage-test-${randomUUID()}`);
const createProvider = () => createLocalStorage({ baseDir: TEST_BASE_DIR });
const cleanup = async () => {
  await rm(TEST_BASE_DIR, { recursive: true, force: true });
};

// Runs all 7 contract tests against this implementation
runStorageContractTests(createProvider, cleanup);

// Then add implementation-specific tests below:
describe("createLocalStorage", () => {
  // directory creation, path resolution, signed URL format, etc.
});
```

### Example 3: textToStream / streamToText helpers for route tests
**File**: `packages/shared/src/storage-contract.ts:8`
```typescript
export const textToStream = (text: string): ReadableStream<Uint8Array> => {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(text));
      controller.close();
    },
  });
};

export const streamToText = async (
  stream: ReadableStream<Uint8Array>,
): Promise<string> => {
  return new Response(stream).text();
};
```

**File**: `apps/api/tests/routes/content.routes.test.ts:607`
```typescript
import { ok, textToStream } from "@snc/shared";

// Mock streaming download
mockStorageDownload.mockResolvedValue(ok(textToStream("file data")));

// Assert streamed response body
const text = await res.text();
expect(text).toBe("file data");
```

## When to Use

- Every new `StorageProvider` implementation must invoke `runStorageContractTests` before adding its own specific tests
- Use `textToStream` / `streamToText` in any test that needs to produce or consume a `ReadableStream<Uint8Array>`

## When NOT to Use

- Do not copy-paste individual contract test cases into implementation-specific test files — call `runStorageContractTests` instead
- Do not use `textToStream` for non-test code; it is a test utility only (no production encoding optimizations)

## Common Violations

- Writing a new StorageProvider implementation without calling `runStorageContractTests` — the contract tests are the minimum acceptance bar
- Forgetting the `cleanup` callback — temp files/directories accumulate across test runs
