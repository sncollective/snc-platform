import { describe, it, expect, beforeEach, afterEach } from "vitest";

import type { StorageProvider } from "./storage.js";
import { NotFoundError } from "./errors.js";

// ── Public Helpers ──

/** Convert a string to a ReadableStream for storage upload tests. */
export const textToStream = (text: string): ReadableStream<Uint8Array> => {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(text));
      controller.close();
    },
  });
};

/** Consume a ReadableStream and return its contents as a string. */
export const streamToText = async (
  stream: ReadableStream<Uint8Array>,
): Promise<string> => {
  return new Response(stream).text();
};

// ── Private Helpers ──

const emptyStream = (): ReadableStream<Uint8Array> => {
  return new ReadableStream({
    start(controller) {
      controller.close();
    },
  });
};

// ── Public API ──

/** Run the standard StorageProvider compliance test suite against any implementation. */
export const runStorageContractTests = (
  createProvider: () => StorageProvider,
  cleanup: () => Promise<void>,
): void => {
  describe("StorageProvider contract", () => {
    let provider: StorageProvider;

    beforeEach(() => {
      provider = createProvider();
    });

    afterEach(async () => {
      await cleanup();
    });

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
        expect(result.value.size).toBe(
          new TextEncoder().encode(content).byteLength,
        );
      }
    });

    it("download returns matching content after upload", async () => {
      const content = "download test content";
      await provider.upload("test/download.txt", textToStream(content));

      const result = await provider.download("test/download.txt");

      expect(result.ok).toBe(true);
      if (result.ok) {
        const text = await streamToText(result.value.stream);
        expect(text).toBe(content);
        expect(result.value.size).toBe(
          new TextEncoder().encode(content).byteLength,
        );
      }
    });

    it("delete then download returns err", async () => {
      await provider.upload(
        "test/to-delete.txt",
        textToStream("delete me"),
      );

      const deleteResult = await provider.delete("test/to-delete.txt");
      expect(deleteResult.ok).toBe(true);

      const downloadResult = await provider.download("test/to-delete.txt");
      expect(downloadResult.ok).toBe(false);
    });

    it("delete non-existent key returns ok (idempotent)", async () => {
      const result = await provider.delete(
        "test/does-not-exist-" + Date.now() + ".txt",
      );

      expect(result.ok).toBe(true);
    });

    it("upload empty stream returns ok with size 0", async () => {
      const result = await provider.upload(
        "test/empty.txt",
        emptyStream(),
      );

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.key).toBe("test/empty.txt");
        expect(result.value.size).toBe(0);
      }
    });

    it("getSignedUrl returns ok with string URL", async () => {
      await provider.upload(
        "test/signed.txt",
        textToStream("signed content"),
      );

      const result = await provider.getSignedUrl("test/signed.txt", 3600);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(typeof result.value).toBe("string");
        expect(result.value.length).toBeGreaterThan(0);
      }
    });

    it("download non-existent key returns err with NotFoundError", async () => {
      const result = await provider.download(
        "test/never-uploaded-" + Date.now() + ".txt",
      );

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBeInstanceOf(NotFoundError);
      }
    });

    it("head returns size and contentType for existing file", async () => {
      const content = "head test content";
      await provider.upload(
        "test/head-test.txt",
        textToStream(content),
        { contentType: "text/plain" },
      );

      const result = await provider.head("test/head-test.txt");

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.size).toBe(
          new TextEncoder().encode(content).byteLength,
        );
        expect(typeof result.value.contentType).toBe("string");
        expect(result.value.contentType.length).toBeGreaterThan(0);
      }
    });

    it("head returns NotFoundError for non-existent key", async () => {
      const result = await provider.head(
        "test/never-uploaded-head-" + Date.now() + ".txt",
      );

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBeInstanceOf(NotFoundError);
      }
    });

    it("getPresignedUploadUrl returns a Result", async () => {
      const result = await provider.getPresignedUploadUrl(
        "test/presign-test.mp4",
        "video/mp4",
        3600,
      );

      // Result may be ok (S3) or err (local storage) — both are valid
      expect(typeof result.ok).toBe("boolean");
      if (result.ok) {
        expect(typeof result.value).toBe("string");
        expect(result.value.length).toBeGreaterThan(0);
      }
    });
  });
};
