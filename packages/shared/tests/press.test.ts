import { describe, expect, it } from "vitest";

import {
  DEFAULT_PRESS_CONTENT,
  PressConfigPatchSchema,
  PressContentSchema,
  inferService,
} from "../src/index.js";

const release = {
  slug: "the-illusionist",
  title: "The Illusionist",
  personnel: [],
  fcc: "clean" as const,
};

const v1Content = {
  enabled: true,
  shortBio: "A live v1 press page",
  longBio: null,
  forFansOf: ["Alternative"],
  streamingLinks: [
    { label: "Spotify", url: "https://open.spotify.com/track/example" },
    { label: "Site", url: "https://example.com/listen" },
  ],
  liveDatesUrl: null,
  standoutTrack: {
    title: "The Standout",
    url: "https://open.spotify.com/track/example",
    streamsLabel: "14k streams",
  },
  pressContactEmail: "press@example.com",
  location: "Philadelphia, PA",
  photos: ["creators/creator-1/press/hero.jpg"],
  releases: [release],
};

describe("PressContentSchema", () => {
  it.each(["", "Not A Slug", "has_underscore"])(
    "rejects invalid release slug %j",
    (slug) => {
      const result = PressContentSchema.safeParse({
        standoutTrack: null,
        releases: [{ ...release, slug }],
      });

      expect(result.success).toBe(false);
    },
  );

  it("rejects duplicate release slugs", () => {
    const result = PressContentSchema.safeParse({
      standoutTrack: null,
      releases: [release, { ...release, title: "Duplicate" }],
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues).toEqual(
        expect.arrayContaining([expect.objectContaining({ path: ["releases"] })]),
      );
    }
  });

  it("parses a real v1 payload as the additive v2 superset", () => {
    const content = PressContentSchema.parse(v1Content);

    expect(content.template).toBe("A");
    expect(content.members).toEqual([]);
    expect(content.highlights).toEqual([]);
    expect(content.gallery).toEqual([]);
    expect(content.streamingLinks).toEqual([
      {
        service: "spotify",
        label: "Spotify",
        url: "https://open.spotify.com/track/example",
      },
      {
        service: "website",
        label: "Site",
        url: "https://example.com/listen",
      },
    ]);
    expect(content.photos).toEqual(v1Content.photos);
  });

  it("accepts a v2 link without service while retaining its required label", () => {
    const content = PressContentSchema.parse({
      streamingLinks: [{ label: "My site", url: "https://example.com/listen" }],
    });

    expect(content.streamingLinks).toEqual([
      { label: "My site", url: "https://example.com/listen", service: "website" },
    ]);
    expect(content.streamingLinks[0]?.label).toBe("My site");
  });

  it("round-trips the default content through the evolved schema", () => {
    expect(PressContentSchema.parse(DEFAULT_PRESS_CONTENT)).toEqual(DEFAULT_PRESS_CONTENT);
  });

  it("accepts both v1 and v2 partial patches without injecting defaults", () => {
    expect(
      PressConfigPatchSchema.parse({
        photos: ["creators/creator-1/press/hero.jpg"],
        standoutTrack: null,
      }),
    ).toEqual({
      photos: ["creators/creator-1/press/hero.jpg"],
      standoutTrack: null,
    });

    expect(
      PressConfigPatchSchema.parse({
        template: "B",
        tagline: "Socially conscious alternative",
        banner: { key: "creators/creator-1/press/banner.jpg", alt: "Band portrait" },
        members: [{ name: "Alex", role: "Vocals" }],
        gallery: [{ key: "creators/creator-1/press/gallery.jpg", alt: "Live performance" }],
      }),
    ).toMatchObject({ template: "B", members: [{ name: "Alex" }] });
  });
});

describe("inferService", () => {
  it.each([
    ["https://open.spotify.com/track/example", "spotify"],
    ["https://music.apple.com/us/album/example", "apple-music"],
    ["https://music.amazon.com/albums/example", "amazon-music"],
    ["https://www.youtube.com/watch?v=example", "youtube"],
    ["https://youtu.be/example", "youtube"],
    ["https://artist.bandcamp.com/track/example", "bandcamp"],
    ["https://soundcloud.com/artist/example", "soundcloud"],
    ["https://listen.tidal.com/track/example", "tidal"],
    ["https://example.com/listen", "website"],
  ] as const)("maps %s to %s", (url, service) => {
    expect(inferService(url)).toBe(service);
  });
});
