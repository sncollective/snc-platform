import type React from "react";
import { createFileRoute } from "@tanstack/react-router";
import type { FeedItem, SubscriptionPlan } from "@snc/shared";

import { ComingSoon } from "../../components/coming-soon/coming-soon.js";
import { ContentDetail } from "../../components/content/content-detail.js";
import { fetchApiServer } from "../../lib/api-server.js";
import { isFeatureEnabled } from "../../lib/config.js";

// ── Private Types ──

export interface ContentDetailLoaderData {
  readonly item: FeedItem | null;
  readonly plans: readonly SubscriptionPlan[];
}

// ── Private Helpers ──

function isContentLocked(item: FeedItem): boolean {
  return item.visibility === "subscribers" && item.mediaUrl === null && item.body === null;
}

// ── Route ──

export const Route = createFileRoute("/content/$contentId")({
  loader: async ({ params }): Promise<ContentDetailLoaderData> => {
    if (!isFeatureEnabled("content")) return { item: null, plans: [] };

    const item = (await fetchApiServer({
      data: `/api/content/${encodeURIComponent(params.contentId)}`,
    })) as FeedItem;

    let plans: SubscriptionPlan[] = [];
    if (isContentLocked(item)) {
      try {
        const plansData = (await fetchApiServer({
          data: `/api/subscriptions/plans?creatorId=${encodeURIComponent(item.creatorId)}`,
        })) as { plans: SubscriptionPlan[] };
        plans = plansData.plans;
      } catch {
        // Plans fetch failure is non-fatal — SubscribeCta will show
        // the platform subscription fallback link instead
      }
    }

    return { item, plans };
  },
  component: ContentDetailPage,
});

// ── Component ──

function ContentDetailPage(): React.ReactElement {
  const { item, plans } = Route.useLoaderData();
  if (!isFeatureEnabled("content") || item === null) return <ComingSoon feature="content" />;
  return <ContentDetail item={item} plans={plans} />;
}
