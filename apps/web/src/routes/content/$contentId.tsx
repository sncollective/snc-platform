import type React from "react";
import { createFileRoute, redirect } from "@tanstack/react-router";
import type { FeedItem, SubscriptionPlan } from "@snc/shared";

import { RouteErrorBoundary } from "../../components/error/route-error-boundary.js";
import { ComingSoon } from "../../components/coming-soon/coming-soon.js";
import { ContentDetail } from "../../components/content/content-detail.js";
import { fetchApiServer, fetchAuthStateServer } from "../../lib/api-server.js";
import { isFeatureEnabled } from "../../lib/config.js";
import { fetchLockedContentPlans, resolveCanManage } from "../../lib/content-loader.js";
import { buildContentJsonLd } from "../../lib/json-ld.js";

// ── Route Types ──

export interface ContentDetailLoaderData {
  readonly item: FeedItem | null;
  readonly plans: readonly SubscriptionPlan[];
  readonly canManage: boolean;
}

// ── Route ──

export const Route = createFileRoute("/content/$contentId")({
  errorComponent: RouteErrorBoundary,
  loader: async ({ params }): Promise<ContentDetailLoaderData> => {
    if (!isFeatureEnabled("content")) return { item: null, plans: [], canManage: false };

    const item = (await fetchApiServer({
      data: `/api/content/${encodeURIComponent(params.contentId)}`,
    })) as FeedItem;

    // Block drafts from public access
    if (!item.publishedAt) {
      throw new Error("Not found");
    }

    if (item.creatorHandle && item.slug) {
      throw redirect({
        to: "/content/$creatorSlug/$contentSlug",
        params: { creatorSlug: item.creatorHandle, contentSlug: item.slug },
        statusCode: 301,
      });
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
    const canonicalPath = item.creatorHandle && item.slug
      ? `/content/${item.creatorHandle}/${item.slug}`
      : `/content/${item.id}`;
    const canonicalUrl = `${siteUrl}${canonicalPath}`;
    return {
      meta: [
        { title: `${item.title} — S/NC` },
        { name: "description", content: item.description ?? "" },
        { property: "og:title", content: item.title },
        { property: "og:description", content: item.description ?? "" },
        { property: "og:type", content: "article" },
        { property: "og:url", content: canonicalUrl },
        ...(item.thumbnailUrl
          ? [{ property: "og:image", content: `${siteUrl}${item.thumbnailUrl}` }]
          : []),
      ],
      links: [
        { rel: "canonical", href: canonicalUrl },
      ],
      scripts: [
        {
          type: "application/ld+json",
          children: JSON.stringify(buildContentJsonLd(item, siteUrl)),
        },
      ],
    };
  },
  component: ContentDetailPage,
});

// ── Component ──

function ContentDetailPage(): React.ReactElement {
  const { item, plans, canManage } = Route.useLoaderData();
  if (!isFeatureEnabled("content") || item === null) return <ComingSoon feature="content" />;
  return <ContentDetail item={item} plans={plans} canManage={canManage} />;
}
