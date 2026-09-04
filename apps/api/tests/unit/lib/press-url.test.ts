import { beforeEach, describe, expect, it, vi } from "vitest";

import type { PressContent, PressImage } from "@snc/shared";

const mockBuildPressImageUrl = vi.hoisted(() => vi.fn());

vi.mock("../../../src/lib/imgproxy.js", () => ({
  buildPressImageUrl: mockBuildPressImageUrl,
}));

import { resolvePressPageContent } from "../../../src/lib/press-url.js";

const image = (key: string): PressImage => ({
  key,
  alt: `${key} alt`,
  credit: `${key} credit`,
  crop: { x: 0.1, y: 0.2, width: 0.7, height: 0.6 },
});

const content: PressContent = {
  enabled: true,
  template: "A",
  tagline: "Loud and kind.",
  shortBio: "Short biography",
  longBio: "Long biography",
  forFansOf: [],
  banner: image("banner"),
  aboutPhoto: null,
  members: [
    { name: "One", photo: image("member-one") },
    { name: "Two", photo: null },
  ],
  streamingLinks: [],
  liveDatesUrl: null,
  standoutTrack: null,
  highlights: [
    { eyebrow: "New", title: "Record", coverArt: image("cover") },
    { eyebrow: "News", title: "Tour", coverArt: null },
  ],
  pressContactEmail: "press@s-nc.org",
  pressQuotes: [],
  location: "Fort Collins, CO",
  photos: [],
  gallery: [image("gallery-one"), image("gallery-two")],
  releases: [],
};

describe("resolvePressPageContent", () => {
  beforeEach(() => {
    mockBuildPressImageUrl.mockImplementation((source: PressImage, slot: string, width: number) => ({
      src: `/${slot}/${width}/${source.key}`,
      srcSet: `/${slot}/${width}/${source.key} ${width}w`,
      sizes: `${slot}-sizes`,
    }));
  });

  it("projects every image through its exact slot while preserving metadata and order", () => {
    const result = resolvePressPageContent(content);

    expect(mockBuildPressImageUrl.mock.calls.map(([source, slot, width]) => [source.key, slot, width])).toEqual([
      ["banner", "banner", 2294],
      ["member-one", "member", 480],
      ["cover", "cover", 480],
      ["gallery-one", "gallery", 960],
      ["gallery-two", "gallery", 960],
    ]);
    expect(result.banner).toMatchObject(content.banner!);
    expect(result.banner).toMatchObject({ src: "/banner/2294/banner", sizes: "banner-sizes" });
    expect(result.gallery.map((item) => item.key)).toEqual(["gallery-one", "gallery-two"]);
  });

  it("leaves absent media null and empty arrays empty without calling the signer", () => {
    const sparse = resolvePressPageContent({
      ...content,
      banner: null,
      aboutPhoto: undefined,
      members: [],
      highlights: [],
      gallery: [],
    });

    expect(sparse.banner).toBeNull();
    expect(sparse.aboutPhoto).toBeNull();
    expect(sparse.members).toEqual([]);
    expect(sparse.highlights).toEqual([]);
    expect(sparse.gallery).toEqual([]);
    expect(mockBuildPressImageUrl).not.toHaveBeenCalled();
  });
});
