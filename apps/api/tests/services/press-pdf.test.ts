import { beforeEach, describe, expect, it, vi } from "vitest";

import { ok } from "@snc/shared";
import type { CreatorBrandColor, PressContent, ReleaseOneSheet } from "@snc/shared";

const {
  mockBuildPressImageUrl,
  mockDbSelect,
  mockRenderBrowserPdf,
  mockStorageDownload,
  MockFitError,
} = vi.hoisted(() => {
  class MockFitError extends Error {
    constructor(message: string) {
      super(message);
      this.name = "BrowserPdfSinglePageFitError";
    }
  }
  return {
    mockBuildPressImageUrl: vi.fn(),
    mockDbSelect: vi.fn(),
    mockRenderBrowserPdf: vi.fn(),
    mockStorageDownload: vi.fn(),
    MockFitError,
  };
});

vi.mock("../../src/services/browser-pdf.js", () => ({
  renderBrowserPdf: mockRenderBrowserPdf,
  BrowserPdfSinglePageFitError: MockFitError,
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
  EXPORT_VOICES,
  renderCreatorOneSheetPdf,
  renderOnePagerPdf,
  renderReleaseOneSheetPdf,
  resolvePdfExportIdentity,
} from "../../src/services/press-pdf.js";
import { BrowserPdfSinglePageFitError } from "../../src/services/browser-pdf.js";

const pdf = Buffer.from("%PDF fixture");const releaseFixture: ReleaseOneSheet = {
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
  lyricPulls: [],
  photos: [],
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
  pressQuotes: [],
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

const recordsIdentity = {
  producingUnit: "records",
  federationHandle: creator.handle,
  creatorBrandColor: "#f28482" as CreatorBrandColor,
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
    mockStorageDownload.mockReset().mockImplementation(() => Promise.resolve(downloadResult()));
    mockBuildPressImageUrl.mockReset().mockImplementation((image, slot, width, height) => ({
      src: `https://img.test/${slot}/${width}x${height}/${image.key}`,
      srcSet: "",
      sizes: "",
    }));
  });

  it.each([
    ["Records", "records"],
    ["STUDIO", "studio"],
    ["tv", "tv"],
    ["parent", "parent"],
    [null, "records"],
    ["unknown", "records"],
  ] as const)("resolves producing unit %s without consulting a route", (producingUnit, voice) => {
    expect(resolvePdfExportIdentity({
      producingUnit,
      federationHandle: null,
      creatorBrandColor: null,
    })).toEqual({ voice, creatorDecoration: null });
  });

  it.each([
    ["artist", "#f28482", "#f28482"],
    ["artist", null, null],
    [null, "#f28482", null],
    [null, null, null],
  ] as const)("requires both federation handle %s and curated color %s for decoration", (
    federationHandle,
    creatorBrandColor,
    creatorDecoration,
  ) => {
    expect(resolvePdfExportIdentity({
      producingUnit: "records",
      federationHandle,
      creatorBrandColor,
    })).toEqual({ voice: "records", creatorDecoration });
  });

  it("prints the live template under an explicit light Studio scope that beats route aliases", async () => {
    await expect(renderOnePagerPdf({
      pageUrl: "http://web.test/creators/artist/press",
      exportIdentity: {
        producingUnit: "studio",
        federationHandle: null,
        creatorBrandColor: null,
      },
    })).resolves.toEqual(pdf);

    const call = mockRenderBrowserPdf.mock.calls[0]?.[0] as {
      url: string;
      documentAttributes: Record<string, string>;
      style: string;
    };
    expect(call.url).toBe("http://web.test/creators/artist/press");
    expect(call.documentAttributes).toEqual({
      "data-theme": "light",
      "data-export-voice": "studio",
    });
    expect(call.style).toContain(':root[data-theme="light"][data-export-voice="studio"]');
    expect(call.style).toContain(":is([data-press-template], [data-pdf-sheet])");
    const voiceRoleSuffixes = [
      ["--color-accent", "accent"],
      ["--color-accent-hover", "accent-hover"],
      ["--color-accent-bg", "accent-bg"],
      ["--color-accent-subtle", "accent-subtle"],
      ["--color-on-accent", "on-accent"],
      ["--color-accent2", "accent2"],
      ["--color-link", "accent"],
      ["--color-link-hover", "accent-hover"],
      ["--radius", "radius"],
      ["--radius-sm", "radius-sm"],
      ["--radius-md", "radius-md"],
      ["--radius-lg", "radius-lg"],
      ["--radius-xl", "radius-xl"],
    ] as const;
    for (const voice of EXPORT_VOICES) {
      expect(call.style).toContain(`:root[data-theme="light"][data-export-voice="${voice}"]`);
      for (const [alias, suffix] of voiceRoleSuffixes) {
        expect(call.style).toContain(`${alias}: var(--voice-${voice}-${suffix});`);
      }
      expect(call.style).toContain(`--font-body: var(--font-body-${voice});`);
      expect(call.style).toContain(`--font-display: var(--font-display-${voice});`);
    }
    expect(call.style).not.toContain("[data-route=");
  });

  it.each([
    ["artist", "#f28482", "#f28482"],
    ["artist", null, "var(--voice-records-accent)"],
    [null, "#f28482", "var(--voice-records-accent)"],
    [null, null, "var(--voice-records-accent)"],
  ] as const)("scopes creator decoration for handle %s and color %s", async (
    federationHandle,
    creatorBrandColor,
    expectedDecoration,
  ) => {
    await renderOnePagerPdf({
      pageUrl: "http://web.test/creators/artist/press",
      exportIdentity: {
        producingUnit: "records",
        federationHandle,
        creatorBrandColor,
      },
    });
    const style = (mockRenderBrowserPdf.mock.calls.at(-1)?.[0] as { style: string }).style;
    expect(style).toContain(`--export-accent-decoration: ${expectedDecoration}`);
  });

  it("renders the locked horizontal one-sheet with retained-head body markup and print floors", async () => {
    await renderCreatorOneSheetPdf({
      creator,
      content: contentFixture,
      pressPageUrl: "https://s-nc.org/creators/animalfuture/press",
      exportIdentity: recordsIdentity,
      orientation: "horizontal",
    });

    const call = mockRenderBrowserPdf.mock.calls[0]?.[0] as {
      url: string;
      replaceBodyHtml: string;
      documentAttributes: Record<string, string>;
      style: string;
      singlePage: boolean;
    };
    expect(call).toMatchObject({
      url: "https://s-nc.org/creators/animalfuture/press",
      singlePage: true,
      documentAttributes: {
        "data-theme": "light",
        "data-export-voice": "records",
      },
    });
    expect(call.replaceBodyHtml).toContain('data-pdf-sheet class="sheet horizontal"');
    expect(call.replaceBodyHtml).not.toContain("<!doctype html>");
    expect(call.replaceBodyHtml).toContain("Photo · Test");
    expect(call.replaceBodyHtml).toContain("linktr.ee/animalfutureofficial");
    expect(call.replaceBodyHtml).toContain("Live dates");
    expect(call.replaceBodyHtml).toContain("bandsintown.com/a/animal-future");
    expect(call.replaceBodyHtml).toContain('class="metric">14.5k streams');
    expect(call.style).toContain("font-family:var(--font-body)");
    expect(call.style).toContain("border-top:2px solid var(--export-accent-decoration)");
    expect(call.style).toContain("width:80px;height:80px");
    expect(call.style).not.toContain("color-secondary");
    expect(mockStorageDownload).toHaveBeenCalledWith(contentFixture.banner?.key);
    expect(mockBuildPressImageUrl).toHaveBeenCalledWith(
      contentFixture.banner,
      "banner",
      2294,
      1163,
      "no",
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
      exportIdentity: recordsIdentity,
      orientation: "horizontal",
    });

    expect(mockDbSelect).toHaveBeenCalledOnce();
    expect(mockStorageDownload).not.toHaveBeenCalled();
    expect(mockBuildPressImageUrl).toHaveBeenCalledWith(banner, "banner", 2294, 1163, "no");
  });

  it("renders the locked vertical one-sheet with one-paragraph bio and creator URL", async () => {
    await renderCreatorOneSheetPdf({
      creator: {
        ...creator,
        socialLinks: [{ platform: "website", url: "https://linktr.ee/custom-artist" }],
      },
      content: {
        ...contentFixture,
        banner: null,
        aboutPhoto: { key: "creators/creator_animalfuture/press/vertical.png", alt: "Portrait" },
      },
      pressPageUrl: "https://s-nc.org/creators/animalfuture/press",
      exportIdentity: recordsIdentity,
      orientation: "auto",
    });

    const call = mockRenderBrowserPdf.mock.calls[0]?.[0] as {
      replaceBodyHtml: string;
      style: string;
    };
    expect(call.replaceBodyHtml).toContain("sheet vertical");
    expect(call.replaceBodyHtml).toContain("linktr.ee/custom-artist");
    expect(call.replaceBodyHtml).toContain("First full biography paragraph.");
    expect(call.replaceBodyHtml.match(/Punk-leaning rock that hits where it hurts\./g)).toHaveLength(1);
    expect(call.replaceBodyHtml).not.toContain("Second full biography paragraph");
    expect(call.style).toContain("--color-accent: var(--voice-records-accent)");
    expect(mockBuildPressImageUrl).toHaveBeenCalledWith(
      expect.objectContaining({ key: "creators/creator_animalfuture/press/vertical.png" }),
      "about",
      725,
      3000,
    );
  });

  it("renders the pinned deterministic template per orientation with no retries", async () => {
    const result = await renderCreatorOneSheetPdf({
      creator,
      content: contentFixture,
      pressPageUrl: "https://s-nc.org/creators/animalfuture/press",
      exportIdentity: recordsIdentity,
      orientation: "horizontal",
    });

    expect(result).toBe(pdf);
    expect(mockRenderBrowserPdf).toHaveBeenCalledTimes(1);
    expect((mockRenderBrowserPdf.mock.calls[0]?.[0] as { replaceBodyHtml: string }).replaceBodyHtml)
      .toContain('data-pdf-sheet class="sheet horizontal"');
  });

  it("pins the vertical template at compact density", async () => {
    await renderCreatorOneSheetPdf({
      creator,
      content: contentFixture,
      pressPageUrl: "https://s-nc.org/creators/animalfuture/press",
      exportIdentity: recordsIdentity,
      orientation: "vertical",
    });

    expect(mockRenderBrowserPdf).toHaveBeenCalledTimes(1);
    expect((mockRenderBrowserPdf.mock.calls[0]?.[0] as { replaceBodyHtml: string }).replaceBodyHtml)
      .toContain('data-pdf-sheet class="sheet vertical density-compact"');
  });

  it("fails a fit immediately at the pinned density instead of re-tiering", async () => {
    mockRenderBrowserPdf.mockRejectedValueOnce(
      new BrowserPdfSinglePageFitError("Press one-sheet does not fit one page: vertical content overflow"),
    );

    await expect(renderCreatorOneSheetPdf({
      creator,
      content: contentFixture,
      pressPageUrl: "https://s-nc.org/creators/animalfuture/press",
      exportIdentity: recordsIdentity,
      orientation: "vertical",
    })).rejects.toBeInstanceOf(BrowserPdfSinglePageFitError);

    expect(mockRenderBrowserPdf).toHaveBeenCalledTimes(1);
  });

  it("propagates non-fit render failures without density retries", async () => {
    mockRenderBrowserPdf.mockRejectedValueOnce(new Error("asset load failed"));

    await expect(renderCreatorOneSheetPdf({
      creator,
      content: contentFixture,
      pressPageUrl: "https://s-nc.org/creators/animalfuture/press",
      exportIdentity: recordsIdentity,
      orientation: "horizontal",
    })).rejects.toThrow("asset load failed");

    expect(mockRenderBrowserPdf).toHaveBeenCalledTimes(1);
  });

  it("threads a dark export theme through document attributes and the voice scope", async () => {
    await renderCreatorOneSheetPdf({
      creator,
      content: contentFixture,
      pressPageUrl: "https://s-nc.org/creators/animalfuture/press",
      exportIdentity: { ...recordsIdentity, theme: "dark" },
      orientation: "horizontal",
    });

    const call = mockRenderBrowserPdf.mock.calls[0]?.[0] as {
      documentAttributes: Record<string, string>;
      style: string;
    };
    expect(call.documentAttributes["data-theme"]).toBe("dark");
    expect(call.style).toContain('[data-theme="dark"][data-export-voice="records"]');
    expect(call.style).not.toContain('[data-theme="light"][data-export-voice=');
  });

  it("defaults the export theme to light paper", async () => {
    await renderCreatorOneSheetPdf({
      creator,
      content: contentFixture,
      pressPageUrl: "https://s-nc.org/creators/animalfuture/press",
      exportIdentity: recordsIdentity,
      orientation: "horizontal",
    });

    const call = mockRenderBrowserPdf.mock.calls[0]?.[0] as {
      documentAttributes: Record<string, string>;
    };
    expect(call.documentAttributes["data-theme"]).toBe("light");
  });

  it("links the listen URL and renders the booking contact when configured", async () => {
    await renderCreatorOneSheetPdf({
      creator,
      content: { ...contentFixture, bookingContactEmail: "booking@s-nc.org" },
      pressPageUrl: "https://s-nc.org/creators/animalfuture/press",
      exportIdentity: recordsIdentity,
      orientation: "vertical",
    });

    const call = mockRenderBrowserPdf.mock.calls[0]?.[0] as { replaceBodyHtml: string };
    expect(call.replaceBodyHtml).toContain(
      '<a class="url" href="https://linktr.ee/animalfutureofficial">linktr.ee/animalfutureofficial</a>',
    );
    expect(call.replaceBodyHtml).toContain('<span>Booking</span><strong>booking@s-nc.org</strong>');
    expect(call.replaceBodyHtml).toContain('<span>Press</span><strong>press@s-nc.org</strong>');
    expect(mockRenderBrowserPdf).toHaveBeenCalledTimes(1);
  });

  it("requests vertical member portraits at the rendered box aspect, not a square middleman", async () => {
    await renderCreatorOneSheetPdf({
      creator,
      content: {
        ...contentFixture,
        members: [{ name: "LeAnna Warren", role: "Vocals", bio: "Hush-to-roar frontwoman.", photo: { key: "creators/creator_animalfuture/press/member-leanna-v01.jpg", alt: "LeAnna Warren portrait" } }],
      },
      pressPageUrl: "https://s-nc.org/creators/animalfuture/press",
      exportIdentity: recordsIdentity,
      orientation: "vertical",
    });

    expect(mockBuildPressImageUrl).toHaveBeenCalledWith(
      expect.objectContaining({ key: "creators/creator_animalfuture/press/member-leanna-v01.jpg" }),
      "member",
      188,
      188,
    );

    await renderCreatorOneSheetPdf({
      creator,
      content: {
        ...contentFixture,
        members: [{ name: "LeAnna Warren", role: "Vocals", photo: { key: "creators/creator_animalfuture/press/member-leanna-v01.jpg", alt: "LeAnna Warren portrait" } }],
      },
      pressPageUrl: "https://s-nc.org/creators/animalfuture/press",
      exportIdentity: recordsIdentity,
      orientation: "horizontal",
    });

    expect(mockBuildPressImageUrl).toHaveBeenLastCalledWith(
      expect.objectContaining({ key: "creators/creator_animalfuture/press/member-leanna-v01.jpg" }),
      "member",
      200,
      200,
    );
  });

  it("renders press quotes as attributed pull-quotes with per-orientation caps", async () => {
    const quotes = [
      { text: "Electric stage energy.", source: "Fort Collins Music Association", url: "https://focoma.org/artist/65/animal-future" },
      { text: "Second opinion.", source: "Other Outlet" },
    ];

    await renderCreatorOneSheetPdf({
      creator,
      content: { ...contentFixture, pressQuotes: quotes },
      pressPageUrl: "https://s-nc.org/creators/animalfuture/press",
      exportIdentity: recordsIdentity,
      orientation: "vertical",
    });
    let call = mockRenderBrowserPdf.mock.calls[0]?.[0] as { replaceBodyHtml: string };
    expect(call.replaceBodyHtml).toContain('<aside class="pull-quote"><p>\u201CElectric stage energy.\u201D</p><cite>\u2014 Fort Collins Music Association</cite></aside>');
    expect(call.replaceBodyHtml).not.toContain("Second opinion.");

    await renderCreatorOneSheetPdf({
      creator,
      content: { ...contentFixture, pressQuotes: quotes },
      pressPageUrl: "https://s-nc.org/creators/animalfuture/press",
      exportIdentity: recordsIdentity,
      orientation: "horizontal",
    });
    call = mockRenderBrowserPdf.mock.calls.at(-1)?.[0] as { replaceBodyHtml: string };
    expect(call.replaceBodyHtml).toContain("Electric stage energy.");
    expect(call.replaceBodyHtml).toContain("Second opinion.");

    await renderCreatorOneSheetPdf({
      creator,
      content: contentFixture,
      pressPageUrl: "https://s-nc.org/creators/animalfuture/press",
      exportIdentity: recordsIdentity,
      orientation: "vertical",
    });
    call = mockRenderBrowserPdf.mock.calls.at(-1)?.[0] as { replaceBodyHtml: string };
    expect(call.replaceBodyHtml).not.toContain("pull-quote");
  });

  it("renders the photography credits as small print in the sheet footer", async () => {
    await renderCreatorOneSheetPdf({
      creator,
      content: { ...contentFixture, photographyCredits: "Daniel Melchior" },
      pressPageUrl: "https://s-nc.org/creators/animalfuture/press",
      exportIdentity: recordsIdentity,
      orientation: "vertical",
    });
    let call = mockRenderBrowserPdf.mock.calls[0]?.[0] as { replaceBodyHtml: string; style: string };
    expect(call.replaceBodyHtml).toContain('<p class="photo-credits">Photography: Daniel Melchior</p>');
    expect(call.replaceBodyHtml).toContain('@signaltonoise.co');
    expect(call.style).toContain(".photo-credits{position:absolute");

    await renderCreatorOneSheetPdf({
      creator,
      content: contentFixture,
      pressPageUrl: "https://s-nc.org/creators/animalfuture/press",
      exportIdentity: recordsIdentity,
      orientation: "horizontal",
    });
    call = mockRenderBrowserPdf.mock.calls.at(-1)?.[0] as { replaceBodyHtml: string; style: string };
    expect(call.replaceBodyHtml).not.toContain("Photography:");
  });

  it("renders a long-field release as escaped retained-head Letter markup", async () => {
    const longValue = `Long field ${"wrap ".repeat(50)}<&>`;
    await renderReleaseOneSheetPdf({
      release: {
        ...releaseFixture,
        title: longValue,
        personnel: [longValue, longValue, longValue, longValue],
      },
      creatorId: creator.id,
      pressPageUrl: "https://s-nc.org/creators/animalfuture/press",
      exportIdentity: recordsIdentity,
    });

    const call = mockRenderBrowserPdf.mock.calls[0]?.[0] as {
      replaceBodyHtml: string;
      style: string;
      singlePage: boolean;
    };
    expect(call.singlePage).toBe(true);
    expect(call.replaceBodyHtml).toContain('data-pdf-sheet class="release-sheet"');
    expect(call.replaceBodyHtml).toContain("&lt;&amp;&gt;");
    expect(call.replaceBodyHtml).not.toContain("<React");
    expect(call.style).toContain("width:8.5in;height:11in");
    expect(call.style).toContain("@page{size:letter portrait;margin:0}");
    expect(call.style).toContain("border-top:6px solid var(--export-accent-decoration)");
  });

  it("renders the release mast with cover art when artKey resolves", async () => {
    const artKey = `creators/${creator.id}/press/this-hell-cover-v01.jpg`;
    await renderReleaseOneSheetPdf({
      release: { ...releaseFixture, artKey },
      creatorId: creator.id,
      pressPageUrl: "https://s-nc.org/creators/animalfuture/press",
      exportIdentity: recordsIdentity,
    });

    const call = mockRenderBrowserPdf.mock.calls[0]?.[0] as { replaceBodyHtml: string };
    expect(mockBuildPressImageUrl).toHaveBeenCalledWith(
      expect.objectContaining({ key: artKey }),
      "cover",
      540,
      540,
    );
    expect(call.replaceBodyHtml).toContain('class="release-mast"');
    expect(call.replaceBodyHtml).toContain(
      `<img src="https://img.test/cover/540x540/${artKey}" alt="The Illusionist single artwork">`,
    );
  });

  it("falls back to the text-only layout when the artwork cannot be validated", async () => {
    mockStorageDownload.mockRejectedValueOnce(new Error("object gone"));
    await renderReleaseOneSheetPdf({
      release: { ...releaseFixture, artKey: `creators/${creator.id}/press/missing.jpg` },
      creatorId: creator.id,
      pressPageUrl: "https://s-nc.org/creators/animalfuture/press",
      exportIdentity: recordsIdentity,
    });

    const call = mockRenderBrowserPdf.mock.calls[0]?.[0] as { replaceBodyHtml: string };
    expect(call.replaceBodyHtml).toContain("<h1>The Illusionist</h1>");
    expect(call.replaceBodyHtml).not.toContain('class="release-mast"');
    expect(mockBuildPressImageUrl).not.toHaveBeenCalled();
  });

  it("renders no mast when artKey is null", async () => {
    await renderReleaseOneSheetPdf({
      release: releaseFixture,
      creatorId: creator.id,
      pressPageUrl: "https://s-nc.org/creators/animalfuture/press",
      exportIdentity: recordsIdentity,
    });

    const call = mockRenderBrowserPdf.mock.calls[0]?.[0] as { replaceBodyHtml: string };
    expect(call.replaceBodyHtml).toContain("<h1>The Illusionist</h1>");
    expect(call.replaceBodyHtml).not.toContain('class="release-mast"');
  });

  it("rejects a QR destination that cannot retain 0.4mm modules within the layout", async () => {
    await expect(renderCreatorOneSheetPdf({
      creator,
      content: contentFixture,
      pressPageUrl: "https://s-nc.org/creators/animalfuture/press",
      destinationUrl: `https://example.com/${"a".repeat(480)}`,
      exportIdentity: recordsIdentity,
      orientation: "horizontal",
    })).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    expect(mockRenderBrowserPdf).not.toHaveBeenCalled();
  });

  it("omits a foreign image key without reading storage", async () => {
    await renderCreatorOneSheetPdf({
      creator,
      content: {
        ...contentFixture,
        banner: { key: "creators/other/press/private.jpg", alt: "Private" },
      },
      pressPageUrl: "https://s-nc.org/creators/animalfuture/press",
      exportIdentity: recordsIdentity,
      orientation: "horizontal",
    });
    expect(mockStorageDownload).not.toHaveBeenCalled();
  });
});
