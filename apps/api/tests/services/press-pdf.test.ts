import { beforeEach, describe, expect, it, vi } from "vitest";

import { ok } from "@snc/shared";
import type { PressContent, ReleaseOneSheet } from "@snc/shared";

const {
  mockBuildPressImageUrl,
  mockDbSelect,
  mockRenderBrowserPdf,
  mockStorageDownload,
} = vi.hoisted(() => ({
  mockBuildPressImageUrl: vi.fn(),
  mockDbSelect: vi.fn(),
  mockRenderBrowserPdf: vi.fn(),
  mockStorageDownload: vi.fn(),
}));

vi.mock("../../src/services/browser-pdf.js", () => ({
  renderBrowserPdf: mockRenderBrowserPdf,
}));
vi.mock("../../src/db/connection.js", () => ({
  db: { select: mockDbSelect },
}));
vi.mock("../../src/storage/index.js", () => ({
  storage: { download: mockStorageDownload },
}));
vi.mock("../../src/lib/imgproxy.js", () => ({
  buildPressImageUrl: mockBuildPressImageUrl,
}));

import {
  renderCreatorOneSheetPdf,
  renderOnePagerPdf,
  renderOneSheetPdf,
} from "../../src/services/press-pdf.js";

const pdf = Buffer.from("%PDF fixture");
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
  tagline: "Socially conscious punk / alt-rock",
  shortBio: "Punk-leaning rock that hits where it hurts.",
  longBio: "First full biography paragraph.\n\nSecond full biography paragraph.",
  forFansOf: ["IDLES", "Radiohead"],
  banner: { key: "creators/creator_animalfuture/press/banner.png", alt: "Band live", credit: "Photo · Test" },
  aboutPhoto: null,
  members: [{ name: "LeAnna Warren", role: "Vocals", bio: "Hush-to-roar frontwoman.", photo: null }],
  highlights: [{ eyebrow: "Standout track", title: "Get to You", metric: "14.5k streams", coverArt: null }],
  gallery: [],
  streamingLinks: [{ service: "bandcamp", label: "Bandcamp", url: "https://example.com/listen" }],
  liveDatesUrl: "https://www.bandsintown.com/a/animal-future",
  standoutTrack: null,
  pressContactEmail: "press@s-nc.org",
  location: "Fort Collins, Colorado",
  photos: [],
  releases: [releaseFixture],
};

const creator = {
  id: "creator_animalfuture",
  displayName: "Animal Future",
  handle: "animalfuture",
  socialLinks: [] as const,
};

const libraryKey = `library/aa/${"a".repeat(64)}.png`;

const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);

const downloadResult = () => ok({
  stream: new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(png);
      controller.close();
    },
  }),
  size: png.length,
});

describe("press PDF rendering", () => {
  beforeEach(() => {
    mockDbSelect.mockReset().mockReturnValue({
      from: () => ({
        where: () => ({ limit: () => Promise.resolve([]) }),
      }),
    });
    mockRenderBrowserPdf.mockReset().mockResolvedValue(pdf);
    mockStorageDownload.mockReset().mockResolvedValue(downloadResult());
    mockBuildPressImageUrl.mockReset().mockImplementation((image, slot, width, height) => ({
      src: `https://img.test/${slot}/${width}x${height}/${image.key}`,
      srcSet: "",
      sizes: "",
    }));
  });

  it("renders the release route contract as a US Letter PDF", async () => {
    const buffer = await renderOneSheetPdf(releaseFixture);
    expect(buffer.subarray(0, 4).toString("ascii")).toBe("%PDF");
    expect(buffer.toString("latin1").match(/\/Type \/Page\b/g)).toHaveLength(1);
  });

  it("prints the live web template with the selected brand theme", async () => {
    await expect(renderOnePagerPdf({
      pageUrl: "http://web.test/creators/animalfuture/press",
      theme: "brand",
      brandColor: "#f28482",
    })).resolves.toEqual(pdf);

    expect(mockRenderBrowserPdf).toHaveBeenCalledWith({
      url: "http://web.test/creators/animalfuture/press",
      style: expect.stringContaining("--color-accent:#f28482"),
    });
  });

  it("renders the locked horizontal one-sheet with credit, QR fallback, and print floors", async () => {
    await renderCreatorOneSheetPdf({
      creator,
      content: contentFixture,
      pressPageUrl: "https://s-nc.org/creators/animalfuture/press",
      theme: "dark",
      brandColor: null,
      orientation: "horizontal",
    });

    const call = mockRenderBrowserPdf.mock.calls[0]?.[0] as { html: string; singlePage: boolean };
    expect(call.singlePage).toBe(true);
    expect(call.html).toContain("horizontal");
    expect(call.html).toContain("Photo · Test");
    expect(call.html).toContain("linktr.ee/animalfutureofficial");
    expect(call.html).toContain("font-size:10px;line-height:16px");
    expect(call.html).toContain("width:80px;height:80px");
    expect(call.html).toContain("Live dates");
    expect(call.html).toContain("bandsintown.com/a/animal-future");
    expect(call.html).toContain("class=\"metric\">14.5k streams");
    expect(call.html).toContain("font-family:\"SNC Inter\"");
    expect(mockStorageDownload).toHaveBeenCalledWith(contentFixture.banner?.key);
    expect(mockDbSelect).not.toHaveBeenCalled();
    expect(mockBuildPressImageUrl).toHaveBeenCalledWith(
      contentFixture.banner,
      "banner",
      2250,
      750,
    );
  });

  it("uses stored dimensions for a library image without downloading its bytes", async () => {
    mockDbSelect.mockReturnValueOnce({
      from: () => ({
        where: () => ({
          limit: () => Promise.resolve([{ width: 3000, height: 1000 }]),
        }),
      }),
    });
    const banner = { key: libraryKey, alt: "Library hero" };

    await renderCreatorOneSheetPdf({
      creator,
      content: { ...contentFixture, banner },
      pressPageUrl: "https://s-nc.org/creators/animalfuture/press",
      theme: "dark",
      brandColor: null,
      orientation: "horizontal",
    });

    expect(mockDbSelect).toHaveBeenCalledOnce();
    expect(mockStorageDownload).not.toHaveBeenCalled();
    expect(mockBuildPressImageUrl).toHaveBeenCalledWith(banner, "banner", 2250, 750);
  });

  it("renders the locked vertical one-sheet with one-paragraph bio and creator URL", async () => {
    await renderCreatorOneSheetPdf({
      creator: {
        ...creator,
        socialLinks: [{ platform: "website", url: "https://linktr.ee/custom-artist" }],
      },
      content: { ...contentFixture, banner: null, aboutPhoto: { key: "creators/creator_animalfuture/press/vertical.png", alt: "Portrait" } },
      pressPageUrl: "https://s-nc.org/creators/animalfuture/press",
      theme: "light",
      brandColor: null,
      orientation: "auto",
    });

    const html = (mockRenderBrowserPdf.mock.calls[0]?.[0] as { html: string }).html;
    expect(html).toContain("sheet vertical");
    expect(html).toContain("linktr.ee/custom-artist");
    expect(html).toContain("--color-bg:#f7f3eb");
    expect(html).toContain("First full biography paragraph.");
    expect(html.match(/Punk-leaning rock that hits where it hurts\./g)).toHaveLength(1);
    expect(html).not.toContain("Second full biography paragraph");
    expect(mockBuildPressImageUrl).toHaveBeenCalledWith(
      expect.objectContaining({ key: "creators/creator_animalfuture/press/vertical.png" }),
      "about",
      725,
      3000,
    );
  });

  it("rejects a QR destination that cannot retain 0.4mm modules within the layout", async () => {
    await expect(renderCreatorOneSheetPdf({
      creator,
      content: contentFixture,
      pressPageUrl: "https://s-nc.org/creators/animalfuture/press",
      destinationUrl: `https://example.com/${"a".repeat(480)}`,
      theme: "dark",
      brandColor: null,
      orientation: "horizontal",
    })).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    expect(mockRenderBrowserPdf).not.toHaveBeenCalled();
  });

  it("omits a foreign image key without reading storage", async () => {
    await renderCreatorOneSheetPdf({
      creator,
      content: { ...contentFixture, banner: { key: "creators/other/press/private.jpg", alt: "Private" } },
      pressPageUrl: "https://s-nc.org/creators/animalfuture/press",
      theme: "dark",
      brandColor: null,
      orientation: "horizontal",
    });
    expect(mockStorageDownload).not.toHaveBeenCalled();
  });
});
