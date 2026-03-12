import { createFileRoute } from "@tanstack/react-router";
import type React from "react";
import type { CreatorListResponse, FeedResponse, SubscriptionPlan } from "@snc/shared";

import { fetchApiServer } from "../lib/api-server.js";
import { isFeatureEnabled } from "../lib/config.js";
import { HeroSection } from "../components/landing/hero-section.js";
import { FeaturedCreators } from "../components/landing/featured-creators.js";
import { RecentContent } from "../components/landing/recent-content.js";
import { LandingPricing } from "../components/landing/landing-pricing.js";

interface LandingData {
  creators: CreatorListResponse["items"];
  recentContent: FeedResponse["items"];
  plans: SubscriptionPlan[];
}

export const Route = createFileRoute("/")({
  loader: async (): Promise<LandingData> => {
    const [creators, recentContent, plans] = await Promise.all([
      isFeatureEnabled("creator")
        ? (
            fetchApiServer({
              data: "/api/creators?limit=8",
            }) as Promise<CreatorListResponse>
          )
            .then((r) => r.items)
            .catch(() => [] as CreatorListResponse["items"])
        : ([] as CreatorListResponse["items"]),
      isFeatureEnabled("content")
        ? (
            fetchApiServer({
              data: "/api/content?limit=6",
            }) as Promise<FeedResponse>
          )
            .then((r) => r.items)
            .catch(() => [] as FeedResponse["items"])
        : ([] as FeedResponse["items"]),
      isFeatureEnabled("subscription")
        ? (
            fetchApiServer({
              data: "/api/subscriptions/plans?type=platform",
            }) as Promise<{ plans: SubscriptionPlan[] }>
          )
            .then((r) => r.plans)
            .catch(() => [] as SubscriptionPlan[])
        : ([] as SubscriptionPlan[]),
    ]);
    return { creators, recentContent, plans };
  },
  component: LandingPage,
});

function LandingPage(): React.ReactElement {
  const data = Route.useLoaderData();
  return (
    <>
      <HeroSection plans={data.plans} />
      {isFeatureEnabled("creator") && <FeaturedCreators creators={data.creators} />}
      {isFeatureEnabled("content") && <RecentContent items={data.recentContent} />}
      {isFeatureEnabled("subscription") && <LandingPricing plans={data.plans} />}
    </>
  );
}
