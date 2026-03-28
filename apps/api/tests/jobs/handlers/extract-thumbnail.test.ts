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
  type: "thumbnail",
  status: "queued",
  ...overrides,
});

const makeJob = (data: Record<string, unknown> = {}) => ({
  id: "pg-boss-job-1",
  name: "media:extract-thumbnail",
  data: { contentId: "content-1", ...data },
});

const setupModule = async () => {
  const mockGetContentForJob = vi.fn().mockResolvedValue(makeContentRow());
  const mockCreateJob = vi.fn().mockResolvedValue(makeJobRecord());
  const mockUpdateJob = vi.fn().mockResolvedValue(undefined);
  const mockUpdateContentProcessing = vi.fn().mockResolvedValue(undefined);
  const mockDownloadToTemp = vi
    .fn()
    .mockResolvedValue({ ok: true, value: "/tmp/snc-media/uuid-thumb-in.mov" });
  const mockUploadFromTemp = vi.fn().mockResolvedValue({ ok: true, value: undefined });
  const mockCleanupTemp = vi.fn().mockResolvedValue(undefined);

  const mockExtractThumbnail = vi.fn().mockResolvedValue({ ok: true, value: undefined });

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
    extractThumbnail: mockExtractThumbnail,
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

  const { handleExtractThumbnail } = await import(
    "../../../src/jobs/handlers/extract-thumbnail.js"
  );

  return {
    handleExtractThumbnail,
    mockGetContentForJob,
    mockCreateJob,
    mockUpdateJob,
    mockUpdateContentProcessing,
    mockDownloadToTemp,
    mockUploadFromTemp,
    mockCleanupTemp,
    mockExtractThumbnail,
  };
};

afterEach(() => {
  vi.resetModules();
  vi.resetAllMocks();
});

// ── Tests ──

describe("handleExtractThumbnail", () => {
  it("extracts and uploads thumbnail with derived storage key", async () => {
    const { handleExtractThumbnail, mockUploadFromTemp } = await setupModule();

    await handleExtractThumbnail([makeJob() as never]);

    expect(mockUploadFromTemp).toHaveBeenCalledWith(
      expect.stringContaining("thumbnail.jpg"),
      "content/content-1/media/video-thumb.jpg",
      "image/jpeg",
    );
  });

  it("sets thumbnailKey on content row", async () => {
    const { handleExtractThumbnail, mockUpdateContentProcessing } = await setupModule();

    await handleExtractThumbnail([makeJob() as never]);

    expect(mockUpdateContentProcessing).toHaveBeenCalledWith(
      "content-1",
      expect.objectContaining({ thumbnailKey: "content/content-1/media/video-thumb.jpg" }),
    );
  });

  it("skips when custom thumbnail already exists", async () => {
    const { handleExtractThumbnail, mockGetContentForJob, mockCreateJob, mockDownloadToTemp } =
      await setupModule();
    mockGetContentForJob.mockResolvedValue(
      makeContentRow({ thumbnailKey: "content/content-1/media/custom-thumb.jpg" }),
    );

    await handleExtractThumbnail([makeJob() as never]);

    expect(mockCreateJob).not.toHaveBeenCalled();
    expect(mockDownloadToTemp).not.toHaveBeenCalled();
  });

  it("skips when content or mediaKey not found", async () => {
    const { handleExtractThumbnail, mockGetContentForJob, mockCreateJob } = await setupModule();
    mockGetContentForJob.mockResolvedValue(null);

    await handleExtractThumbnail([makeJob() as never]);

    expect(mockCreateJob).not.toHaveBeenCalled();
  });

  it("marks job as failed when thumbnail extraction fails but does NOT set processingStatus", async () => {
    const { handleExtractThumbnail, mockExtractThumbnail, mockUpdateJob, mockUpdateContentProcessing } =
      await setupModule();
    mockExtractThumbnail.mockResolvedValue({ ok: false, error: { message: "FFmpeg extract error" } });

    await handleExtractThumbnail([makeJob() as never]);

    expect(mockUpdateJob).toHaveBeenCalledWith(
      "job-record-1",
      expect.objectContaining({ status: "failed", error: "FFmpeg extract error" }),
    );
    // Thumbnail failure should NOT affect processingStatus
    expect(mockUpdateContentProcessing).not.toHaveBeenCalledWith(
      "content-1",
      expect.objectContaining({ processingStatus: expect.anything() }),
    );
  });

  it("marks job as failed when download fails but does NOT set processingStatus", async () => {
    const { handleExtractThumbnail, mockDownloadToTemp, mockUpdateJob, mockUpdateContentProcessing } =
      await setupModule();
    mockDownloadToTemp.mockResolvedValue({ ok: false, error: { message: "Download failed" } });

    await handleExtractThumbnail([makeJob() as never]);

    expect(mockUpdateJob).toHaveBeenCalledWith(
      "job-record-1",
      expect.objectContaining({ status: "failed", error: "Download failed" }),
    );
    expect(mockUpdateContentProcessing).not.toHaveBeenCalled();
  });

  it("cleans up both input and output temp files on success", async () => {
    const { handleExtractThumbnail, mockCleanupTemp } = await setupModule();

    await handleExtractThumbnail([makeJob() as never]);

    expect(mockCleanupTemp).toHaveBeenCalledTimes(2);
    expect(mockCleanupTemp).toHaveBeenCalledWith(expect.stringContaining("thumb-in"));
    expect(mockCleanupTemp).toHaveBeenCalledWith(expect.stringContaining("thumbnail.jpg"));
  });

  it("marks job completed and logs on success", async () => {
    const { handleExtractThumbnail, mockUpdateJob } = await setupModule();

    await handleExtractThumbnail([makeJob() as never]);

    expect(mockUpdateJob).toHaveBeenCalledWith(
      "job-record-1",
      expect.objectContaining({ status: "completed", progress: 100 }),
    );
  });
});
