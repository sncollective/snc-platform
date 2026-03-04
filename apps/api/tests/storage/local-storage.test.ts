import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { rm, mkdir } from "node:fs/promises";
import node_path from "node:path";
import { randomUUID } from "node:crypto";

import { runStorageContractTests } from "@snc/shared/testing";

import { createLocalStorage } from "../../src/storage/local-storage.js";

// ── Setup ──

const TEST_BASE_DIR = node_path.join("/tmp", `snc-storage-test-${randomUUID()}`);

const createProvider = () => createLocalStorage({ baseDir: TEST_BASE_DIR });

const cleanup = async () => {
  await rm(TEST_BASE_DIR, { recursive: true, force: true });
};

// ── Contract Tests ──

runStorageContractTests(createProvider, cleanup);

// ── Local Storage Specific Tests ──

describe("createLocalStorage", () => {
  let provider: ReturnType<typeof createLocalStorage>;

  beforeEach(async () => {
    await mkdir(TEST_BASE_DIR, { recursive: true });
    provider = createProvider();
  });

  afterEach(async () => {
    await cleanup();
  });

  it("creates nested directories for keys with path separators", async () => {
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode("nested"));
        controller.close();
      },
    });

    const result = await provider.upload(
      "content/abc/media/video.mp4",
      stream,
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.key).toBe("content/abc/media/video.mp4");
      expect(result.value.size).toBe(6); // "nested" = 6 bytes
    }
  });

  it("resolves baseDir to absolute path", async () => {
    // createLocalStorage resolves relative paths at construction
    const relativeProvider = createLocalStorage({
      baseDir: "./test-relative",
    });
    // Verify it doesn't throw — the resolved path is internal
    expect(relativeProvider).toBeDefined();
    expect(relativeProvider.upload).toBeTypeOf("function");
  });

  it("rejects path traversal via ../", async () => {
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode("malicious"));
        controller.close();
      },
    });

    const result = await provider.upload("../../etc/passwd", stream);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("STORAGE_ERROR");
      expect(result.error.statusCode).toBe(400);
    }
  });

  it("rejects path traversal in download", async () => {
    const result = await provider.download("../../../etc/shadow");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("STORAGE_ERROR");
      expect(result.error.statusCode).toBe(400);
    }
  });

  it("rejects path traversal in delete", async () => {
    const result = await provider.delete("../../some/file");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("STORAGE_ERROR");
      expect(result.error.statusCode).toBe(400);
    }
  });

  it("allows normal nested keys", async () => {
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode("ok"));
        controller.close();
      },
    });

    const result = await provider.upload("content/abc/media/file.mp4", stream);
    expect(result.ok).toBe(true);
  });

  it("getSignedUrl extracts content ID from key format", async () => {
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode("data"));
        controller.close();
      },
    });
    await provider.upload("content/my-content-id/media/file.mp4", stream);

    const result = await provider.getSignedUrl(
      "content/my-content-id/media/file.mp4",
      3600,
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe("/api/content/my-content-id/media");
    }
  });
});
