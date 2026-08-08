import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  DEFAULT_PRESS_CONTENT,
  PressConfigPatchSchema,
  PressContentSchema,
} from "@snc/shared";
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

  it("normalizes a legacy row on the read path", async () => {
    mockSelectLimit.mockResolvedValueOnce([
      {
        content: {
          ...DEFAULT_PRESS_CONTENT,
          streamingLinks: [
            { label: "Spotify", url: "https://open.spotify.com/track/example" },
          ],
          photos: ["creators/creator-1/press/hero.jpg"],
          standoutTrack: {
            title: "The Standout",
            url: "https://open.spotify.com/track/example",
            streamsLabel: "14k streams",
          },
          releases: [
            {
              slug: "the-illusionist",
              title: "The Illusionist",
              catalogNumber: "SNCR-001",
              personnel: [],
              fcc: "clean",
              artKey: "creators/creator-1/press/art.jpg",
            },
          ],
          gallery: [],
          highlights: [],
        },
      },
    ]);
    const { getPressConfig } = await setupService();

    const result = await getPressConfig("creator-1");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.gallery).toEqual([
        { key: "creators/creator-1/press/hero.jpg", alt: "", credit: null },
      ]);
      expect(result.value.highlights).toEqual([
        {
          eyebrow: "Standout track",
          title: "The Standout",
          metric: "14k streams",
          url: "https://open.spotify.com/track/example",
        },
        {
          eyebrow: "New release · SNCR-001",
          title: "The Illusionist",
          coverArt: {
            key: "creators/creator-1/press/art.jpg",
            alt: "",
            credit: null,
          },
        },
      ]);
      expect(result.value.streamingLinks[0]?.service).toBe("spotify");
    }
  });

  it("preserves explicit v2 gallery and highlights", async () => {
    const explicit = PressContentSchema.parse({
      ...DEFAULT_PRESS_CONTENT,
      photos: ["creators/creator-1/press/legacy.jpg"],
      gallery: [{ key: "creators/creator-1/press/new.jpg", alt: "New photo" }],
      highlights: [{ eyebrow: "Feature", title: "New highlight" }],
    });
    const { normalizePressContent } = await setupService();

    expect(normalizePressContent(explicit)).toEqual(explicit);
  });

  it("is idempotent and handles empty legacy highlight sources", async () => {
    const legacy = PressContentSchema.parse({
      ...DEFAULT_PRESS_CONTENT,
      photos: ["creators/creator-1/press/legacy.jpg"],
      standoutTrack: null,
      releases: [],
    });
    const { normalizePressContent } = await setupService();

    const normalized = normalizePressContent(legacy);

    expect(normalizePressContent(normalized)).toEqual(normalized);
    expect(normalized.highlights).toEqual([]);
    expect(normalized.gallery).toHaveLength(1);
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

    const expected: PressContent = {
      ...current,
      shortBio: "Updated bio",
      gallery: [
        { key: "creators/creator-1/press/photo.jpg", alt: "", credit: null },
      ],
    };
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
