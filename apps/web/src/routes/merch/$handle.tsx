import type React from "react";
import { createFileRoute, redirect } from "@tanstack/react-router";
import type { MerchProductDetail } from "@snc/shared";

import { RouteErrorBoundary } from "../../components/error/route-error-boundary.js";
import { ComingSoon } from "../../components/coming-soon/coming-soon.js";
import { ProductDetail } from "../../components/merch/product-detail.js";
import { fetchApiServer } from "../../lib/api-server.js";
import { isFeatureEnabled } from "../../lib/config.js";
import { buildProductJsonLd } from "../../lib/json-ld.js";

// ── Route ──

export const Route = createFileRoute("/merch/$handle")({
  errorComponent: RouteErrorBoundary,
  loader: async ({ params }): Promise<MerchProductDetail | null> => {
    if (!isFeatureEnabled("merch")) return null;
    try {
      return (await fetchApiServer({
        data: `/api/merch/${encodeURIComponent(params.handle)}`,
      })) as MerchProductDetail;
    } catch {
      throw redirect({ to: "/merch" });
    }
  },
  head: ({ loaderData }) => {
    if (!loaderData) return {};
    const siteUrl = import.meta.env.VITE_SITE_URL ?? "";
    return {
      meta: [
        { title: `${loaderData.title} — S/NC` },
        { name: "description", content: loaderData.description },
        { property: "og:title", content: loaderData.title },
        { property: "og:description", content: loaderData.description },
        { property: "og:type", content: "product" },
        { property: "og:url", content: `${siteUrl}/merch/${loaderData.handle}` },
        ...(loaderData.image
          ? [{ property: "og:image", content: loaderData.image.url }]
          : []),
      ],
      links: [
        { rel: "canonical", href: `${siteUrl}/merch/${loaderData.handle}` },
      ],
      scripts: [
        {
          type: "application/ld+json",
          children: JSON.stringify(buildProductJsonLd(loaderData, siteUrl)),
        },
      ],
    };
  },
  component: MerchDetailPage,
});

// ── Component ──

function MerchDetailPage(): React.ReactElement {
  const product = Route.useLoaderData();
  if (!isFeatureEnabled("merch") || product === null) return <ComingSoon feature="merch" />;
  return <ProductDetail product={product} />;
}
