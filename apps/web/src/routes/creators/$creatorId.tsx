import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import type React from "react";
import type {
  ContentType,
  CreatorProfileResponse,
  FeedItem,
  MerchProduct,
  SubscriptionPlan,
} from "@snc/shared";

import { SocialLinksSection } from "../../components/social-links/social-links-section.js";
import { ContentCard } from "../../components/content/content-card.js";
import { FilterBar } from "../../components/content/filter-bar.js";
import { CreatorHeader } from "../../components/creator/creator-header.js";
import { ProductCard } from "../../components/merch/product-card.js";
import { useCursorPagination } from "../../hooks/use-cursor-pagination.js";
import { fetchApiServer } from "../../lib/api-server.js";
import { useSession } from "../../lib/auth.js";
import { isFeatureEnabled } from "../../lib/config.js";
import { fetchProducts } from "../../lib/merch.js";
import { fetchPlans, fetchMySubscriptions } from "../../lib/subscription.js";
import styles from "./creator-detail.module.css";
import sectionStyles from "../../styles/detail-section.module.css";
import listingStyles from "../../styles/listing-page.module.css";

// ── Route ──

export const Route = createFileRoute("/creators/$creatorId")({
  beforeLoad: () => {
    if (!isFeatureEnabled("creator")) throw redirect({ to: "/" });
  },
  loader: async ({ params }): Promise<CreatorProfileResponse> => {
    return fetchApiServer({
      data: `/api/creators/${encodeURIComponent(params.creatorId)}`,
    }) as Promise<CreatorProfileResponse>;
  },
  component: CreatorDetailPage,
});

// ── Component ──

function CreatorDetailPage(): React.ReactElement {
  const creator = Route.useLoaderData();
  const session = useSession();
  const [activeFilter, setActiveFilter] = useState<ContentType | null>(null);
  const [creatorPlans, setCreatorPlans] = useState<SubscriptionPlan[]>([]);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [merchProducts, setMerchProducts] = useState<MerchProduct[]>([]);

  // Fetch supplementary data in parallel (all non-critical)
  useEffect(() => {
    let cancelled = false;

    const loadSupplementary = async () => {
      const [plansResult, subscriptionsResult, merchResult] =
        await Promise.allSettled([
          fetchPlans({ creatorId: creator.userId }),
          session.data
            ? fetchMySubscriptions()
            : Promise.resolve(
                [] as Awaited<ReturnType<typeof fetchMySubscriptions>>,
              ),
          fetchProducts({ creatorId: creator.userId, limit: 6 }),
        ]);

      if (cancelled) return;

      if (plansResult.status === "fulfilled") {
        setCreatorPlans(plansResult.value);
      }

      if (subscriptionsResult.status === "fulfilled") {
        const subs = subscriptionsResult.value;
        const subscribed = subs.some(
          (sub) =>
            sub.status === "active" &&
            (sub.plan.type === "platform" ||
              (sub.plan.type === "creator" &&
                sub.plan.creatorId === creator.userId)),
        );
        setIsSubscribed(subscribed);
      }

      if (merchResult.status === "fulfilled") {
        setMerchProducts(merchResult.value.items);
      }
    };

    void loadSupplementary();

    return () => {
      cancelled = true;
    };
  }, [creator.userId, session.data]);

  const { items, nextCursor, isLoading, loadMore } =
    useCursorPagination<FeedItem>({
      buildUrl: (cursor) =>
        buildContentUrl({
          creatorId: creator.userId,
          filter: activeFilter,
          cursor,
          limit: 12,
        }),
      deps: [activeFilter, creator.userId],
    });

  const handleFilterChange = (filter: ContentType | null) => {
    setActiveFilter(filter);
  };

  return (
    <div className={styles.detailPage}>
      <CreatorHeader
        creator={creator}
        plans={creatorPlans}
        isSubscribed={isSubscribed}
      />

      {/* Content Section */}
      <section className={`${sectionStyles.section} ${styles.section}`}>
        <h2 className={`${sectionStyles.sectionHeading} ${styles.sectionHeading}`}>Content</h2>
        <FilterBar
          activeFilter={activeFilter}
          onFilterChange={handleFilterChange}
        />
        {isLoading && items.length === 0 ? (
          <p className={listingStyles.status}>Loading...</p>
        ) : items.length === 0 ? (
          <p className={listingStyles.status}>No content yet.</p>
        ) : (
          <>
            <div className="content-grid">
              {items.map((item) => (
                <ContentCard key={item.id} item={item} />
              ))}
            </div>
            {nextCursor && (
              <div className={listingStyles.loadMoreWrapper}>
                <button
                  type="button"
                  className={listingStyles.loadMoreButton}
                  onClick={loadMore}
                  disabled={isLoading}
                >
                  {isLoading ? "Loading..." : "Load more"}
                </button>
              </div>
            )}
          </>
        )}
      </section>

      <SocialLinksSection socialLinks={creator.socialLinks} />

      {/* Merch Section */}
      {merchProducts.length > 0 && (
        <section className={`${sectionStyles.section} ${styles.section}`}>
          <h2 className={`${sectionStyles.sectionHeading} ${styles.sectionHeading}`}>Merch</h2>
          <div className="content-grid">
            {merchProducts.map((product) => (
              <ProductCard key={product.handle} product={product} />
            ))}
          </div>
          <Link
            to="/merch"
            search={{ creatorId: creator.userId }}
            className={styles.viewAllLink}
          >
            View all merch
          </Link>
        </section>
      )}
    </div>
  );
}

// ── Private Helpers ──

function buildContentUrl({
  creatorId,
  filter,
  cursor,
  limit,
}: {
  creatorId: string;
  filter: ContentType | null;
  cursor: string | null;
  limit: number;
}): string {
  const params = new URLSearchParams();
  params.set("creatorId", creatorId);
  params.set("limit", String(limit));
  if (filter) {
    params.set("type", filter);
  }
  if (cursor) {
    params.set("cursor", cursor);
  }
  return `/api/content?${params.toString()}`;
}
