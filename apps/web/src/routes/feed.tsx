import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import type React from "react";
import type { ContentType, FeedItem, FeedResponse } from "@snc/shared";

import { RouteErrorBoundary } from "../components/error/route-error-boundary.js";
import { ComingSoon } from "../components/coming-soon/coming-soon.js";
import { ContentCard } from "../components/content/content-card.js";
import { FilterBar } from "../components/content/filter-bar.js";
import { fetchApiServer } from "../lib/api-server.js";
import { useCursorPagination } from "../hooks/use-cursor-pagination.js";
import { isFeatureEnabled } from "../lib/config.js";
import styles from "./feed.module.css";
import listingStyles from "../styles/listing-page.module.css";

export const Route = createFileRoute("/feed")({
  errorComponent: RouteErrorBoundary,
  loader: async (): Promise<FeedResponse> => {
    if (!isFeatureEnabled("content")) return { items: [], nextCursor: null };
    try {
      return (await fetchApiServer({
        data: "/api/content?limit=12",
      })) as FeedResponse;
    } catch {
      return { items: [], nextCursor: null };
    }
  },
  component: FeedPage,
});

// ── Public API ──

function FeedPage(): React.ReactElement {
  if (!isFeatureEnabled("content")) return <ComingSoon feature="content" />;

  const loaderData = Route.useLoaderData();
  const [activeFilter, setActiveFilter] = useState<ContentType | null>(null);

  const { items, nextCursor, isLoading, loadMore } =
    useCursorPagination<FeedItem>({
      buildUrl: (cursor) =>
        buildFeedUrl({ filter: activeFilter, cursor, limit: 12 }),
      deps: [activeFilter],
      initialData: activeFilter === null ? loaderData : undefined,
    });

  const handleFilterChange = (filter: ContentType | null) => {
    setActiveFilter(filter);
  };

  return (
    <div className={styles.feedPage}>
      <h1 className={listingStyles.heading}>Content Feed</h1>
      <FilterBar activeFilter={activeFilter} onFilterChange={handleFilterChange} />
      {isLoading && items.length === 0 ? (
        <p className={listingStyles.status}>Loading...</p>
      ) : items.length === 0 ? (
        <p className={listingStyles.status}>No content found.</p>
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
    </div>
  );
}

// ── Private Helpers ──

function buildFeedUrl({
  filter,
  cursor,
  limit,
}: {
  filter: ContentType | null;
  cursor: string | null;
  limit: number;
}): string {
  const params = new URLSearchParams();
  params.set("limit", String(limit));
  if (filter) {
    params.set("type", filter);
  }
  if (cursor) {
    params.set("cursor", cursor);
  }
  return `/api/content?${params.toString()}`;
}
