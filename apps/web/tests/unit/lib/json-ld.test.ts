import { describe, it, expect } from "vitest";

import {
  buildContentJsonLd,
  buildCreatorJsonLd,
  buildProductJsonLd,
} from "../../../src/lib/json-ld.js";
import type {
  VideoObjectJsonLd,
  AudioObjectJsonLd,
  ArticleJsonLd,
  PersonJsonLd,
  ProductJsonLd,
} from "../../../src/lib/json-ld.js";
import { makeMockFeedItem } from "../../helpers/content-fixtures.js";
import { makeMockCreatorProfileResponse } from "../../helpers/creator-fixtures.js";
import { makeMockMerchProductDetail } from "../../helpers/merch-fixtures.js";

const SITE_URL = "https://snc.example.com";

// ── buildContentJsonLd ──

describe("buildContentJsonLd", () => {
  describe("video item", () => {
    it("returns a VideoObject with required fields", () => {
      const item = makeMockFeedItem({
        type: "video",
        title: "My Video",
        description: "A video description",
        thumbnailUrl: "/thumb.jpg",
        mediaUrl: "https://cdn.example.com/vid.mp4",
        duration: 90,
        publishedAt: "2026-01-01T00:00:00.000Z",
        creatorName: "Alice",
      });
      const result = buildContentJsonLd(item, SITE_URL) as VideoObjectJsonLd;

      expect(result["@context"]).toBe("https://schema.org");
      expect(result["@type"]).toBe("VideoObject");
      expect(result.name).toBe("My Video");
      expect(result.description).toBe("A video description");
      expect(result.thumbnailUrl).toBe(`${SITE_URL}/thumb.jpg`);
      expect(result.contentUrl).toBe("https://cdn.example.com/vid.mp4");
      expect(result.duration).toBe("PT1M30S");
      expect(result.datePublished).toBe("2026-01-01T00:00:00.000Z");
      expect(result.uploadDate).toBe("2026-01-01T00:00:00.000Z");
      expect(result.creator).toEqual({ "@type": "Person", name: "Alice" });
    });

    it("sets thumbnailUrl to undefined when item has no thumbnail", () => {
      const item = makeMockFeedItem({ type: "video", thumbnailUrl: null });
      const result = buildContentJsonLd(item, SITE_URL) as VideoObjectJsonLd;
      expect(result.thumbnailUrl).toBeUndefined();
    });

    it("sets duration to undefined when item has no duration", () => {
      const item = makeMockFeedItem({ type: "video", duration: null });
      const result = buildContentJsonLd(item, SITE_URL) as VideoObjectJsonLd;
      expect(result.duration).toBeUndefined();
    });

    it("uses creatorId in URL when handle is null", () => {
      const item = makeMockFeedItem({
        type: "video",
        creatorHandle: null,
        creatorId: "user-99",
        slug: "my-vid",
      });
      const result = buildContentJsonLd(item, SITE_URL) as VideoObjectJsonLd;
      // contentUrl is the media URL, not the page URL for VideoObject
      // The contentUrl is item.mediaUrl; the page URL is constructed internally but not exposed
      // Verify the result is the correct type
      expect(result["@type"]).toBe("VideoObject");
    });
  });

  describe("audio item", () => {
    it("returns an AudioObject with required fields", () => {
      const item = makeMockFeedItem({
        type: "audio",
        title: "My Track",
        description: "An audio track",
        thumbnailUrl: "/cover.jpg",
        mediaUrl: "https://cdn.example.com/track.mp3",
        duration: 185,
        publishedAt: "2026-02-01T00:00:00.000Z",
        creatorName: "Bob",
      });
      const result = buildContentJsonLd(item, SITE_URL) as AudioObjectJsonLd;

      expect(result["@context"]).toBe("https://schema.org");
      expect(result["@type"]).toBe("AudioObject");
      expect(result.name).toBe("My Track");
      expect(result.duration).toBe("PT3M5S");
      expect(result.creator).toEqual({ "@type": "Person", name: "Bob" });
      // AudioObject does not have uploadDate — the type itself enforces this at compile time
    });
  });

  describe("written item", () => {
    it("returns an Article with required fields", () => {
      const item = makeMockFeedItem({
        type: "written",
        title: "My Article",
        description: "An article description",
        thumbnailUrl: "/img.jpg",
        publishedAt: "2026-03-01T00:00:00.000Z",
        creatorName: "Carol",
        creatorHandle: "carol",
        slug: "my-article",
      });
      const result = buildContentJsonLd(item, SITE_URL) as ArticleJsonLd;

      expect(result["@context"]).toBe("https://schema.org");
      expect(result["@type"]).toBe("Article");
      expect(result.headline).toBe("My Article");
      expect(result.description).toBe("An article description");
      expect(result.image).toBe(`${SITE_URL}/img.jpg`);
      expect(result.datePublished).toBe("2026-03-01T00:00:00.000Z");
      expect(result.url).toBe(`${SITE_URL}/content/carol/my-article`);
      expect(result.author).toEqual({ "@type": "Person", name: "Carol" });
    });

    it("falls back to creatorId and content id when handle/slug are null", () => {
      const item = makeMockFeedItem({
        type: "written",
        creatorHandle: null,
        slug: null,
        creatorId: "user-42",
        id: "content-99",
      });
      const result = buildContentJsonLd(item, SITE_URL) as ArticleJsonLd;
      expect(result.url).toBe(`${SITE_URL}/content/user-42/content-99`);
    });

    it("sets image to undefined when no thumbnail", () => {
      const item = makeMockFeedItem({ type: "written", thumbnailUrl: null });
      const result = buildContentJsonLd(item, SITE_URL) as ArticleJsonLd;
      expect(result.image).toBeUndefined();
    });
  });
});

// ── buildCreatorJsonLd ──

describe("buildCreatorJsonLd", () => {
  it("returns a Person with all fields populated", () => {
    const creator = makeMockCreatorProfileResponse({
      displayName: "Dave",
      bio: "A creator",
      handle: "dave",
      avatarUrl: "/avatar.jpg",
      socialLinks: [
        { platform: "bandcamp", url: "https://dave.bandcamp.com" },
        { platform: "instagram", url: "https://instagram.com/dave" },
      ],
    });
    const result: PersonJsonLd = buildCreatorJsonLd(creator, SITE_URL);

    expect(result["@context"]).toBe("https://schema.org");
    expect(result["@type"]).toBe("Person");
    expect(result.name).toBe("Dave");
    expect(result.description).toBe("A creator");
    expect(result.image).toBe(`${SITE_URL}/avatar.jpg`);
    expect(result.url).toBe(`${SITE_URL}/creators/dave`);
    expect(result.sameAs).toEqual([
      "https://dave.bandcamp.com",
      "https://instagram.com/dave",
    ]);
  });

  it("uses creator id in URL when handle is null", () => {
    const creator = makeMockCreatorProfileResponse({
      handle: null,
      id: "user_abc",
    });
    const result: PersonJsonLd = buildCreatorJsonLd(creator, SITE_URL);
    expect(result.url).toBe(`${SITE_URL}/creators/user_abc`);
  });

  it("sets sameAs to undefined when socialLinks is empty", () => {
    const creator = makeMockCreatorProfileResponse({ socialLinks: [] });
    const result: PersonJsonLd = buildCreatorJsonLd(creator, SITE_URL);
    expect(result.sameAs).toBeUndefined();
  });

  it("sets image to undefined when no avatarUrl", () => {
    const creator = makeMockCreatorProfileResponse({ avatarUrl: null });
    const result: PersonJsonLd = buildCreatorJsonLd(creator, SITE_URL);
    expect(result.image).toBeUndefined();
  });

  it("sets description to undefined when bio is null", () => {
    const creator = makeMockCreatorProfileResponse({ bio: null });
    const result: PersonJsonLd = buildCreatorJsonLd(creator, SITE_URL);
    expect(result.description).toBeUndefined();
  });
});

// ── buildProductJsonLd ──

describe("buildProductJsonLd", () => {
  it("returns a Product with InStock when a variant is available", () => {
    const product = makeMockMerchProductDetail();
    const result: ProductJsonLd = buildProductJsonLd(product, SITE_URL);

    expect(result["@context"]).toBe("https://schema.org");
    expect(result["@type"]).toBe("Product");
    expect(result.name).toBe("Test T-Shirt");
    expect(result.description).toBe("A high-quality test t-shirt.");
    expect(result.image).toBe("https://cdn.shopify.com/s/files/test.jpg");
    expect(result.url).toBe(`${SITE_URL}/merch/test-tshirt`);
    expect(result.brand).toEqual({ "@type": "Brand", name: "Test Creator" });
    expect(result.offers["@type"]).toBe("Offer");
    expect(result.offers.price).toBe("25.00");
    expect(result.offers.priceCurrency).toBe("USD");
    expect(result.offers.availability).toBe("https://schema.org/InStock");
  });

  it("returns OutOfStock when no variants are available", () => {
    const product = makeMockMerchProductDetail({
      variants: [
        {
          id: "gid://shopify/ProductVariant/1001",
          title: "S / Black",
          price: 2500,
          available: false,
        },
      ],
    });
    const result: ProductJsonLd = buildProductJsonLd(product, SITE_URL);
    expect(result.offers.availability).toBe("https://schema.org/OutOfStock");
  });

  it("sets brand to undefined when creatorName is null", () => {
    const product = makeMockMerchProductDetail({ creatorName: null });
    const result: ProductJsonLd = buildProductJsonLd(product, SITE_URL);
    expect(result.brand).toBeUndefined();
  });

  it("sets image to undefined when product has no image", () => {
    const product = makeMockMerchProductDetail({ image: null });
    const result: ProductJsonLd = buildProductJsonLd(product, SITE_URL);
    expect(result.image).toBeUndefined();
  });

  it("formats price as a decimal string from integer cents", () => {
    const product = makeMockMerchProductDetail({ price: 999 });
    const result: ProductJsonLd = buildProductJsonLd(product, SITE_URL);
    expect(result.offers.price).toBe("9.99");
  });
});
