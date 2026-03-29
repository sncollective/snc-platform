import { describe, it, expect, vi, afterEach } from "vitest";

// ── Mock DB Chains ──

const mockSelectWhere = vi.fn();
const mockSelectFrom = vi.fn();
const mockSelect = vi.fn();

const mockDb = { select: mockSelect };

// ── Setup ──

const setupContentHelpers = async (
  requireCreatorPermissionImpl: () => Promise<void> = () => Promise.resolve(),
) => {
  vi.doMock("../../src/db/connection.js", () => ({ db: mockDb }));

  vi.doMock("../../src/db/schema/content.schema.js", () => ({
    content: {
      id: {},
      deletedAt: {},
    },
  }));

  vi.doMock("../../src/services/creator-team.js", () => ({
    requireCreatorPermission: vi.fn().mockImplementation(requireCreatorPermissionImpl),
  }));

  vi.doMock("../../src/lib/response-helpers.js", () => ({
    toISO: (d: Date) => d.toISOString(),
    toISOOrNull: (d: Date | null) => d?.toISOString() ?? null,
  }));

  return await import("../../src/lib/content-helpers.js");
};

// ── Helpers ──

const makeContentRow = (overrides: Record<string, unknown> = {}) => ({
  id: "content-1",
  creatorId: "creator-1",
  slug: "my-slug",
  type: "video",
  title: "Test Video",
  body: null,
  description: "A test video",
  visibility: "public",
  sourceType: "upload",
  thumbnailKey: "thumbnails/content-1.jpg",
  mediaKey: "media/content-1.mp4",
  publishedAt: new Date("2025-01-01T00:00:00.000Z"),
  createdAt: new Date("2025-01-01T00:00:00.000Z"),
  updatedAt: new Date("2025-01-02T00:00:00.000Z"),
  deletedAt: null,
  processingStatus: "complete",
  videoCodec: "h264",
  audioCodec: "aac",
  width: 1920,
  height: 1080,
  duration: 120,
  bitrate: 4000000,
  ...overrides,
});

// ── Tests ──

describe("content-helpers", () => {
  afterEach(() => {
    vi.resetModules();
    vi.resetAllMocks();
  });

  // ── resolveContentUrls ──

  describe("resolveContentUrls", () => {
    it("maps a content row to ContentResponse with proxy URLs when keys present", async () => {
      const { resolveContentUrls } = await setupContentHelpers();
      const row = makeContentRow();
      const result = resolveContentUrls(row as Parameters<typeof resolveContentUrls>[0]);

      expect(result.id).toBe("content-1");
      expect(result.thumbnailUrl).toBe("/api/content/content-1/thumbnail");
      expect(result.mediaUrl).toBe("/api/content/content-1/media");
      expect(result.title).toBe("Test Video");
      expect(result.visibility).toBe("public");
    });

    it("returns null thumbnailUrl when thumbnailKey is null", async () => {
      const { resolveContentUrls } = await setupContentHelpers();
      const row = makeContentRow({ thumbnailKey: null });
      const result = resolveContentUrls(row as Parameters<typeof resolveContentUrls>[0]);

      expect(result.thumbnailUrl).toBeNull();
    });

    it("returns null mediaUrl when mediaKey is null", async () => {
      const { resolveContentUrls } = await setupContentHelpers();
      const row = makeContentRow({ mediaKey: null });
      const result = resolveContentUrls(row as Parameters<typeof resolveContentUrls>[0]);

      expect(result.mediaUrl).toBeNull();
    });

    it("returns null slug when slug is null", async () => {
      const { resolveContentUrls } = await setupContentHelpers();
      const row = makeContentRow({ slug: null });
      const result = resolveContentUrls(row as Parameters<typeof resolveContentUrls>[0]);

      expect(result.slug).toBeNull();
    });

    it("passes through nullable metadata fields as null", async () => {
      const { resolveContentUrls } = await setupContentHelpers();
      const row = makeContentRow({
        videoCodec: null,
        audioCodec: null,
        width: null,
        height: null,
        duration: null,
        bitrate: null,
        processingStatus: null,
      });
      const result = resolveContentUrls(row as Parameters<typeof resolveContentUrls>[0]);

      expect(result.videoCodec).toBeNull();
      expect(result.audioCodec).toBeNull();
      expect(result.width).toBeNull();
      expect(result.height).toBeNull();
      expect(result.duration).toBeNull();
      expect(result.bitrate).toBeNull();
      expect(result.processingStatus).toBeNull();
    });
  });

  // ── findActiveContent ──

  describe("findActiveContent", () => {
    it("returns the content row when found", async () => {
      const row = makeContentRow();
      mockSelect.mockReturnValue({ from: mockSelectFrom });
      mockSelectFrom.mockReturnValue({ where: mockSelectWhere });
      mockSelectWhere.mockResolvedValue([row]);

      const { findActiveContent } = await setupContentHelpers();
      const result = await findActiveContent("content-1");

      expect(result).toEqual(row);
    });

    it("returns undefined when no content is found", async () => {
      mockSelect.mockReturnValue({ from: mockSelectFrom });
      mockSelectFrom.mockReturnValue({ where: mockSelectWhere });
      mockSelectWhere.mockResolvedValue([]);

      const { findActiveContent } = await setupContentHelpers();
      const result = await findActiveContent("nonexistent");

      expect(result).toBeUndefined();
    });
  });

  // ── requireContentOwnership ──

  describe("requireContentOwnership", () => {
    it("returns the content row when content exists and permission passes", async () => {
      const row = makeContentRow();
      mockSelect.mockReturnValue({ from: mockSelectFrom });
      mockSelectFrom.mockReturnValue({ where: mockSelectWhere });
      mockSelectWhere.mockResolvedValue([row]);

      const { requireContentOwnership } = await setupContentHelpers();
      const result = await requireContentOwnership("content-1", "user-1");

      expect(result).toEqual(row);
    });

    it("throws an error with 'Content not found' message when content does not exist", async () => {
      mockSelect.mockReturnValue({ from: mockSelectFrom });
      mockSelectFrom.mockReturnValue({ where: mockSelectWhere });
      mockSelectWhere.mockResolvedValue([]);

      const { requireContentOwnership } = await setupContentHelpers();

      await expect(
        requireContentOwnership("nonexistent", "user-1"),
      ).rejects.toThrow("Content not found");
    });

    it("propagates errors from requireCreatorPermission", async () => {
      const row = makeContentRow();
      mockSelect.mockReturnValue({ from: mockSelectFrom });
      mockSelectFrom.mockReturnValue({ where: mockSelectWhere });
      mockSelectWhere.mockResolvedValue([row]);

      const { requireContentOwnership } = await setupContentHelpers(
        () => Promise.reject(new Error("Forbidden")),
      );

      await expect(
        requireContentOwnership("content-1", "user-1"),
      ).rejects.toThrow("Forbidden");
    });
  });
});
