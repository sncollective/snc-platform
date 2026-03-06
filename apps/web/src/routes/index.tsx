import { createFileRoute } from "@tanstack/react-router";
import type React from "react";
import type { CreatorListResponse, FeedResponse, SubscriptionPlan } from "@snc/shared";

import { fetchApiServer } from "../lib/api-server.js";
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
      (
        fetchApiServer({
          data: "/api/creators?limit=8",
        }) as Promise<CreatorListResponse>
      )
        .then((r) => r.items)
        .catch(() => [] as CreatorListResponse["items"]),
      (
        fetchApiServer({
          data: "/api/content?limit=6",
        }) as Promise<FeedResponse>
      )
        .then((r) => r.items)
        .catch(() => [] as FeedResponse["items"]),
      (
        fetchApiServer({
          data: "/api/subscriptions/plans?type=platform",
        }) as Promise<{ plans: SubscriptionPlan[] }>
      )
        .then((r) => r.plans)
        .catch(() => [] as SubscriptionPlan[]),
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
      <FeaturedCreators creators={data.creators} />
      <RecentContent items={data.recentContent} />
      <LandingPricing plans={data.plans} />
    </>
  );
}
