import { createFileRoute, Link } from "@tanstack/react-router";
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
import { API_BASE_URL } from "../../lib/config.js";
import { useSession } from "../../lib/auth.js";
import { fetchProducts } from "../../lib/merch.js";
import { fetchPlans, fetchMySubscriptions } from "../../lib/subscription.js";
import styles from "./creator-detail.module.css";

// ── Route ──

export const Route = createFileRoute("/creators/$creatorId")({
  loader: async ({ params }): Promise<CreatorProfileResponse> => {
    const res = await fetch(
      `${API_BASE_URL}/api/creators/${params.creatorId}`,
    );
    if (!res.ok) {
      throw new Error("Creator not found");
    }
    return (await res.json()) as CreatorProfileResponse;
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

  // Fetch creator's subscription plans on mount
  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const plans = await fetchPlans({ creatorId: creator.userId });
        if (!cancelled) {
          setCreatorPlans(plans);
        }
      } catch {
        // Plans fetch failure is non-critical — subscribe button simply won't show
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [creator.userId]);

  // Determine if the current user is subscribed to this creator
  useEffect(() => {
    if (!session.data) {
      setIsSubscribed(false);
      return;
    }

    let cancelled = false;

    const check = async () => {
      try {
        const subscriptions = await fetchMySubscriptions();
        if (cancelled) return;
        const subscribed = subscriptions.some(
          (sub) =>
            sub.status === "active" &&
            (sub.plan.type === "platform" ||
              (sub.plan.type === "creator" &&
                sub.plan.creatorId === creator.userId)),
        );
        setIsSubscribed(subscribed);
      } catch {
        // Subscription check failure is non-critical
      }
    };

    void check();

    return () => {
      cancelled = true;
    };
  }, [session.data, creator.userId]);

  // Fetch creator's merch products on mount
  useEffect(() => {
    let cancelled = false;

    const loadMerch = async () => {
      try {
        const response = await fetchProducts({
          creatorId: creator.userId,
          limit: 6,
        });
        if (!cancelled) {
          setMerchProducts(response.items);
        }
      } catch {
        // Merch fetch failure is non-critical — section stays hidden
      }
    };

    void loadMerch();

    return () => {
      cancelled = true;
    };
  }, [creator.userId]);

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

  const handleLoadMore = loadMore;

  return (
    <div className={styles.detailPage}>
      <CreatorHeader
        creator={creator}
        plans={creatorPlans}
        isSubscribed={isSubscribed}
      />

      {/* Content Section */}
      <section className={styles.section}>
        <h2 className={styles.sectionHeading}>Content</h2>
        <FilterBar
          activeFilter={activeFilter}
          onFilterChange={handleFilterChange}
        />
        {isLoading && items.length === 0 ? (
          <p className={styles.status}>Loading...</p>
        ) : items.length === 0 ? (
          <p className={styles.status}>No content yet.</p>
        ) : (
          <>
            <div className="content-grid">
              {items.map((item) => (
                <ContentCard key={item.id} item={item} />
              ))}
            </div>
            {nextCursor && (
              <div className={styles.loadMoreWrapper}>
                <button
                  type="button"
                  className={styles.loadMoreButton}
                  onClick={handleLoadMore}
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
        <section className={styles.section}>
          <h2 className={styles.sectionHeading}>Merch</h2>
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
  const url = new URL(`${API_BASE_URL}/api/content`);
  url.searchParams.set("creatorId", creatorId);
  url.searchParams.set("limit", String(limit));
  if (filter) {
    url.searchParams.set("type", filter);
  }
  if (cursor) {
    url.searchParams.set("cursor", cursor);
  }
  return url.toString();
}
