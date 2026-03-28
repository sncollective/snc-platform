import { describe, it, expect, vi, afterEach } from "vitest";

// ── Setup Factory ──

const makeContentRow = (overrides: Record<string, unknown> = {}) => ({
  id: "content-1",
  creatorId: "creator-1",
  mediaKey: "content/content-1/media/video.mov",
  thumbnailKey: null,
  type: "video",
  ...overrides,
});

const makeJobRecord = (overrides: Record<string, unknown> = {}) => ({
  id: "job-record-1",
  contentId: "content-1",
  type: "transcode",
  status: "queued",
  ...overrides,
});

const makeJob = (data: Record<string, unknown> = {}) => ({
  id: "pg-boss-job-1",
  name: "media:transcode",
  data: { contentId: "content-1", ...data },
});

const setupModule = async () => {
  const mockGetContentForJob = vi.fn().mockResolvedValue(makeContentRow());
  const mockCreateJob = vi.fn().mockResolvedValue(makeJobRecord());
  const mockUpdateJob = vi.fn().mockResolvedValue(undefined);
  const mockUpdateContentProcessing = vi.fn().mockResolvedValue(undefined);
  const mockDownloadToTemp = vi
    .fn()
    .mockResolvedValue({ ok: true, value: "/tmp/snc-media/uuid-transcode-in.mov" });
  const mockUploadFromTemp = vi.fn().mockResolvedValue({ ok: true, value: undefined });
  const mockCleanupTemp = vi.fn().mockResolvedValue(undefined);

  const mockTranscodeToH264 = vi.fn().mockResolvedValue({ ok: true, value: undefined });

  vi.doMock("../../../src/services/processing-jobs.js", () => ({
    getContentForJob: mockGetContentForJob,
    createJob: mockCreateJob,
    updateJob: mockUpdateJob,
    updateContentProcessing: mockUpdateContentProcessing,
    downloadToTemp: mockDownloadToTemp,
    uploadFromTemp: mockUploadFromTemp,
    cleanupTemp: mockCleanupTemp,
  }));

  vi.doMock("../../../src/services/media-processing.js", () => ({
    transcodeToH264: mockTranscodeToH264,
  }));

  vi.doMock("../../../src/jobs/register-workers.js", () => ({
    JOB_QUEUES: {
      PROBE_CODEC: "media:probe-codec",
      TRANSCODE: "media:transcode",
      EXTRACT_THUMBNAIL: "media:extract-thumbnail",
      VOD_REMUX: "media:vod-remux",
    },
  }));

  vi.doMock("../../../src/config.js", () => ({
    config: {
      MEDIA_TEMP_DIR: "/tmp/snc-media",
      MEDIA_FFMPEG_CONCURRENCY: 2,
    },
  }));

  vi.doMock("../../../src/logging/logger.js", () => ({
    rootLogger: {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      child: vi.fn().mockReturnValue({
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
      }),
    },
  }));

  const { handleTranscode } = await import("../../../src/jobs/handlers/transcode.js");

  return {
    handleTranscode,
    mockGetContentForJob,
    mockCreateJob,
    mockUpdateJob,
    mockUpdateContentProcessing,
    mockDownloadToTemp,
    mockUploadFromTemp,
    mockCleanupTemp,
    mockTranscodeToH264,
  };
};

afterEach(() => {
  vi.resetModules();
  vi.resetAllMocks();
});

// ── Tests ──

describe("handleTranscode", () => {
  it("transcodes and uploads result with derived storage key", async () => {
    const { handleTranscode, mockUploadFromTemp } = await setupModule();

    await handleTranscode([makeJob() as never]);

    expect(mockUploadFromTemp).toHaveBeenCalledWith(
      expect.stringContaining("transcode-out.mp4"),
      "content/content-1/media/video-transcoded.mp4",
      "video/mp4",
    );
  });

  it("updates content with transcodedMediaKey and processingStatus ready", async () => {
    const { handleTranscode, mockUpdateContentProcessing } = await setupModule();

    await handleTranscode([makeJob() as never]);

    expect(mockUpdateContentProcessing).toHaveBeenCalledWith(
      "content-1",
      expect.objectContaining({
        transcodedMediaKey: "content/content-1/media/video-transcoded.mp4",
        processingStatus: "ready",
      }),
    );
  });

  it("calls onProgress callback during transcode", async () => {
    const { handleTranscode, mockTranscodeToH264, mockUpdateJob } = await setupModule();

    let capturedCallback: ((percent: number) => void) | undefined;
    mockTranscodeToH264.mockImplementation(
      async (_input: string, _output: string, opts: { onProgress?: (pct: number) => void }) => {
        capturedCallback = opts.onProgress;
        capturedCallback?.(50);
        return { ok: true, value: undefined };
      },
    );

    await handleTranscode([makeJob() as never]);

    expect(capturedCallback).toBeDefined();
    // updateJob is called with progress; it's fire-and-forget (void) so just verify it was called
    expect(mockUpdateJob).toHaveBeenCalledWith("job-record-1", expect.objectContaining({ progress: 50 }));
  });

  it("marks job and content as failed when download fails", async () => {
    const { handleTranscode, mockDownloadToTemp, mockUpdateJob, mockUpdateContentProcessing } =
      await setupModule();
    mockDownloadToTemp.mockResolvedValue({ ok: false, error: { message: "Download failed" } });

    await handleTranscode([makeJob() as never]);

    expect(mockUpdateJob).toHaveBeenCalledWith(
      "job-record-1",
      expect.objectContaining({ status: "failed", error: "Download failed" }),
    );
    expect(mockUpdateContentProcessing).toHaveBeenCalledWith(
      "content-1",
      expect.objectContaining({ processingStatus: "failed" }),
    );
  });

  it("marks job and content as failed when transcode fails", async () => {
    const { handleTranscode, mockTranscodeToH264, mockUpdateJob, mockUpdateContentProcessing } =
      await setupModule();
    mockTranscodeToH264.mockResolvedValue({ ok: false, error: { message: "FFmpeg error" } });

    await handleTranscode([makeJob() as never]);

    expect(mockUpdateJob).toHaveBeenCalledWith(
      "job-record-1",
      expect.objectContaining({ status: "failed", error: "FFmpeg error" }),
    );
    expect(mockUpdateContentProcessing).toHaveBeenCalledWith(
      "content-1",
      expect.objectContaining({ processingStatus: "failed" }),
    );
  });

  it("marks job and content as failed when upload fails", async () => {
    const { handleTranscode, mockUploadFromTemp, mockUpdateJob, mockUpdateContentProcessing } =
      await setupModule();
    mockUploadFromTemp.mockResolvedValue({ ok: false, error: { message: "Upload failed" } });

    await handleTranscode([makeJob() as never]);

    expect(mockUpdateJob).toHaveBeenCalledWith(
      "job-record-1",
      expect.objectContaining({ status: "failed", error: "Upload failed" }),
    );
    expect(mockUpdateContentProcessing).toHaveBeenCalledWith(
      "content-1",
      expect.objectContaining({ processingStatus: "failed" }),
    );
  });

  it("cleans up both input and output temp files on success", async () => {
    const { handleTranscode, mockCleanupTemp } = await setupModule();

    await handleTranscode([makeJob() as never]);

    expect(mockCleanupTemp).toHaveBeenCalledTimes(2);
    expect(mockCleanupTemp).toHaveBeenCalledWith(
      expect.stringContaining("transcode-in"),
    );
    expect(mockCleanupTemp).toHaveBeenCalledWith(
      expect.stringContaining("transcode-out"),
    );
  });

  it("cleans up temp files when transcode fails", async () => {
    const { handleTranscode, mockTranscodeToH264, mockCleanupTemp } = await setupModule();
    mockTranscodeToH264.mockResolvedValue({ ok: false, error: { message: "FFmpeg error" } });

    await handleTranscode([makeJob() as never]);

    // At least input file should be cleaned up; output path was set before failure
    expect(mockCleanupTemp).toHaveBeenCalledTimes(2);
  });

  it("skips when content or mediaKey not found", async () => {
    const { handleTranscode, mockGetContentForJob, mockCreateJob } = await setupModule();
    mockGetContentForJob.mockResolvedValue(null);

    await handleTranscode([makeJob() as never]);

    expect(mockCreateJob).not.toHaveBeenCalled();
  });
});
