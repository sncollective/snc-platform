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
  type: "probe",
  status: "queued",
  ...overrides,
});

const makeProbeResult = (overrides: Record<string, unknown> = {}) => ({
  videoCodec: "h264",
  audioCodec: "aac",
  width: 1920,
  height: 1080,
  duration: 120.5,
  bitrate: 5000000,
  dataStreamCount: 0,
  ...overrides,
});

const makeJob = (data: Record<string, unknown> = {}) => ({
  id: "pg-boss-job-1",
  name: "media:probe-codec",
  data: { contentId: "content-1", ...data },
});

const setupModule = async () => {
  const mockGetContentForJob = vi.fn().mockResolvedValue(makeContentRow());
  const mockCreateJob = vi.fn().mockResolvedValue(makeJobRecord());
  const mockUpdateJob = vi.fn().mockResolvedValue(undefined);
  const mockUpdateContentProcessing = vi.fn().mockResolvedValue(undefined);
  const mockDownloadToTemp = vi.fn().mockResolvedValue({ ok: true, value: "/tmp/snc-media/uuid-probe.mov" });
  const mockCleanupTemp = vi.fn().mockResolvedValue(undefined);

  const mockProbeMedia = vi.fn().mockResolvedValue({ ok: true, value: makeProbeResult() });

  const mockBossSend = vi.fn().mockResolvedValue("new-job-id");
  const mockBoss = { send: mockBossSend };

  vi.doMock("../../../src/services/processing-jobs.js", () => ({
    getContentForJob: mockGetContentForJob,
    createJob: mockCreateJob,
    updateJob: mockUpdateJob,
    updateContentProcessing: mockUpdateContentProcessing,
    downloadToTemp: mockDownloadToTemp,
    cleanupTemp: mockCleanupTemp,
  }));

  vi.doMock("../../../src/services/media-processing.js", () => ({
    probeMedia: mockProbeMedia,
  }));

  vi.doMock("../../../src/jobs/register-workers.js", () => ({
    JOB_QUEUES: {
      PROBE_CODEC: "media:probe-codec",
      TRANSCODE: "media:transcode",
      EXTRACT_THUMBNAIL: "media:extract-thumbnail",
      VOD_REMUX: "media:vod-remux",
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

  vi.doMock("@snc/shared", async (importOriginal) => {
    const actual = await importOriginal<typeof import("@snc/shared")>();
    return {
      ...actual,
    };
  });

  const { handleProbeCodec } = await import("../../../src/jobs/handlers/probe-codec.js");

  return {
    handleProbeCodec,
    mockBoss,
    mockGetContentForJob,
    mockCreateJob,
    mockUpdateJob,
    mockUpdateContentProcessing,
    mockDownloadToTemp,
    mockCleanupTemp,
    mockProbeMedia,
    mockBossSend,
  };
};

afterEach(() => {
  vi.resetModules();
  vi.resetAllMocks();
});

// ── Tests ──

describe("handleProbeCodec", () => {
  it("probes media and stores metadata on content", async () => {
    const { handleProbeCodec, mockBoss, mockUpdateContentProcessing } = await setupModule();

    await handleProbeCodec([makeJob() as never], mockBoss as never);

    expect(mockUpdateContentProcessing).toHaveBeenCalledWith(
      "content-1",
      expect.objectContaining({
        videoCodec: "h264",
        audioCodec: "aac",
        width: 1920,
        height: 1080,
        duration: 120.5,
        bitrate: 5000000,
      }),
    );
  });

  it("marks content ready when codec is H.264-compatible", async () => {
    const { handleProbeCodec, mockBoss, mockUpdateContentProcessing } = await setupModule();

    await handleProbeCodec([makeJob() as never], mockBoss as never);

    expect(mockUpdateContentProcessing).toHaveBeenCalledWith(
      "content-1",
      expect.objectContaining({ processingStatus: "ready" }),
    );
  });

  it("queues transcode job when codec requires transcoding (HEVC)", async () => {
    const { handleProbeCodec, mockBoss, mockProbeMedia, mockBossSend } = await setupModule();
    mockProbeMedia.mockResolvedValue({ ok: true, value: makeProbeResult({ videoCodec: "hevc" }) });

    await handleProbeCodec([makeJob() as never], mockBoss as never);

    expect(mockBossSend).toHaveBeenCalledWith("media:transcode", { contentId: "content-1" });
  });

  it("does NOT queue transcode for H.264 video", async () => {
    const { handleProbeCodec, mockBoss, mockBossSend } = await setupModule();

    await handleProbeCodec([makeJob() as never], mockBoss as never);

    expect(mockBossSend).not.toHaveBeenCalledWith("media:transcode", expect.anything());
  });

  it("queues thumbnail when no custom thumbnail exists", async () => {
    const { handleProbeCodec, mockBoss, mockBossSend } = await setupModule();

    await handleProbeCodec([makeJob() as never], mockBoss as never);

    expect(mockBossSend).toHaveBeenCalledWith("media:extract-thumbnail", { contentId: "content-1" });
  });

  it("skips thumbnail when custom thumbnail already exists", async () => {
    const { handleProbeCodec, mockBoss, mockGetContentForJob, mockBossSend } = await setupModule();
    mockGetContentForJob.mockResolvedValue(makeContentRow({ thumbnailKey: "content/content-1/media/thumb.jpg" }));

    await handleProbeCodec([makeJob() as never], mockBoss as never);

    expect(mockBossSend).not.toHaveBeenCalledWith("media:extract-thumbnail", expect.anything());
  });

  it("skips when content or mediaKey not found", async () => {
    const { handleProbeCodec, mockBoss, mockGetContentForJob, mockCreateJob } = await setupModule();
    mockGetContentForJob.mockResolvedValue(null);

    await handleProbeCodec([makeJob() as never], mockBoss as never);

    expect(mockCreateJob).not.toHaveBeenCalled();
  });

  it("marks job and content as failed when download fails", async () => {
    const { handleProbeCodec, mockBoss, mockDownloadToTemp, mockUpdateJob, mockUpdateContentProcessing } =
      await setupModule();
    mockDownloadToTemp.mockResolvedValue({
      ok: false,
      error: { message: "Download error" },
    });

    await handleProbeCodec([makeJob() as never], mockBoss as never);

    expect(mockUpdateJob).toHaveBeenCalledWith(
      "job-record-1",
      expect.objectContaining({ status: "failed", error: "Download error" }),
    );
    expect(mockUpdateContentProcessing).toHaveBeenCalledWith(
      "content-1",
      expect.objectContaining({ processingStatus: "failed" }),
    );
  });

  it("marks job and content as failed when probe fails", async () => {
    const { handleProbeCodec, mockBoss, mockProbeMedia, mockUpdateJob, mockUpdateContentProcessing } =
      await setupModule();
    mockProbeMedia.mockResolvedValue({ ok: false, error: { message: "ffprobe error" } });

    await handleProbeCodec([makeJob() as never], mockBoss as never);

    expect(mockUpdateJob).toHaveBeenCalledWith(
      "job-record-1",
      expect.objectContaining({ status: "failed", error: "ffprobe error" }),
    );
    expect(mockUpdateContentProcessing).toHaveBeenCalledWith(
      "content-1",
      expect.objectContaining({ processingStatus: "failed" }),
    );
  });

  it("cleans up temp file on success", async () => {
    const { handleProbeCodec, mockBoss, mockCleanupTemp } = await setupModule();

    await handleProbeCodec([makeJob() as never], mockBoss as never);

    expect(mockCleanupTemp).toHaveBeenCalledWith("/tmp/snc-media/uuid-probe.mov");
  });

  it("cleans up temp file even when probe fails", async () => {
    const { handleProbeCodec, mockBoss, mockProbeMedia, mockCleanupTemp } = await setupModule();
    mockProbeMedia.mockResolvedValue({ ok: false, error: { message: "ffprobe error" } });

    await handleProbeCodec([makeJob() as never], mockBoss as never);

    expect(mockCleanupTemp).toHaveBeenCalledWith("/tmp/snc-media/uuid-probe.mov");
  });
});
