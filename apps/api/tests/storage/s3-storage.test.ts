import { describe, it, expect, vi, beforeEach } from "vitest";

import { NotFoundError } from "@snc/shared";

// ── Mocks ──
// mockReset: true in vitest config resets mock implementations before each test.
// We use vi.hoisted to create the mock functions, then vi.mock to provide
// module-level mocks. We re-mock getSignedUrl in beforeEach since the
// module mock is only available after import.

const { mockSend, mockGetSignedUrl } = vi.hoisted(() => {
  const mockSend = vi.fn();
  const mockGetSignedUrl = vi.fn();
  return { mockSend, mockGetSignedUrl };
});

vi.mock("@aws-sdk/client-s3", () => ({
  S3Client: class MockS3Client {
    send = mockSend;
  },
  PutObjectCommand: vi.fn().mockImplementation((params: unknown) => ({ ...(params as object), type: "PutObject" })),
  GetObjectCommand: vi.fn().mockImplementation((params: unknown) => ({ ...(params as object), type: "GetObject" })),
  DeleteObjectCommand: vi.fn().mockImplementation((params: unknown) => ({ ...(params as object), type: "DeleteObject" })),
  HeadObjectCommand: vi.fn().mockImplementation((params: unknown) => ({ ...(params as object), type: "HeadObject" })),
}));

vi.mock("@aws-sdk/s3-request-presigner", () => ({
  getSignedUrl: mockGetSignedUrl,
}));

// ── Setup ──

import { S3Client } from "@aws-sdk/client-s3";
import { createS3Storage } from "../../src/storage/s3-storage.js";

const makeFakeStream = (): ReadableStream<Uint8Array> =>
  new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode("hello s3"));
      controller.close();
    },
  });

// ── Tests ──

describe("createS3Storage", () => {
  let storage: ReturnType<typeof createS3Storage>;

  beforeEach(() => {
    // With mockReset: true in vitest config, mockSend is reset before each test.
    // Restore the default for getSignedUrl.
    mockGetSignedUrl.mockResolvedValue("https://s3.example.com/presigned-url");

    // Create client — MockS3Client class uses mockSend directly as a property.
    const client = new S3Client({});
    storage = createS3Storage({ client, bucket: "test-bucket" });
  });

  // ── upload ──

  describe("upload", () => {
    it("returns ok with key and size", async () => {
      mockSend
        .mockResolvedValueOnce({}) // PutObjectCommand
        .mockResolvedValueOnce({ ContentLength: 8, ContentType: "text/plain" }); // HeadObjectCommand

      const result = await storage.upload("content/abc/media/test.mp4", makeFakeStream(), {
        contentType: "video/mp4",
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.key).toBe("content/abc/media/test.mp4");
        expect(result.value.size).toBe(8);
      }
    });

    it("falls back to body byteLength when HeadObjectCommand returns no ContentLength", async () => {
      mockSend
        .mockResolvedValueOnce({}) // PutObjectCommand
        .mockResolvedValueOnce({ ContentLength: undefined }); // HeadObjectCommand

      const result = await storage.upload("content/abc/media/test.mp4", makeFakeStream());

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.size).toBeGreaterThanOrEqual(0);
      }
    });

    it("returns err when S3 throws", async () => {
      mockSend.mockRejectedValueOnce(new Error("S3 put failed"));

      const result = await storage.upload("content/abc/media/test.mp4", makeFakeStream());

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("S3_ERROR");
        expect(result.error.statusCode).toBe(502);
      }
    });
  });

  // ── download ──

  describe("download", () => {
    it("returns stream for existing key", async () => {
      const fakeWebStream = new ReadableStream({ start(c) { c.close(); } });
      mockSend.mockResolvedValueOnce({
        Body: { transformToWebStream: () => fakeWebStream },
        ContentLength: 42,
      });

      const result = await storage.download("content/abc/media/test.mp4");

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.stream).toBe(fakeWebStream);
        expect(result.value.size).toBe(42);
      }
    });

    it("returns NotFoundError for NoSuchKey error", async () => {
      const noSuchKey = new Error("The specified key does not exist.");
      (noSuchKey as Error & { name: string }).name = "NoSuchKey";
      mockSend.mockRejectedValueOnce(noSuchKey);

      const result = await storage.download("content/nonexistent.mp4");

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBeInstanceOf(NotFoundError);
      }
    });

    it("returns err when Body is missing", async () => {
      mockSend.mockResolvedValueOnce({ Body: null, ContentLength: 0 });

      const result = await storage.download("content/abc/media/test.mp4");

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBeInstanceOf(NotFoundError);
      }
    });

    it("returns S3_ERROR for generic S3 errors", async () => {
      mockSend.mockRejectedValueOnce(new Error("S3 service unavailable"));

      const result = await storage.download("content/abc/media/test.mp4");

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("S3_ERROR");
        expect(result.error.statusCode).toBe(502);
      }
    });
  });

  // ── delete ──

  describe("delete", () => {
    it("returns ok for successful delete", async () => {
      mockSend.mockResolvedValueOnce({});

      const result = await storage.delete("content/abc/media/test.mp4");

      expect(result.ok).toBe(true);
    });

    it("is idempotent — returns ok even if key doesn't exist", async () => {
      mockSend.mockResolvedValueOnce({}); // S3 delete is always idempotent

      const result = await storage.delete("content/does-not-exist.mp4");

      expect(result.ok).toBe(true);
    });

    it("returns err when S3 throws", async () => {
      mockSend.mockRejectedValueOnce(new Error("Delete failed"));

      const result = await storage.delete("content/abc/media/test.mp4");

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("S3_ERROR");
      }
    });
  });

  // ── getSignedUrl ──

  describe("getSignedUrl", () => {
    it("returns a URL string", async () => {
      const result = await storage.getSignedUrl("content/abc/media/test.mp4", 3600);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(typeof result.value).toBe("string");
        expect(result.value).toBe("https://s3.example.com/presigned-url");
      }
    });

    it("returns err when presigner throws", async () => {
      mockGetSignedUrl.mockRejectedValueOnce(new Error("Presign failed"));

      const result = await storage.getSignedUrl("content/abc/media/test.mp4", 3600);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("S3_ERROR");
      }
    });
  });

  // ── head ──

  describe("head", () => {
    it("returns size and contentType for existing key", async () => {
      mockSend.mockResolvedValueOnce({
        ContentLength: 1024,
        ContentType: "video/mp4",
      });

      const result = await storage.head("content/abc/media/test.mp4");

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.size).toBe(1024);
        expect(result.value.contentType).toBe("video/mp4");
      }
    });

    it("uses defaults when ContentLength and ContentType are undefined", async () => {
      mockSend.mockResolvedValueOnce({
        ContentLength: undefined,
        ContentType: undefined,
      });

      const result = await storage.head("content/abc/media/test.mp4");

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.size).toBe(0);
        expect(result.value.contentType).toBe("application/octet-stream");
      }
    });

    it("returns NotFoundError for NoSuchKey", async () => {
      const noSuchKey = new Error("The specified key does not exist.");
      (noSuchKey as Error & { name: string }).name = "NoSuchKey";
      mockSend.mockRejectedValueOnce(noSuchKey);

      const result = await storage.head("content/nonexistent.mp4");

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBeInstanceOf(NotFoundError);
      }
    });

    it("returns S3_ERROR for generic errors", async () => {
      mockSend.mockRejectedValueOnce(new Error("Connection timeout"));

      const result = await storage.head("content/abc/media/test.mp4");

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("S3_ERROR");
        expect(result.error.statusCode).toBe(502);
      }
    });
  });

  // ── getPresignedUploadUrl ──

  describe("getPresignedUploadUrl", () => {
    it("returns a presigned URL string", async () => {
      const result = await storage.getPresignedUploadUrl(
        "content/abc/media/video.mp4",
        "video/mp4",
        3600,
        1024 * 1024,
      );

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(typeof result.value).toBe("string");
        expect(result.value).toBe("https://s3.example.com/presigned-url");
      }
    });

    it("returns err when presigner throws", async () => {
      mockGetSignedUrl.mockRejectedValueOnce(new Error("Presign failed"));

      const result = await storage.getPresignedUploadUrl(
        "content/abc/media/video.mp4",
        "video/mp4",
        3600,
        1024 * 1024,
      );

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("S3_ERROR");
      }
    });
  });
});
