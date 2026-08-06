import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DEFAULT_PRESS_CONTENT, PressConfigPatchSchema } from "@snc/shared";
import type { PressContent } from "@snc/shared";

const mockSelectLimit = vi.fn();
const mockSelectWhere = vi.fn();
const mockSelectFrom = vi.fn();
const mockSelect = vi.fn();
const mockOnConflictDoUpdate = vi.fn();
const mockInsertValues = vi.fn();
const mockInsert = vi.fn();

const mockDb = { select: mockSelect, insert: mockInsert };
const mockCreatorPressConfigs = { creatorId: "creatorId" };

const setupService = async () => {
  vi.doMock("../../src/db/connection.js", () => ({ db: mockDb }));
  vi.doMock("../../src/db/schema/creator.schema.js", () => ({
    creatorPressConfigs: mockCreatorPressConfigs,
  }));

  return await import("../../src/services/press.js");
};

beforeEach(() => {
  vi.resetAllMocks();

  mockSelect.mockReturnValue({ from: mockSelectFrom });
  mockSelectFrom.mockReturnValue({ where: mockSelectWhere });
  mockSelectWhere.mockReturnValue({ limit: mockSelectLimit });
  mockSelectLimit.mockResolvedValue([]);
  mockInsert.mockReturnValue({ values: mockInsertValues });
  mockInsertValues.mockReturnValue({ onConflictDoUpdate: mockOnConflictDoUpdate });
  mockOnConflictDoUpdate.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.resetModules();
});

describe("PressConfigPatchSchema", () => {
  it("does not inject complete-document defaults into a partial patch", () => {
    const patch = PressConfigPatchSchema.parse({ shortBio: "Updated bio" });

    expect(patch).toEqual({ shortBio: "Updated bio" });
    expect(patch).not.toHaveProperty("enabled");
    expect(patch).not.toHaveProperty("forFansOf");
    expect(patch).not.toHaveProperty("streamingLinks");
    expect(patch).not.toHaveProperty("photos");
    expect(patch).not.toHaveProperty("releases");
  });
});

describe("press config service", () => {
  it("returns defaults when no config row exists", async () => {
    const { getPressConfig } = await setupService();

    const result = await getPressConfig("creator-1");

    expect(result).toEqual({ ok: true, value: DEFAULT_PRESS_CONTENT });
  });

  it("shallow-merges a partial patch and upserts the complete content document", async () => {
    const current: PressContent = {
      ...DEFAULT_PRESS_CONTENT,
      enabled: true,
      shortBio: "Original bio",
      forFansOf: ["IDLES"],
      photos: ["creators/creator-1/press/photo.jpg"],
    };
    mockSelectLimit.mockResolvedValueOnce([{ content: current }]);
    const patch = PressConfigPatchSchema.parse({ shortBio: "Updated bio" });
    const { upsertPressConfig } = await setupService();

    const result = await upsertPressConfig("creator-1", patch);

    const expected: PressContent = { ...current, shortBio: "Updated bio" };
    expect(result).toEqual({ ok: true, value: expected });
    expect(mockInsertValues).toHaveBeenCalledWith({
      creatorId: "creator-1",
      content: expected,
      updatedAt: expect.any(Date),
    });
    expect(mockOnConflictDoUpdate).toHaveBeenCalledWith({
      target: mockCreatorPressConfigs.creatorId,
      set: { content: expected, updatedAt: expect.any(Date) },
    });
  });
});
