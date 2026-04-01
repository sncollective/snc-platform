import type React from "react";
import { createFileRoute } from "@tanstack/react-router";
import type { FeedItem, SubscriptionPlan } from "@snc/shared";

import { RouteErrorBoundary } from "../../../components/error/route-error-boundary.js";
import { ContentDetail } from "../../../components/content/content-detail.js";
import { fetchApiServer, fetchAuthStateServer } from "../../../lib/api-server.js";
import { fetchLockedContentPlans, resolveCanManage } from "../../../lib/content-loader.js";
import { buildContentJsonLd } from "../../../lib/json-ld.js";

// ── Route Types ──

export interface SlugContentDetailLoaderData {
  readonly item: FeedItem | null;
  readonly plans: readonly SubscriptionPlan[];
  readonly canManage: boolean;
}

// ── Route ──

export const Route = createFileRoute("/content/$creatorSlug/$contentSlug")({
  errorComponent: RouteErrorBoundary,
  loader: async ({ params }): Promise<SlugContentDetailLoaderData> => {
    const item = (await fetchApiServer({
      data: `/api/content/by-creator/${encodeURIComponent(params.creatorSlug)}/${encodeURIComponent(params.contentSlug)}`,
    })) as FeedItem;

    // Block drafts from public access
    if (!item.publishedAt) {
      throw new Error("Not found");
    }

    const [plans, authState] = await Promise.all([
      fetchLockedContentPlans(item),
      fetchAuthStateServer(),
    ]);
    const canManage = await resolveCanManage(item.creatorId, authState);

    return { item, plans, canManage };
  },
  head: ({ loaderData }) => {
    if (!loaderData?.item) return {};
    const { item } = loaderData;
    const siteUrl = import.meta.env.VITE_SITE_URL ?? "";
    return {
      meta: [
        { title: `${item.title} — S/NC` },
        { name: "description", content: item.description ?? "" },
        { property: "og:title", content: item.title },
        { property: "og:description", content: item.description ?? "" },
        { property: "og:type", content: "article" },
        { property: "og:url", content: `${siteUrl}/content/${item.creatorHandle}/${item.slug}` },
        ...(item.thumbnailUrl
          ? [{ property: "og:image", content: `${siteUrl}${item.thumbnailUrl}` }]
          : []),
      ],
      links: [
        { rel: "canonical", href: `${siteUrl}/content/${item.creatorHandle}/${item.slug}` },
      ],
      scripts: [
        {
          type: "application/ld+json",
          children: JSON.stringify(buildContentJsonLd(item, siteUrl)),
        },
      ],
    };
  },
  component: SlugContentDetailPage,
});

// ── Component ──

function SlugContentDetailPage(): React.ReactElement {
  const { item, plans, canManage } = Route.useLoaderData();
  if (item === null) return <></>;
  return <ContentDetail item={item} plans={plans} canManage={canManage} />;
}
