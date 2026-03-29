import { describe, it, expect, vi, afterEach } from "vitest";

// ── Mock pg-boss ──

const mockCreateQueue = vi.fn().mockResolvedValue(undefined);
const mockWork = vi.fn().mockResolvedValue(undefined);

const mockBoss = {
  createQueue: mockCreateQueue,
  work: mockWork,
};

// ── Setup ──

const setupRegisterWorkers = async () => {
  vi.doMock("../../src/config.js", () => ({
    config: {
      MEDIA_FFMPEG_CONCURRENCY: 2,
    },
  }));

  vi.doMock("../../src/logging/logger.js", () => ({
    rootLogger: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    },
  }));

  vi.doMock("../../src/jobs/handlers/probe-codec.js", () => ({
    handleProbeCodec: vi.fn(),
  }));

  vi.doMock("../../src/jobs/handlers/transcode.js", () => ({
    handleTranscode: vi.fn(),
  }));

  vi.doMock("../../src/jobs/handlers/extract-thumbnail.js", () => ({
    handleExtractThumbnail: vi.fn(),
  }));

  vi.doMock("../../src/jobs/handlers/playout-ingest.js", () => ({
    handlePlayoutIngest: vi.fn(),
  }));

  return await import("../../src/jobs/register-workers.js");
};

// ── Tests ──

describe("register-workers", () => {
  afterEach(() => {
    vi.resetModules();
    vi.resetAllMocks();
  });

  describe("JOB_QUEUES", () => {
    it("exports the expected queue name constants", async () => {
      const { JOB_QUEUES } = await setupRegisterWorkers();

      expect(JOB_QUEUES.PROBE_CODEC).toBe("media/probe-codec");
      expect(JOB_QUEUES.TRANSCODE).toBe("media/transcode");
      expect(JOB_QUEUES.EXTRACT_THUMBNAIL).toBe("media/extract-thumbnail");
      expect(JOB_QUEUES.VOD_REMUX).toBe("media/vod-remux");
      expect(JOB_QUEUES.PLAYOUT_INGEST).toBe("playout/ingest");
    });
  });

  describe("registerWorkers", () => {
    it("creates all required queues", async () => {
      const { registerWorkers, JOB_QUEUES } = await setupRegisterWorkers();

      await registerWorkers(mockBoss as never);

      const createdQueues = mockCreateQueue.mock.calls.map(
        (call: unknown[]) => call[0],
      );
      expect(createdQueues).toContain(JOB_QUEUES.PROBE_CODEC);
      expect(createdQueues).toContain(JOB_QUEUES.TRANSCODE);
      expect(createdQueues).toContain(JOB_QUEUES.EXTRACT_THUMBNAIL);
      expect(createdQueues).toContain(JOB_QUEUES.PLAYOUT_INGEST);
    });

    it("registers workers for PROBE_CODEC, TRANSCODE, EXTRACT_THUMBNAIL, and PLAYOUT_INGEST", async () => {
      const { registerWorkers, JOB_QUEUES } = await setupRegisterWorkers();

      await registerWorkers(mockBoss as never);

      const registeredQueues = mockWork.mock.calls.map(
        (call: unknown[]) => call[0],
      );
      expect(registeredQueues).toContain(JOB_QUEUES.PROBE_CODEC);
      expect(registeredQueues).toContain(JOB_QUEUES.TRANSCODE);
      expect(registeredQueues).toContain(JOB_QUEUES.EXTRACT_THUMBNAIL);
      expect(registeredQueues).toContain(JOB_QUEUES.PLAYOUT_INGEST);
    });

    it("sets localConcurrency from config for media queues", async () => {
      const { registerWorkers, JOB_QUEUES } = await setupRegisterWorkers();

      await registerWorkers(mockBoss as never);

      const probeCall = mockWork.mock.calls.find(
        (call: unknown[]) => call[0] === JOB_QUEUES.PROBE_CODEC,
      );
      expect(probeCall).toBeDefined();
      expect((probeCall as unknown[])[1]).toEqual({ localConcurrency: 2 });
    });

    it("sets localConcurrency to 1 for PLAYOUT_INGEST queue", async () => {
      const { registerWorkers, JOB_QUEUES } = await setupRegisterWorkers();

      await registerWorkers(mockBoss as never);

      const playoutCall = mockWork.mock.calls.find(
        (call: unknown[]) => call[0] === JOB_QUEUES.PLAYOUT_INGEST,
      );
      expect(playoutCall).toBeDefined();
      expect((playoutCall as unknown[])[1]).toEqual({ localConcurrency: 1 });
    });
  });
});
