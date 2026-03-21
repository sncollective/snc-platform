import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks ──
// mockReset: true in vitest config resets mock implementations before each test.
// Use a class-based mock for S3Client so send property references the hoisted vi.fn().

const { mockSend, mockGetSignedUrl } = vi.hoisted(() => {
  const mockSend = vi.fn();
  const mockGetSignedUrl = vi.fn();
  return { mockSend, mockGetSignedUrl };
});

vi.mock("@aws-sdk/client-s3", () => ({
  S3Client: class MockS3Client {
    send = mockSend;
  },
  CreateMultipartUploadCommand: vi.fn().mockImplementation((params: unknown) => ({
    ...(params as object),
    type: "CreateMultipartUpload",
  })),
  UploadPartCommand: vi.fn().mockImplementation((params: unknown) => ({
    ...(params as object),
    type: "UploadPart",
  })),
  CompleteMultipartUploadCommand: vi.fn().mockImplementation((params: unknown) => ({
    ...(params as object),
    type: "CompleteMultipartUpload",
  })),
  AbortMultipartUploadCommand: vi.fn().mockImplementation((params: unknown) => ({
    ...(params as object),
    type: "AbortMultipartUpload",
  })),
  ListPartsCommand: vi.fn().mockImplementation((params: unknown) => ({
    ...(params as object),
    type: "ListParts",
  })),
}));

vi.mock("@aws-sdk/s3-request-presigner", () => ({
  getSignedUrl: mockGetSignedUrl,
}));

// ── Setup ──

import { S3Client } from "@aws-sdk/client-s3";
import { createS3Multipart } from "../../src/storage/s3-multipart.js";

// ── Tests ──

describe("createS3Multipart", () => {
  let service: ReturnType<typeof createS3Multipart>;

  beforeEach(() => {
    // mockReset: true resets mockSend before each test (call history + implementations).
    // Re-set the getSignedUrl default.
    mockGetSignedUrl.mockResolvedValue("https://s3.example.com/part-presigned-url");

    const client = new S3Client({});
    service = createS3Multipart({ client, bucket: "test-bucket" });
  });

  // ── createMultipartUpload ──

  describe("createMultipartUpload", () => {
    it("returns uploadId and key on success", async () => {
      mockSend.mockResolvedValueOnce({ UploadId: "upload-id-abc123" });

      const result = await service.createMultipartUpload(
        "content/abc/media/video.mp4",
        "video/mp4",
      );

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.uploadId).toBe("upload-id-abc123");
        expect(result.value.key).toBe("content/abc/media/video.mp4");
      }
    });

    it("returns err when S3 returns no UploadId", async () => {
      mockSend.mockResolvedValueOnce({ UploadId: undefined });

      const result = await service.createMultipartUpload(
        "content/abc/media/video.mp4",
        "video/mp4",
      );

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("S3_MULTIPART_ERROR");
        expect(result.error.message).toContain("No UploadId returned");
      }
    });

    it("returns err when S3 throws", async () => {
      mockSend.mockRejectedValueOnce(new Error("S3 create multipart failed"));

      const result = await service.createMultipartUpload(
        "content/abc/media/video.mp4",
        "video/mp4",
      );

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("S3_MULTIPART_ERROR");
        expect(result.error.statusCode).toBe(502);
      }
    });
  });

  // ── signPart ──

  describe("signPart", () => {
    it("returns a presigned URL", async () => {
      const result = await service.signPart(
        "upload-id-abc123",
        "content/abc/media/video.mp4",
        1,
      );

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe("https://s3.example.com/part-presigned-url");
      }
    });

    it("returns err when presigner throws", async () => {
      mockGetSignedUrl.mockRejectedValueOnce(new Error("Presign failed"));

      const result = await service.signPart(
        "upload-id-abc123",
        "content/abc/media/video.mp4",
        1,
      );

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("S3_MULTIPART_ERROR");
        expect(result.error.statusCode).toBe(502);
      }
    });
  });

  // ── completeMultipartUpload ──

  describe("completeMultipartUpload", () => {
    it("succeeds with valid parts", async () => {
      mockSend.mockResolvedValueOnce({ ETag: '"final-etag"' });

      const result = await service.completeMultipartUpload(
        "upload-id-abc123",
        "content/abc/media/video.mp4",
        [{ PartNumber: 1, ETag: '"part-etag-1"' }],
      );

      expect(result.ok).toBe(true);
    });

    it("returns err when S3 throws", async () => {
      mockSend.mockRejectedValueOnce(new Error("Complete failed"));

      const result = await service.completeMultipartUpload(
        "upload-id-abc123",
        "content/abc/media/video.mp4",
        [{ PartNumber: 1, ETag: '"part-etag-1"' }],
      );

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("S3_MULTIPART_ERROR");
      }
    });
  });

  // ── abortMultipartUpload ──

  describe("abortMultipartUpload", () => {
    it("succeeds and is idempotent", async () => {
      mockSend.mockResolvedValueOnce({});

      const result = await service.abortMultipartUpload(
        "upload-id-abc123",
        "content/abc/media/video.mp4",
      );

      expect(result.ok).toBe(true);
    });

    it("returns err when S3 throws", async () => {
      mockSend.mockRejectedValueOnce(new Error("Abort failed"));

      const result = await service.abortMultipartUpload(
        "upload-id-abc123",
        "content/abc/media/video.mp4",
      );

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("S3_MULTIPART_ERROR");
      }
    });
  });

  // ── listParts ──

  describe("listParts", () => {
    it("returns part details for active multipart upload", async () => {
      mockSend.mockResolvedValueOnce({
        Parts: [
          { PartNumber: 1, Size: 5242880, ETag: '"part1-etag"' },
          { PartNumber: 2, Size: 1234567, ETag: '"part2-etag"' },
        ],
      });

      const result = await service.listParts(
        "upload-id-abc123",
        "content/abc/media/video.mp4",
      );

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toHaveLength(2);
        expect(result.value[0]!.PartNumber).toBe(1);
        expect(result.value[0]!.Size).toBe(5242880);
        expect(result.value[1]!.PartNumber).toBe(2);
      }
    });

    it("returns empty array when Parts is undefined", async () => {
      mockSend.mockResolvedValueOnce({ Parts: undefined });

      const result = await service.listParts(
        "upload-id-abc123",
        "content/abc/media/video.mp4",
      );

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toEqual([]);
      }
    });

    it("returns err when S3 throws", async () => {
      mockSend.mockRejectedValueOnce(new Error("List parts failed"));

      const result = await service.listParts(
        "upload-id-abc123",
        "content/abc/media/video.mp4",
      );

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("S3_MULTIPART_ERROR");
        expect(result.error.statusCode).toBe(502);
      }
    });
  });
});
