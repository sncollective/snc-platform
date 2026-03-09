import type React from "react";
import { createFileRoute } from "@tanstack/react-router";
import type { FeedItem, SubscriptionPlan } from "@snc/shared";

import { ContentDetail } from "../../components/content/content-detail.js";
import { fetchApiServer } from "../../lib/api-server.js";

// ── Private Types ──

interface ContentDetailLoaderData {
  readonly item: FeedItem;
  readonly plans: readonly SubscriptionPlan[];
}

// ── Private Helpers ──

function isContentLocked(item: FeedItem): boolean {
  return item.visibility === "subscribers" && item.mediaUrl === null && item.body === null;
}

// ── Route ──

export const Route = createFileRoute("/content/$contentId")({
  loader: async ({ params }): Promise<ContentDetailLoaderData> => {
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
  return <ContentDetail item={item} plans={plans} />;
}
