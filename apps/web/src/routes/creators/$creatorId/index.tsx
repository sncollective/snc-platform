import type React from "react";
import { useState, useEffect } from "react";
import { createFileRoute, getRouteApi, Link } from "@tanstack/react-router";
import { clsx } from "clsx/lite";
import { FileText } from "lucide-react";

import type {
  ContentType,
  CreatorProfileResponse,
  FeedItem,
  MerchProduct,
  SubscriptionPlan,
} from "@snc/shared";

import { SocialLinksSection } from "../../../components/social-links/social-links-section.js";
import { ContentCard } from "../../../components/content/content-card.js";
import { FilterBar } from "../../../components/content/filter-bar.js";
import { CreatorHeader } from "../../../components/creator/creator-header.js";
import { ProductCard } from "../../../components/merch/product-card.js";
import { useCursorPagination } from "../../../hooks/use-cursor-pagination.js";
import { useSession, fetchAuthState, GUEST_AUTH_STATE } from "../../../lib/auth.js";
import { buildContentListUrl } from "../../../lib/content-url.js";
import { fetchProducts } from "../../../lib/merch.js";
import { fetchPlans, fetchMySubscriptions } from "../../../lib/subscription.js";
import styles from "../creator-detail.module.css";
import sectionStyles from "../../../styles/detail-section.module.css";
import listingStyles from "../../../styles/listing-page.module.css";

// ── Route ──

const parentRoute = getRouteApi("/creators/$creatorId");

export const Route = createFileRoute("/creators/$creatorId/")({
  head: () => ({
    meta: [{ title: "Creator — S/NC" }],
  }),
  component: CreatorDetailPage,
});

// ── Component ──

function CreatorDetailPage(): React.ReactElement | null {
  const creator = parentRoute.useLoaderData() as CreatorProfileResponse | null;
  const creatorId = creator?.id ?? "";
  const session = useSession();
  const [activeFilter, setActiveFilter] = useState<ContentType | null>(null);
  const [creatorPlans, setCreatorPlans] = useState<SubscriptionPlan[]>([]);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [merchProducts, setMerchProducts] = useState<MerchProduct[]>([]);
  const [canManage, setCanManage] = useState(false);

  // Fetch supplementary data in parallel (all non-critical)
  useEffect(() => {
    if (creatorId === "") return;
    let cancelled = false;

    const loadSupplementary = async () => {
      const [plansResult, subscriptionsResult, merchResult, authResult] =
        await Promise.allSettled([
          fetchPlans({ creatorId }),
          session.data
            ? fetchMySubscriptions()
            : Promise.resolve(
                [] as Awaited<ReturnType<typeof fetchMySubscriptions>>,
              ),
          fetchProducts({ creatorId, limit: 6 }),
          session.data
            ? fetchAuthState()
            : Promise.resolve(GUEST_AUTH_STATE),
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
                sub.plan.creatorId === creatorId)),
        );
        setIsSubscribed(subscribed);
      }

      if (merchResult.status === "fulfilled") {
        setMerchProducts(merchResult.value.items);
      }

      if (authResult.status === "fulfilled") {
        const { roles } = authResult.value;
        setCanManage(roles.includes("stakeholder") || roles.includes("admin"));
      }
    };

    void loadSupplementary();

    return () => {
      cancelled = true;
    };
  }, [creatorId, session.data]);

  const { items, nextCursor, isLoading, loadMore } =
    useCursorPagination<FeedItem>({
      buildUrl: (cursor) =>
        buildContentListUrl("/api/content", {
          creatorId,
          type: activeFilter,
          cursor,
        }),
      deps: [activeFilter, creatorId],
    });

  const handleFilterChange = (filter: ContentType | null) => {
    setActiveFilter(filter);
  };

  if (creator === null) return null;

  return (
    <div className={styles.detailPage}>
      <CreatorHeader
        creator={creator}
        plans={creatorPlans}
        isSubscribed={isSubscribed}
        canManage={canManage}
      />

      {/* Content Section */}
      <section className={clsx(sectionStyles.section, styles.section)}>
        <h2 className={clsx(sectionStyles.sectionHeading, styles.sectionHeading)}>Content</h2>
        <FilterBar
          activeFilter={activeFilter}
          onFilterChange={handleFilterChange}
        />
        {isLoading && items.length === 0 ? (
          <p className={listingStyles.status}>Loading...</p>
        ) : items.length === 0 ? (
          <div className={listingStyles.empty}>
            <FileText size={32} aria-hidden="true" />
            <p>No content yet.</p>
          </div>
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
        <section className={clsx(sectionStyles.section, styles.section)}>
          <h2 className={clsx(sectionStyles.sectionHeading, styles.sectionHeading)}>Merch</h2>
          <div className="content-grid">
            {merchProducts.map((product) => (
              <ProductCard key={product.handle} product={product} />
            ))}
          </div>
          <Link
            to="/merch"
            search={{ creatorId: creator.id }}
            className={styles.viewAllLink}
          >
            View all merch
          </Link>
        </section>
      )}
    </div>
  );
}

