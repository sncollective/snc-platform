import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  DEFAULT_PRESS_CONTENT,
  DraftPressConfigPatchSchema,
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
const mockUpdateReturning = vi.fn();
const mockUpdateWhere = vi.fn();
const mockUpdateSet = vi.fn();
const mockUpdate = vi.fn();
const mockTransaction = vi.fn();

const mockDb = {
  select: mockSelect,
  insert: mockInsert,
  update: mockUpdate,
  transaction: mockTransaction,
};
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
  mockUpdate.mockReturnValue({ set: mockUpdateSet });
  mockUpdateSet.mockReturnValue({ where: mockUpdateWhere });
  mockUpdateWhere.mockReturnValue({ returning: mockUpdateReturning });
  mockUpdateReturning.mockResolvedValue([]);
  mockTransaction.mockImplementation(async (callback) => callback({ update: mockUpdate }));
});

afterEach(() => {
  vi.resetModules();
});

describe("press patch contracts", () => {
  it("does not inject complete-document defaults into a partial patch", () => {
    const patch = PressConfigPatchSchema.parse({ shortBio: "Updated bio" });

    expect(patch).toEqual({ shortBio: "Updated bio" });
    expect(patch).not.toHaveProperty("enabled");
    expect(patch).not.toHaveProperty("forFansOf");
    expect(patch).not.toHaveProperty("streamingLinks");
    expect(patch).not.toHaveProperty("photos");
    expect(patch).not.toHaveProperty("releases");
  });

  it("keeps incomplete entities and malformed URLs in draft patches", () => {
    expect(DraftPressConfigPatchSchema.parse({
      members: [{ name: "" }],
      highlights: [{ eyebrow: "Release", title: "", url: "coming-soon" }],
      pressContactEmail: "not-an-email",
    })).toEqual({
      members: [{ name: "" }],
      highlights: [{ eyebrow: "Release", title: "", url: "coming-soon" }],
      pressContactEmail: "not-an-email",
    });
  });
});

describe("press config service", () => {
  it("returns defaults when no config row exists", async () => {
    const { getPressConfig } = await setupService();

    const result = await getPressConfig("creator-1");

    expect(result).toEqual({ ok: true, value: DEFAULT_PRESS_CONTENT });
  });

  it("normalizes a legacy row on the read path", async () => {
    const { gallery: _gallery, highlights: _highlights, ...legacyDefaults } = DEFAULT_PRESS_CONTENT;
    mockSelectLimit.mockResolvedValueOnce([
      {
        content: {
          ...legacyDefaults,
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

  it("preserves explicit empty v2 gallery and highlights", async () => {
    mockSelectLimit.mockResolvedValueOnce([
      {
        content: {
          ...DEFAULT_PRESS_CONTENT,
          photos: ["creators/creator-1/press/legacy.jpg"],
          standoutTrack: {
            title: "Legacy track",
            url: "https://open.spotify.com/track/example",
            streamsLabel: "14k streams",
          },
          gallery: [],
          highlights: [],
        },
      },
    ]);
    const { getPressConfig } = await setupService();

    const result = await getPressConfig("creator-1");

    expect(result).toEqual({
      ok: true,
      value: expect.objectContaining({ gallery: [], highlights: [] }),
    });
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

  it("round-trips a stored v1 row and infers legacy link services", async () => {
    const legacy = {
      ...DEFAULT_PRESS_CONTENT,
      streamingLinks: [{ label: "Bandcamp", url: "https://artist.bandcamp.com/album/demo" }],
      photos: ["creators/creator-1/press/photo.jpg"],
    };
    mockSelectLimit.mockResolvedValueOnce([{ content: legacy }]);
    const { getPressConfig, upsertPressConfig } = await setupService();

    const readV1 = await getPressConfig("creator-1");

    expect(readV1.ok).toBe(true);
    if (readV1.ok) {
      expect(readV1.value.streamingLinks).toEqual([
        {
          label: "Bandcamp",
          url: "https://artist.bandcamp.com/album/demo",
          service: "bandcamp",
        },
      ]);
    }

    mockSelectLimit.mockResolvedValueOnce([{ content: legacy }]);
    await upsertPressConfig("creator-1", PressConfigPatchSchema.parse({
      streamingLinks: [{ label: "Bandcamp", url: "https://artist.bandcamp.com/album/demo" }],
    }));

    const stored = mockInsertValues.mock.calls.at(-1)?.[0]?.draftContent;
    mockSelectLimit.mockResolvedValueOnce([{ content: legacy, draftContent: stored }]);
    const roundTrip = await getPressConfig("creator-1");

    expect(roundTrip.ok).toBe(true);
    if (roundTrip.ok) {
      expect(roundTrip.value.streamingLinks[0]?.label).toBe("Bandcamp");
      expect(roundTrip.value.streamingLinks[0]?.service).toBe("bandcamp");
    }
  });

  it("reads a v2 link without an explicit service while retaining its label", async () => {
    mockSelectLimit.mockResolvedValueOnce([
      {
        content: {
          ...DEFAULT_PRESS_CONTENT,
          streamingLinks: [{ label: "Custom site", url: "https://example.com/listen" }],
        },
      },
    ]);
    const { getPressConfig } = await setupService();

    const result = await getPressConfig("creator-1");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.streamingLinks[0]).toEqual({
        label: "Custom site",
        url: "https://example.com/listen",
        service: "website",
      });
    }
  });

  it("reads a pending draft instead of published content for the editor", async () => {
    const published = { ...DEFAULT_PRESS_CONTENT, shortBio: "Live" };
    const draft = { ...DEFAULT_PRESS_CONTENT, shortBio: "Staged" };
    mockSelectLimit.mockResolvedValueOnce([{ content: published, draftContent: draft }]);
    mockSelectLimit.mockResolvedValueOnce([{ content: published, draftContent: draft }]);
    const { getPressConfig, getPressDraftConfig } = await setupService();

    expect(await getPressConfig("creator-1")).toEqual({ ok: true, value: published });
    expect(await getPressDraftConfig("creator-1")).toEqual({ ok: true, value: draft });
  });

  it("round-trips a publish-invalid pending draft through the editor read path", async () => {
    const draft = {
      ...DEFAULT_PRESS_CONTENT,
      members: [{ name: "", role: null, photo: null, bio: null }],
      highlights: [{ eyebrow: "Release", title: "", url: "coming-soon" }],
      streamingLinks: [{ label: "Spotify", url: "open.spotify/draft", service: "website" as const }],
      pressContactEmail: "not-an-email",
    };
    mockSelectLimit.mockResolvedValueOnce([{ content: DEFAULT_PRESS_CONTENT, draftContent: draft }]);
    const { getPressDraftConfig } = await setupService();

    expect(await getPressDraftConfig("creator-1")).toEqual({ ok: true, value: draft });
  });

  it("shallow-merges a partial patch and upserts the complete draft document", async () => {
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
      gallery: [],
    };
    expect(result).toEqual({ ok: true, value: expected });
    expect(mockInsertValues).toHaveBeenCalledWith({
      creatorId: "creator-1",
      content: DEFAULT_PRESS_CONTENT,
      draftContent: expected,
      updatedAt: expect.any(Date),
    });
    expect(mockOnConflictDoUpdate).toHaveBeenCalledWith({
      target: mockCreatorPressConfigs.creatorId,
      set: { draftContent: expected, updatedAt: expect.any(Date) },
    });
  });

  it("publishes a draft atomically and returns the new published content", async () => {
    const draft = { ...DEFAULT_PRESS_CONTENT, shortBio: "Staged" };
    mockUpdateReturning.mockResolvedValueOnce([{ content: draft }]);
    const { publishPressConfig } = await setupService();

    const result = await publishPressConfig("creator-1");

    expect(result).toEqual({ ok: true, value: draft });
    expect(mockTransaction).toHaveBeenCalledOnce();
    expect(mockUpdateSet).toHaveBeenCalledWith(
      expect.objectContaining({ draftContent: null, updatedAt: expect.any(Date) }),
    );
  });

  it("rejects a publish-invalid draft inside the publishing transaction", async () => {
    mockUpdateReturning.mockResolvedValueOnce([{
      content: {
        ...DEFAULT_PRESS_CONTENT,
        members: [{ name: "" }],
        highlights: [{ eyebrow: "Release", title: "", url: "coming-soon" }],
      },
    }]);
    const { publishPressConfig } = await setupService();

    await expect(publishPressConfig("creator-1")).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
      statusCode: 400,
    });
    expect(mockTransaction).toHaveBeenCalledOnce();
  });

  it("discards a draft and preserves published content", async () => {
    const published = { ...DEFAULT_PRESS_CONTENT, shortBio: "Live" };
    mockSelectLimit.mockResolvedValueOnce([{ content: published, draftContent: { ...published, shortBio: "Staged" } }]);
    const { discardPressDraft } = await setupService();

    const result = await discardPressDraft("creator-1");

    expect(result).toEqual({ ok: true, value: published });
    expect(mockUpdateSet).toHaveBeenCalledWith({ draftContent: null, updatedAt: expect.any(Date) });
  });
});
