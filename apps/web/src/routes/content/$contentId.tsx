import type React from "react";
import { createFileRoute, redirect, type SearchSchemaInput } from "@tanstack/react-router";
import type { FeedItem, SubscriptionPlan } from "@snc/shared";

import { RouteErrorBoundary } from "../../components/error/route-error-boundary.js";
import { ComingSoon } from "../../components/coming-soon/coming-soon.js";
import { ContentDetail } from "../../components/content/content-detail.js";
import { fetchApiServer } from "../../lib/api-server.js";
import { isFeatureEnabled } from "../../lib/config.js";
import { fetchLockedContentPlans, resolveCanManage } from "../../lib/content-loader.js";

// ── Private Types ──

export interface ContentDetailLoaderData {
  readonly item: FeedItem | null;
  readonly plans: readonly SubscriptionPlan[];
  readonly canManage: boolean;
}

// ── Route ──

export const Route = createFileRoute("/content/$contentId")({
  errorComponent: RouteErrorBoundary,
  validateSearch: (search: { edit?: string | boolean } & SearchSchemaInput) => ({
    edit: search.edit === "true" || search.edit === true,
  }),
  loader: async ({ params }): Promise<ContentDetailLoaderData> => {
    if (!isFeatureEnabled("content")) return { item: null, plans: [], canManage: false };

    const item = (await fetchApiServer({
      data: `/api/content/${encodeURIComponent(params.contentId)}`,
    })) as FeedItem;

    if (item.creatorHandle && item.slug) {
      throw redirect({
        to: "/content/$creatorSlug/$contentSlug",
        params: { creatorSlug: item.creatorHandle, contentSlug: item.slug },
        statusCode: 301,
      });
    }

    const [plans, canManage] = await Promise.all([
      fetchLockedContentPlans(item),
      resolveCanManage(item.creatorId),
    ]);

    return { item, plans, canManage };
  },
  component: ContentDetailPage,
});

// ── Component ──

function ContentDetailPage(): React.ReactElement {
  const { item, plans, canManage } = Route.useLoaderData();
  const { edit } = Route.useSearch();
  if (!isFeatureEnabled("content") || item === null) return <ComingSoon feature="content" />;
  return <ContentDetail item={item} plans={plans} canManage={canManage} initialEdit={edit && canManage} />;
}
