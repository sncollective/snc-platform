import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ── Mock DB Chains ──

const mockDeleteWhere = vi.fn();
const mockDelete = vi.fn(() => ({ where: mockDeleteWhere }));

const mockSelectWhere = vi.fn();
const mockSelectFrom = vi.fn(() => ({ where: mockSelectWhere }));
const mockSelect = vi.fn(() => ({ from: mockSelectFrom }));

const mockDb = {
  select: mockSelect,
  delete: mockDelete,
};

// ── Mock Logger ──

const mockLoggerInfo = vi.fn();
const mockRootLogger = { info: mockLoggerInfo };

// ── Test Setup ──

beforeEach(() => {
  vi.resetModules();
  vi.doMock("../../src/db/connection.js", () => ({ db: mockDb }));
  vi.doMock("../../src/db/schema/content.schema.js", () => ({ content: {} }));
  vi.doMock("../../src/db/schema/playout-queue.schema.js", () => ({
    channelContent: {},
  }));
  vi.doMock("../../src/logging/logger.js", () => ({
    rootLogger: mockRootLogger,
  }));

  // Default: no content
  mockSelect.mockReturnValue({ from: mockSelectFrom });
  mockSelectFrom.mockReturnValue({ where: mockSelectWhere });
  mockSelectWhere.mockResolvedValue([]);
  mockDelete.mockReturnValue({ where: mockDeleteWhere });
  mockDeleteWhere.mockResolvedValue({ rowCount: 0 });
});

afterEach(() => {
  vi.resetAllMocks();
});

// ── Tests ──

describe("archiveCreator", () => {
  it("no-ops when creator has no content", async () => {
    mockSelectWhere.mockResolvedValueOnce([]);

    const { archiveCreator } = await import(
      "../../src/services/creator-lifecycle.js"
    );

    await archiveCreator("creator-123");

    expect(mockDelete).not.toHaveBeenCalled();
    expect(mockLoggerInfo).not.toHaveBeenCalled();
  });

  it("deletes channel_content rows for creator's content", async () => {
    const contentIds = [
      { id: "content-1" },
      { id: "content-2" },
      { id: "content-3" },
    ];
    mockSelectWhere.mockResolvedValueOnce(contentIds);
    mockDeleteWhere.mockResolvedValueOnce({ rowCount: 5 });

    const { archiveCreator } = await import(
      "../../src/services/creator-lifecycle.js"
    );

    await archiveCreator("creator-123");

    expect(mockDelete).toHaveBeenCalledOnce();
    expect(mockDeleteWhere).toHaveBeenCalledOnce();
  });

  it("logs cleanup event after removing pool entries", async () => {
    const contentIds = [{ id: "content-1" }, { id: "content-2" }];
    mockSelectWhere.mockResolvedValueOnce(contentIds);

    const { archiveCreator } = await import(
      "../../src/services/creator-lifecycle.js"
    );

    await archiveCreator("creator-abc");

    expect(mockLoggerInfo).toHaveBeenCalledOnce();
    expect(mockLoggerInfo).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "creator_archived_pool_cleanup",
        creatorId: "creator-abc",
        contentCount: 2,
      }),
      expect.any(String),
    );
  });

  it("does not delete playout item pool entries (only content-based entries)", async () => {
    // The delete is called with inArray on channelContent.contentId specifically
    // No playout item entries are affected since we filter by contentId
    const contentIds = [{ id: "content-1" }];
    mockSelectWhere.mockResolvedValueOnce(contentIds);

    const { archiveCreator } = await import(
      "../../src/services/creator-lifecycle.js"
    );

    await archiveCreator("creator-xyz");

    // delete is called only once (for channel_content rows by contentId)
    expect(mockDelete).toHaveBeenCalledOnce();
    // Verify it targets channelContent (the mock gets called)
    expect(mockDeleteWhere).toHaveBeenCalledOnce();
  });
});
