import type { FeedItem, CreatorProfileResponse, MerchProductDetail } from "@snc/shared";

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
export function buildContentJsonLd(item: FeedItem, siteUrl: string): Record<string, unknown> {
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
        };
      }

      return { ...mediaBase, "@type": "AudioObject" as const };
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
      };
    default: {
      const _exhaustive: never = item.type;
      return _exhaustive;
    }
  }
}

/** Build Schema.org Person structured data for a creator profile. */
export function buildCreatorJsonLd(creator: CreatorProfileResponse, siteUrl: string): Record<string, unknown> {
  const canonicalSlug = creator.handle ?? creator.id;
  return {
    "@context": "https://schema.org",
    "@type": "Person",
    name: creator.displayName,
    description: creator.bio ?? undefined,
    image: creator.avatarUrl ? `${siteUrl}${creator.avatarUrl}` : undefined,
    url: `${siteUrl}/creators/${canonicalSlug}`,
    sameAs: creator.socialLinks.length > 0 ? creator.socialLinks.map((l) => l.url) : undefined,
  };
}

/** Build Schema.org Product structured data for a merch product. */
export function buildProductJsonLd(product: MerchProductDetail, siteUrl: string): Record<string, unknown> {
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
  };
}
