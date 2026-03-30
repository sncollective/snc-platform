import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ── Fixtures ──

const makeItemRow = (overrides: Record<string, unknown> = {}) => ({
  id: "item-1",
  title: "Test Film",
  s3KeyPrefix: "playout/item-1",
  sourceKey: "playout/item-1/source.mp4",
  sourceWidth: null,
  sourceHeight: null,
  duration: null,
  processingStatus: "uploading",
  ...overrides,
});

const makeProbeResult = (overrides: Record<string, unknown> = {}) => ({
  videoCodec: "h264",
  audioCodec: "aac",
  subtitleCodec: null,
  width: 1920,
  height: 1080,
  duration: 90.0,
  bitrate: 5000000,
  dataStreamCount: 0,
  ...overrides,
});

const makeJob = (data: Record<string, unknown> = {}) => ({
  id: "pg-boss-job-1",
  name: "playout/ingest",
  data: { playoutItemId: "item-1", ...data },
});

// ── Mock State ──

const mockDbSelect = vi.fn();
const mockDbUpdate = vi.fn();
const mockProbeMedia = vi.fn().mockResolvedValue({ ok: true, value: makeProbeResult() });
const mockRemuxPlayoutSource = vi.fn().mockResolvedValue({ ok: true, value: undefined });
const mockDownloadToTemp = vi.fn().mockResolvedValue({ ok: true, value: "/tmp/snc-media/uuid-playout-source.mp4" });
const mockUploadFromTemp = vi.fn().mockResolvedValue({ ok: true, value: undefined });
const mockCleanupTemp = vi.fn().mockResolvedValue(undefined);
const mockRegeneratePlaylist = vi.fn().mockResolvedValue(undefined);

// ── DB Chain Helpers ──

const buildSelectWhereChain = (rows: unknown[]) => ({
  from: vi.fn().mockReturnValue({
    where: vi.fn().mockResolvedValue(rows),
  }),
});

const buildUpdateSetWhereChain = () => ({
  set: vi.fn().mockReturnValue({
    where: vi.fn().mockResolvedValue(undefined),
  }),
});

// ── Setup Factory ──

const setupModule = async () => {
  vi.doMock("../../../src/db/connection.js", () => ({
    db: {
      select: mockDbSelect,
      update: mockDbUpdate,
    },
    sql: vi.fn(),
  }));
  vi.doMock("../../../src/db/schema/playout.schema.js", () => ({
    playoutItems: {
      id: "id",
      sourceKey: "source_key",
      processingStatus: "processing_status",
      updatedAt: "updated_at",
      s3KeyPrefix: "s3_key_prefix",
      sourceWidth: "source_width",
      sourceHeight: "source_height",
      duration: "duration",
      subtitleKey: "subtitle_key",
      $inferSelect: {},
    },
  }));
  vi.doMock("../../../src/services/media-processing.js", () => ({
    probeMedia: mockProbeMedia,
    remuxPlayoutSource: mockRemuxPlayoutSource,
  }));
  vi.doMock("../../../src/services/processing-jobs.js", () => ({
    downloadToTemp: mockDownloadToTemp,
    uploadFromTemp: mockUploadFromTemp,
    cleanupTemp: mockCleanupTemp,
  }));
  vi.doMock("../../../src/services/playout.js", () => ({
    regeneratePlaylist: mockRegeneratePlaylist,
  }));
  vi.doMock("../../../src/jobs/register-workers.js", () => ({
    JOB_QUEUES: {
      PLAYOUT_INGEST: "playout/ingest",
    },
  }));
  vi.doMock("../../../src/logging/logger.js", () => ({
    rootLogger: {
      child: vi.fn().mockReturnValue({
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn(),
      }),
      error: vi.fn(),
    },
  }));

  const { handlePlayoutIngest } = await import("../../../src/jobs/handlers/playout-ingest.js");
  return { handlePlayoutIngest };
};

// Restore defaults before each test (vitest's mockReset:true runs after afterEach,
// so defaults must be set in beforeEach to survive into the test body).
beforeEach(() => {
  mockProbeMedia.mockResolvedValue({ ok: true, value: makeProbeResult() });
  mockRemuxPlayoutSource.mockResolvedValue({ ok: true, value: undefined });
  mockDownloadToTemp.mockResolvedValue({ ok: true, value: "/tmp/snc-media/uuid-playout-source.mp4" });
  mockUploadFromTemp.mockResolvedValue({ ok: true, value: undefined });
  mockCleanupTemp.mockResolvedValue(undefined);
  mockRegeneratePlaylist.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.resetModules();
});

// ── Tests ──

describe("handlePlayoutIngest", () => {
  it("skips when item not found", async () => {
    const { handlePlayoutIngest } = await setupModule();
    mockDbSelect.mockReturnValue(buildSelectWhereChain([]));

    await handlePlayoutIngest([makeJob() as never]);

    expect(mockDownloadToTemp).not.toHaveBeenCalled();
  });

  it("skips when sourceKey is null", async () => {
    const { handlePlayoutIngest } = await setupModule();
    mockDbSelect.mockReturnValue(buildSelectWhereChain([makeItemRow({ sourceKey: null })]));

    await handlePlayoutIngest([makeJob() as never]);

    expect(mockDownloadToTemp).not.toHaveBeenCalled();
  });

  it("downloads source exactly once", async () => {
    const { handlePlayoutIngest } = await setupModule();
    mockDbSelect.mockReturnValue(buildSelectWhereChain([makeItemRow()]));
    mockDbUpdate.mockReturnValue(buildUpdateSetWhereChain());

    await handlePlayoutIngest([makeJob() as never]);

    expect(mockDownloadToTemp).toHaveBeenCalledTimes(1);
    expect(mockDownloadToTemp).toHaveBeenCalledWith(
      "playout/item-1/source.mp4",
      "playout-source.mp4",
    );
  });

  it("marks item failed when download fails", async () => {
    const { handlePlayoutIngest } = await setupModule();
    mockDbSelect.mockReturnValue(buildSelectWhereChain([makeItemRow()]));
    mockDbUpdate.mockReturnValue(buildUpdateSetWhereChain());
    mockDownloadToTemp.mockResolvedValue({ ok: false, error: { message: "download error" } });

    await handlePlayoutIngest([makeJob() as never]);

    expect(mockDbUpdate).toHaveBeenCalledTimes(2); // set processing + set failed
  });

  it("remuxes and re-uploads before probing", async () => {
    const { handlePlayoutIngest } = await setupModule();
    mockDbSelect.mockReturnValue(buildSelectWhereChain([makeItemRow()]));
    mockDbUpdate.mockReturnValue(buildUpdateSetWhereChain());

    await handlePlayoutIngest([makeJob() as never]);

    expect(mockRemuxPlayoutSource).toHaveBeenCalledWith(
      "/tmp/snc-media/uuid-playout-source.mp4",
      "/tmp/snc-media/uuid-playout-source-remuxed.mp4",
    );
    expect(mockUploadFromTemp).toHaveBeenCalledWith(
      "/tmp/snc-media/uuid-playout-source-remuxed.mp4",
      "playout/item-1/source.mp4",
      "video/mp4",
    );
    expect(mockProbeMedia).toHaveBeenCalledWith("/tmp/snc-media/uuid-playout-source-remuxed.mp4");
  });

  it("marks item failed when remux fails", async () => {
    const { handlePlayoutIngest } = await setupModule();
    mockDbSelect.mockReturnValue(buildSelectWhereChain([makeItemRow()]));
    mockDbUpdate.mockReturnValue(buildUpdateSetWhereChain());
    mockRemuxPlayoutSource.mockResolvedValue({ ok: false, error: { message: "remux error" } });

    await handlePlayoutIngest([makeJob() as never]);

    expect(mockUploadFromTemp).not.toHaveBeenCalled();
    expect(mockProbeMedia).not.toHaveBeenCalled();
    expect(mockRegeneratePlaylist).not.toHaveBeenCalled();
  });

  it("marks item failed when probe fails", async () => {
    const { handlePlayoutIngest } = await setupModule();
    mockDbSelect.mockReturnValue(buildSelectWhereChain([makeItemRow()]));
    mockDbUpdate.mockReturnValue(buildUpdateSetWhereChain());
    mockProbeMedia.mockResolvedValue({ ok: false, error: { message: "probe error" } });

    await handlePlayoutIngest([makeJob() as never]);

    // Last update should be failed status
    expect(mockRegeneratePlaylist).not.toHaveBeenCalled();
  });

  it("marks item ready and regenerates playlist after probe", async () => {
    const { handlePlayoutIngest } = await setupModule();
    mockDbSelect.mockReturnValue(buildSelectWhereChain([makeItemRow()]));
    mockDbUpdate.mockReturnValue(buildUpdateSetWhereChain());

    await handlePlayoutIngest([makeJob() as never]);

    expect(mockRegeneratePlaylist).toHaveBeenCalledTimes(1);
  });

  it("cleans up both temp files even when processing fails", async () => {
    const { handlePlayoutIngest } = await setupModule();
    mockDbSelect.mockReturnValue(buildSelectWhereChain([makeItemRow()]));
    mockDbUpdate.mockReturnValue(buildUpdateSetWhereChain());
    mockProbeMedia.mockResolvedValue({ ok: false, error: { message: "probe error" } });

    await handlePlayoutIngest([makeJob() as never]);

    expect(mockCleanupTemp).toHaveBeenCalledWith("/tmp/snc-media/uuid-playout-source.mp4");
    expect(mockCleanupTemp).toHaveBeenCalledWith("/tmp/snc-media/uuid-playout-source-remuxed.mp4");
  });
});
