import { createFileRoute } from "@tanstack/react-router";
import { useNavigate } from "@tanstack/react-router";
import type React from "react";
import { useState, useCallback } from "react";
import type {
  CreatorListResponse,
  FeedResponse,
  SubscriptionPlan,
  ChannelListResponse,
  UpcomingEventsResponse,
  UpcomingEvent,
} from "@snc/shared";

import { RouteErrorBoundary } from "../components/error/route-error-boundary.js";
import { fetchApiServer } from "../lib/api-server.js";
import { isFeatureEnabled } from "../lib/config.js";
import { ssrLogger } from "../lib/logger.js";
import { apiMutate } from "../lib/fetch-utils.js";
import { usePlatformAuth } from "../hooks/use-platform-auth.js";
import { HeroSection } from "../components/landing/hero-section.js";
import { WhatsOn } from "../components/landing/whats-on.js";
import { RecentContent } from "../components/landing/recent-content.js";
import { ComingUp } from "../components/landing/coming-up.js";
import { FeaturedCreators } from "../components/landing/featured-creators.js";
import { LandingPricing } from "../components/landing/landing-pricing.js";

export interface LandingData {
  creators: CreatorListResponse["items"];
  recentContent: FeedResponse["items"];
  plans: SubscriptionPlan[];
  channels: ChannelListResponse;
  upcomingEvents: UpcomingEventsResponse["items"];
}

export const Route = createFileRoute("/")({
  errorComponent: RouteErrorBoundary,
  loader: async (): Promise<LandingData> => {
    const [creators, recentContent, plans, channels, upcomingEvents] = await Promise.all([
      (
        fetchApiServer({
          data: "/api/creators?limit=8",
        }) as Promise<CreatorListResponse>
      )
        .then((r) => r.items)
        .catch((e: unknown) => {
          ssrLogger.warn({ error: e instanceof Error ? e.message : String(e) }, "Failed to load featured creators");
          return [] as CreatorListResponse["items"];
        }),
      (
        fetchApiServer({
          data: "/api/content?limit=6",
        }) as Promise<FeedResponse>
      )
        .then((r) => r.items)
        .catch((e: unknown) => {
          ssrLogger.warn({ error: e instanceof Error ? e.message : String(e) }, "Failed to load recent content");
          return [] as FeedResponse["items"];
        }),
      isFeatureEnabled("subscription")
        ? (
            fetchApiServer({
              data: "/api/subscriptions/plans?type=platform",
            }) as Promise<{ plans: SubscriptionPlan[] }>
          )
            .then((r) => r.plans)
            .catch((e: unknown) => {
              ssrLogger.warn({ error: e instanceof Error ? e.message : String(e) }, "Failed to load pricing plans");
              return [] as SubscriptionPlan[];
            })
        : ([] as SubscriptionPlan[]),
      // Streaming status (no auth needed)
      (fetchApiServer({ data: "/api/streaming/status" }) as Promise<ChannelListResponse>)
        .catch((e: unknown) => {
          ssrLogger.warn({ error: e instanceof Error ? e.message : String(e) }, "Failed to load streaming status");
          return { channels: [], defaultChannelId: null } as ChannelListResponse;
        }),
      // Upcoming events (no auth needed)
      (fetchApiServer({ data: "/api/events/upcoming?limit=5" }) as Promise<UpcomingEventsResponse>)
        .then((r) => r.items)
        .catch((e: unknown) => {
          ssrLogger.warn({ error: e instanceof Error ? e.message : String(e) }, "Failed to load upcoming events");
          return [] as UpcomingEventsResponse["items"];
        }),
    ]);
    return { creators, recentContent, plans, channels, upcomingEvents };
  },
  head: () => ({
    meta: [
      { title: "S/NC — Platform Cooperative for Media" },
      { name: "description", content: "A multi-stakeholder platform cooperative for media production and distribution." },
      { property: "og:title", content: "S/NC — Platform Cooperative for Media" },
      { property: "og:description", content: "A multi-stakeholder platform cooperative for media production and distribution." },
      { property: "og:type", content: "website" },
    ],
    links: [{ rel: "canonical", href: "https://snc.coop/" }],
  }),
  component: LandingPage,
});

function LandingPage(): React.ReactElement {
  const data = Route.useLoaderData();
  const navigate = useNavigate();
  const { isAuthenticated } = usePlatformAuth();

  const [events, setEvents] = useState<UpcomingEvent[]>(data.upcomingEvents);
  const [remindingEventId, setRemindingEventId] = useState<string | null>(null);

  const handleToggleRemind = useCallback(
    async (eventId: string) => {
      if (!isAuthenticated) {
        void navigate({ to: "/login" });
        return;
      }

      const prev = events;
      setRemindingEventId(eventId);

      // Optimistic update
      setEvents((current) =>
        current.map((e) => (e.id === eventId ? { ...e, reminded: !e.reminded } : e)),
      );

      try {
        const result = await apiMutate<{ reminded: boolean }>(
          `/api/events/${eventId}/remind`,
          { method: "POST" },
        );
        // Reconcile with server response
        setEvents((current) =>
          current.map((e) => (e.id === eventId ? { ...e, reminded: result.reminded } : e)),
        );
      } catch {
        // Revert optimistic update on error
        setEvents(prev);
      } finally {
        setRemindingEventId(null);
      }
    },
    [isAuthenticated, events, navigate],
  );

  return (
    <>
      <HeroSection plans={data.plans} />
      <WhatsOn channels={data.channels} />
      <RecentContent items={data.recentContent} />
      <ComingUp
        events={events}
        onToggleRemind={(eventId) => void handleToggleRemind(eventId)}
        remindingEventId={remindingEventId}
      />
      <FeaturedCreators creators={data.creators} />
      {isFeatureEnabled("subscription") && <LandingPricing plans={data.plans} />}
    </>
  );
}
