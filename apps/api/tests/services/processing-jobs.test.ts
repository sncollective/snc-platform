import { describe, it, expect, vi, afterEach } from "vitest";

import { AppError } from "@snc/shared";

// AppError is used to construct mock return values for storage mocks

// ── @aws-sdk/lib-storage mock (static vi.mock for external package) ──
// Upload is mocked module-wide so vi.doMock picks it up via module reset.

vi.mock("@aws-sdk/lib-storage", () => ({
  Upload: vi.fn(),
}));

// ── Mock factories ──

const mockMkdir = vi.fn();
const mockUnlink = vi.fn();
const mockStat = vi.fn();
const mockCreateWriteStream = vi.fn();
const mockCreateReadStream = vi.fn();
const mockPipeline = vi.fn();
const mockDownload = vi.fn();
const mockUpload = vi.fn();

// ── Setup ──

const setupProcessingJobs = async () => {
  vi.doMock("node:fs/promises", () => ({
    mkdir: mockMkdir,
    unlink: mockUnlink,
    stat: mockStat,
  }));

  vi.doMock("node:fs", () => ({
    createWriteStream: mockCreateWriteStream,
    createReadStream: mockCreateReadStream,
  }));

  vi.doMock("node:stream/promises", () => ({
    pipeline: mockPipeline,
  }));

  vi.doMock("../../src/config.js", () => ({
    config: {
      MEDIA_TEMP_DIR: "/tmp/snc-media",
    },
  }));

  vi.doMock("../../src/storage/index.js", () => ({
    storage: {
      download: mockDownload,
      upload: mockUpload,
    },
    s3Client: null,
    s3Bucket: null,
  }));

  vi.doMock("../../src/db/connection.js", () => ({ db: {} }));
  vi.doMock("../../src/db/schema/processing.schema.js", () => ({
    processingJobs: {},
  }));
  vi.doMock("../../src/db/schema/content.schema.js", () => ({
    content: {},
  }));
  vi.doMock("../../src/logging/logger.js", () => ({
    rootLogger: {
      error: vi.fn(),
      warn: vi.fn(),
      info: vi.fn(),
    },
  }));

  return await import("../../src/services/processing-jobs.js");
};

const setupProcessingJobsWithS3 = async () => {
  vi.doMock("node:fs/promises", () => ({
    mkdir: mockMkdir,
    unlink: mockUnlink,
    stat: mockStat,
  }));

  vi.doMock("node:fs", () => ({
    createWriteStream: mockCreateWriteStream,
    createReadStream: mockCreateReadStream,
  }));

  vi.doMock("node:stream/promises", () => ({
    pipeline: mockPipeline,
  }));

  vi.doMock("../../src/config.js", () => ({
    config: {
      MEDIA_TEMP_DIR: "/tmp/snc-media",
    },
  }));

  vi.doMock("../../src/storage/index.js", () => ({
    storage: {
      download: mockDownload,
      upload: mockUpload,
    },
    s3Client: { send: vi.fn() }, // non-null S3Client
    s3Bucket: "test-bucket",
  }));

  vi.doMock("../../src/db/connection.js", () => ({ db: {} }));
  vi.doMock("../../src/db/schema/processing.schema.js", () => ({
    processingJobs: {},
  }));
  vi.doMock("../../src/db/schema/content.schema.js", () => ({
    content: {},
  }));
  vi.doMock("../../src/logging/logger.js", () => ({
    rootLogger: {
      error: vi.fn(),
      warn: vi.fn(),
      info: vi.fn(),
    },
  }));

  return await import("../../src/services/processing-jobs.js");
};

// ── Tests ──

describe("processing-jobs", () => {
  afterEach(() => {
    vi.resetModules();
    vi.resetAllMocks();
  });

  // ── downloadToTemp ──

  describe("downloadToTemp", () => {
    it("returns ok with temp file path on success", async () => {
      const mockStream = { getReader: vi.fn() };
      mockMkdir.mockResolvedValue(undefined);
      mockDownload.mockResolvedValue({
        ok: true,
        value: { stream: mockStream },
      });
      mockCreateWriteStream.mockReturnValue({ on: vi.fn(), write: vi.fn() });
      mockPipeline.mockResolvedValue(undefined);

      // Mock Readable.fromWeb to return a fake readable
      vi.doMock("node:stream", () => ({
        Readable: {
          fromWeb: vi.fn().mockReturnValue({ pipe: vi.fn() }),
          toWeb: vi.fn(),
        },
      }));

      const { downloadToTemp } = await setupProcessingJobs();
      const result = await downloadToTemp("storage/key.mp4", "input.mp4");

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toContain("/tmp/snc-media/");
        expect(result.value).toContain("-input.mp4");
      }
      expect(mockMkdir).toHaveBeenCalledWith("/tmp/snc-media", {
        recursive: true,
      });
      expect(mockDownload).toHaveBeenCalledWith("storage/key.mp4");
    });

    it("returns err when storage download fails", async () => {
      mockMkdir.mockResolvedValue(undefined);
      mockDownload.mockResolvedValue({
        ok: false,
        error: new AppError("STORAGE_ERROR", "Download failed", 500),
      });

      const { downloadToTemp } = await setupProcessingJobs();
      const result = await downloadToTemp("storage/key.mp4", "input.mp4");

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBeInstanceOf(AppError);
        expect(result.error.code).toBe("STORAGE_ERROR");
      }
    });

    it("returns err with PROCESSING_ERROR when an exception is thrown", async () => {
      mockMkdir.mockRejectedValue(new Error("EACCES: permission denied"));

      const { downloadToTemp } = await setupProcessingJobs();
      const result = await downloadToTemp("storage/key.mp4", "input.mp4");

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("PROCESSING_ERROR");
        expect(result.error.statusCode).toBe(500);
      }
    });
  });

  // ── uploadFromTemp ──

  describe("uploadFromTemp", () => {
    it("returns ok on successful upload", async () => {
      mockStat.mockResolvedValue({ size: 1024 });
      mockCreateReadStream.mockReturnValue({ pipe: vi.fn() });
      mockUpload.mockResolvedValue({ ok: true, value: undefined });

      vi.doMock("node:stream", () => ({
        Readable: {
          fromWeb: vi.fn(),
          toWeb: vi.fn().mockReturnValue({}),
        },
      }));

      const { uploadFromTemp } = await setupProcessingJobs();
      const result = await uploadFromTemp(
        "/tmp/snc-media/file.mp4",
        "output/key.mp4",
        "video/mp4",
      );

      expect(result.ok).toBe(true);
      expect(mockUpload).toHaveBeenCalledWith(
        "output/key.mp4",
        expect.anything(),
        { contentType: "video/mp4", contentLength: 1024 },
      );
    });

    it("returns err when storage upload fails", async () => {
      mockStat.mockResolvedValue({ size: 512 });
      mockCreateReadStream.mockReturnValue({ pipe: vi.fn() });
      mockUpload.mockResolvedValue({
        ok: false,
        error: new AppError("STORAGE_ERROR", "Upload failed", 500),
      });

      vi.doMock("node:stream", () => ({
        Readable: {
          fromWeb: vi.fn(),
          toWeb: vi.fn().mockReturnValue({}),
        },
      }));

      const { uploadFromTemp } = await setupProcessingJobs();
      const result = await uploadFromTemp(
        "/tmp/snc-media/file.mp4",
        "output/key.mp4",
        "video/mp4",
      );

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("STORAGE_ERROR");
      }
    });

    it("returns err with PROCESSING_ERROR when stat throws", async () => {
      mockStat.mockRejectedValue(new Error("ENOENT: no such file"));

      const { uploadFromTemp } = await setupProcessingJobs();
      const result = await uploadFromTemp(
        "/tmp/nonexistent.mp4",
        "output/key.mp4",
        "video/mp4",
      );

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("PROCESSING_ERROR");
        expect(result.error.statusCode).toBe(500);
      }
    });
  });

  // ── cleanupTemp ──

  describe("cleanupTemp", () => {
    it("resolves without error when unlink succeeds", async () => {
      mockUnlink.mockResolvedValue(undefined);

      const { cleanupTemp } = await setupProcessingJobs();
      await expect(
        cleanupTemp("/tmp/snc-media/file.mp4"),
      ).resolves.toBeUndefined();

      expect(mockUnlink).toHaveBeenCalledWith("/tmp/snc-media/file.mp4");
    });

    it("resolves without throwing when unlink fails (best-effort)", async () => {
      mockUnlink.mockRejectedValue(new Error("ENOENT: file not found"));

      const { cleanupTemp } = await setupProcessingJobs();
      // Should not throw — cleanupTemp is best-effort
      await expect(
        cleanupTemp("/tmp/snc-media/missing.mp4"),
      ).resolves.toBeUndefined();
    });
  });

  // ── uploadFromTemp with streaming multipart ──

  describe("uploadFromTemp with streaming multipart", () => {
    it("uses Upload for large files on S3 (≥100MB)", async () => {
      const mockUploadDone = vi.fn().mockResolvedValue(undefined);

      mockStat.mockResolvedValue({ size: 100 * 1024 * 1024 }); // exactly 100MB
      mockCreateReadStream.mockReturnValue({ pipe: vi.fn() });

      // Import processing-jobs first so @aws-sdk/lib-storage is loaded into the module cache
      const { uploadFromTemp } = await setupProcessingJobsWithS3();

      // Configure the Upload constructor mock on the now-cached instance.
      // Must use a regular function (not arrow) for constructor mocking.
      const { Upload } = await import("@aws-sdk/lib-storage");
      vi.mocked(Upload).mockImplementation(function () {
        return { done: mockUploadDone } as never;
      });

      const result = await uploadFromTemp(
        "/tmp/snc-media/large.mp4",
        "output/large.mp4",
        "video/mp4",
      );

      expect(result.ok).toBe(true);
      expect(mockUploadDone).toHaveBeenCalledTimes(1);
      // storage.upload should NOT have been called
      expect(mockUpload).not.toHaveBeenCalled();
    });

    it("uses storage.upload for small files on S3 (<100MB)", async () => {
      mockStat.mockResolvedValue({ size: 100 * 1024 * 1024 - 1 }); // 1 byte under threshold
      mockCreateReadStream.mockReturnValue({ pipe: vi.fn() });
      mockUpload.mockResolvedValue({ ok: true, value: undefined });

      vi.doMock("node:stream", () => ({
        Readable: {
          fromWeb: vi.fn(),
          toWeb: vi.fn().mockReturnValue({}),
        },
      }));

      const { uploadFromTemp } = await setupProcessingJobsWithS3();

      const { Upload } = await import("@aws-sdk/lib-storage");
      const result = await uploadFromTemp(
        "/tmp/snc-media/small.mp4",
        "output/small.mp4",
        "video/mp4",
      );

      expect(result.ok).toBe(true);
      expect(vi.mocked(Upload)).not.toHaveBeenCalled();
      expect(mockUpload).toHaveBeenCalledWith(
        "output/small.mp4",
        expect.anything(),
        { contentType: "video/mp4", contentLength: 100 * 1024 * 1024 - 1 },
      );
    });

    it("returns err when Upload.done() throws", async () => {
      const mockUploadDone = vi.fn().mockRejectedValue(new Error("S3 multipart failed"));

      mockStat.mockResolvedValue({ size: 200 * 1024 * 1024 }); // 200MB
      mockCreateReadStream.mockReturnValue({ pipe: vi.fn() });

      // Import processing-jobs first so @aws-sdk/lib-storage is in the module cache
      const { uploadFromTemp } = await setupProcessingJobsWithS3();

      // Configure the Upload constructor mock on the now-cached instance.
      // Must use a regular function (not arrow) for constructor mocking.
      const { Upload } = await import("@aws-sdk/lib-storage");
      vi.mocked(Upload).mockImplementation(function () {
        return { done: mockUploadDone } as never;
      });

      const result = await uploadFromTemp(
        "/tmp/snc-media/large.mp4",
        "output/large.mp4",
        "video/mp4",
      );

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("PROCESSING_ERROR");
        expect(result.error.statusCode).toBe(500);
      }
    });
  });
});
