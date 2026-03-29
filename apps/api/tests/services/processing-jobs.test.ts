import { describe, it, expect, vi, afterEach } from "vitest";

import { AppError } from "@snc/shared";

// AppError is used to construct mock return values for storage mocks

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
});
