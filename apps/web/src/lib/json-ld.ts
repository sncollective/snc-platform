import type { FeedItem, CreatorProfileResponse, MerchProductDetail } from "@snc/shared";

// ── Schema.org JSON-LD Interfaces ──

/** Shared fields common to all Schema.org media objects (VideoObject, AudioObject). */
interface MediaObjectJsonLd {
  "@context": "https://schema.org";
  "@type": "VideoObject" | "AudioObject";
  name: string;
  description: string | undefined;
  thumbnailUrl: string | undefined;
  contentUrl: string | undefined;
  duration: string | undefined;
  datePublished: string | null | undefined;
  creator: { "@type": "Person"; name: string };
}

/** Schema.org VideoObject structured data. */
export interface VideoObjectJsonLd extends MediaObjectJsonLd {
  "@type": "VideoObject";
  uploadDate: string | null | undefined;
}

/** Schema.org AudioObject structured data. */
export interface AudioObjectJsonLd extends MediaObjectJsonLd {
  "@type": "AudioObject";
}

/** Schema.org Article structured data. */
export interface ArticleJsonLd {
  "@context": "https://schema.org";
  "@type": "Article";
  headline: string;
  description: string | undefined;
  image: string | undefined;
  datePublished: string | null | undefined;
  url: string;
  author: { "@type": "Person"; name: string };
}

/** Schema.org Person structured data for a creator profile. */
export interface PersonJsonLd {
  "@context": "https://schema.org";
  "@type": "Person";
  name: string;
  description: string | undefined;
  image: string | undefined;
  url: string;
  sameAs: string[] | undefined;
}

/** Schema.org Product structured data for a merch item. */
export interface ProductJsonLd {
  "@context": "https://schema.org";
  "@type": "Product";
  name: string;
  description: string;
  image: string | undefined;
  url: string;
  brand: { "@type": "Brand"; name: string } | undefined;
  offers: {
    "@type": "Offer";
    price: string;
    priceCurrency: "USD";
    availability: "https://schema.org/InStock" | "https://schema.org/OutOfStock";
  };
}

// ── Private Helpers ──

/** Convert a duration in seconds to ISO 8601 duration string (e.g. PT1M30S). */
function secondsToIsoDuration(seconds: number): string {
  const totalSeconds = Math.round(seconds);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;

  let iso = "PT";
  if (hours > 0) iso += `${hours}H`;
  if (minutes > 0) iso += `${minutes}M`;
  if (secs > 0 || (hours === 0 && minutes === 0)) iso += `${secs}S`;
  return iso;
}

// ── Public API ──

/** Build Schema.org structured data for a content item (VideoObject, AudioObject, or Article). */
export function buildContentJsonLd(item: FeedItem, siteUrl: string): VideoObjectJsonLd | AudioObjectJsonLd | ArticleJsonLd {
  const contentUrl = `${siteUrl}/content/${item.creatorHandle ?? item.creatorId}/${item.slug ?? item.id}`;

  switch (item.type) {
    case "video":
    case "audio": {
      const mediaBase = {
        "@context": "https://schema.org" as const,
        name: item.title,
        description: item.description ?? undefined,
        thumbnailUrl: item.thumbnailUrl ? `${siteUrl}${item.thumbnailUrl}` : undefined,
        contentUrl: item.mediaUrl ?? undefined,
        duration: item.duration != null ? secondsToIsoDuration(item.duration) : undefined,
        datePublished: item.publishedAt ?? undefined,
        creator: {
          "@type": "Person" as const,
          name: item.creatorName,
        },
      };

      if (item.type === "video") {
        return {
          ...mediaBase,
          "@type": "VideoObject" as const,
          uploadDate: item.publishedAt ?? undefined,
        } satisfies VideoObjectJsonLd;
      }

      return { ...mediaBase, "@type": "AudioObject" as const } satisfies AudioObjectJsonLd;
    }
    case "written":
      return {
        "@context": "https://schema.org",
        "@type": "Article",
        headline: item.title,
        description: item.description ?? undefined,
        image: item.thumbnailUrl ? `${siteUrl}${item.thumbnailUrl}` : undefined,
        datePublished: item.publishedAt ?? undefined,
        url: contentUrl,
        author: {
          "@type": "Person",
          name: item.creatorName,
        },
      } satisfies ArticleJsonLd;
    default: {
      const _exhaustive: never = item.type;
      return _exhaustive;
    }
  }
}

/** Build Schema.org Person structured data for a creator profile. */
export function buildCreatorJsonLd(creator: CreatorProfileResponse, siteUrl: string): PersonJsonLd {
  const canonicalSlug = creator.handle ?? creator.id;
  return {
    "@context": "https://schema.org",
    "@type": "Person",
    name: creator.displayName,
    description: creator.bio ?? undefined,
    image: creator.avatarUrl ? `${siteUrl}${creator.avatarUrl}` : undefined,
    url: `${siteUrl}/creators/${canonicalSlug}`,
    sameAs: creator.socialLinks.length > 0 ? creator.socialLinks.map((l) => l.url) : undefined,
  } satisfies PersonJsonLd;
}

/** Build Schema.org Product structured data for a merch product. */
export function buildProductJsonLd(product: MerchProductDetail, siteUrl: string): ProductJsonLd {
  const hasAvailable = product.variants.some((v) => v.available);
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.title,
    description: product.description,
    image: product.image?.url ?? undefined,
    url: `${siteUrl}/merch/${product.handle}`,
    brand: product.creatorName
      ? { "@type": "Brand", name: product.creatorName }
      : undefined,
    offers: {
      "@type": "Offer",
      price: (product.price / 100).toFixed(2),
      priceCurrency: "USD",
      availability: hasAvailable
        ? "https://schema.org/InStock"
        : "https://schema.org/OutOfStock",
    },
  } satisfies ProductJsonLd;
}
