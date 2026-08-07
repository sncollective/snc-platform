import { beforeEach, describe, expect, it, vi } from "vitest";

import { ok } from "@snc/shared";
import type { PressContent, ReleaseOneSheet } from "@snc/shared";

const { mockStorageDownload } = vi.hoisted(() => ({
  mockStorageDownload: vi.fn(),
}));

vi.mock("../../src/storage/index.js", () => ({
  storage: { download: mockStorageDownload },
}));

import { renderOnePagerPdf, renderOneSheetPdf } from "../../src/services/press-pdf.js";

const releaseFixture: ReleaseOneSheet = {
  slug: "the-illusionist",
  title: "The Illusionist",
  catalogNumber: "SNCR-001",
  releaseDate: "2026-08-06",
  format: "Single",
  genre: "Alternative pop",
  isrc: "US-SNC-26-00001",
  upc: "012345678901",
  duration: "3:42",
  personnel: ["Ada Example — vocals", "Jules Example — drums"],
  writtenBy: "Animal Future",
  producedBy: "Animal Future",
  mixedMasteredBy: "Sam Example",
  copyrightLine: "℗ 2026 S/NC Records",
  publisherLine: "© 2026 Signal to Noise Collective",
  label: "S/NC Records",
  fcc: "clean",
  artKey: null,
};

const contentFixture: PressContent = {
  enabled: true,
  template: "A",
  members: [],
  highlights: [],
  gallery: [],
  shortBio: "Animal Future makes vivid alternative pop from Fort Collins.",
  longBio: null,
  forFansOf: ["Indie pop", "Art rock"],
  streamingLinks: [
    { service: "bandcamp", label: "Bandcamp", url: "https://example.com/animal-future" },
    { service: "youtube", label: "YouTube", url: "https://example.com/animal-future/video" },
  ],
  liveDatesUrl: null,
  standoutTrack: {
    title: "Get to You",
    url: "https://example.com/get-to-you",
    streamsLabel: "14.5k streams",
  },
  pressContactEmail: "press@s-nc.org",
  location: "Fort Collins, CO",
  photos: [],
  releases: [releaseFixture],
};

const expectPdfBuffer = (buffer: Buffer) => {
  expect(Buffer.isBuffer(buffer)).toBe(true);
  expect(buffer.length).toBeGreaterThan(100);
  expect(buffer.subarray(0, 4).toString("ascii")).toBe("%PDF");
  expect(buffer.toString("latin1").match(/\/Type \/Page\b/g)).toHaveLength(1);
};

describe("press PDF rendering", () => {
  beforeEach(() => {
    mockStorageDownload.mockReset();
  });

  it("renders a release one-sheet as a valid PDF buffer", async () => {
    const buffer = await renderOneSheetPdf(releaseFixture);

    expectPdfBuffer(buffer);
  });

  it("renders a creator one-pager without requiring a hero photo", async () => {
    const buffer = await renderOnePagerPdf({
      creator: {
        id: "creator_animalfuture",
        displayName: "Animal Future",
        handle: "animalfuture",
      },
      content: contentFixture,
    });

    expectPdfBuffer(buffer);
    expect(mockStorageDownload).not.toHaveBeenCalled();
  });

  it("resolves the first owned Garage photo stream to a buffer for the hero image", async () => {
    const png = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
      "base64",
    );
    mockStorageDownload.mockResolvedValueOnce(
      ok({
        stream: new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(png);
            controller.close();
          },
        }),
        size: png.length,
      }),
    );

    const buffer = await renderOnePagerPdf({
      creator: {
        id: "creator_animalfuture",
        displayName: "Animal Future",
        handle: "animalfuture",
      },
      content: {
        ...contentFixture,
        photos: ["creators/creator_animalfuture/press/hero.png"],
      },
    });

    expectPdfBuffer(buffer);
    expect(mockStorageDownload).toHaveBeenCalledWith(
      "creators/creator_animalfuture/press/hero.png",
    );
  });

  it("omits a foreign hero key without reading the object", async () => {
    const buffer = await renderOnePagerPdf({
      creator: {
        id: "creator_animalfuture",
        displayName: "Animal Future",
        handle: "animalfuture",
      },
      content: { ...contentFixture, photos: ["content/another-creator/private.jpg"] },
    });

    expectPdfBuffer(buffer);
    expect(mockStorageDownload).not.toHaveBeenCalled();
  });

  it("omits an unreadable hero photo without failing the PDF render", async () => {
    mockStorageDownload.mockRejectedValueOnce(new Error("photo unavailable"));

    const buffer = await renderOnePagerPdf({
      creator: {
        id: "creator_animalfuture",
        displayName: "Animal Future",
        handle: "animalfuture",
      },
      content: {
        ...contentFixture,
        photos: ["creators/creator_animalfuture/press/missing.jpg"],
      },
    });

    expectPdfBuffer(buffer);
  });
});
