import { createFileRoute } from "@tanstack/react-router";
import type React from "react";
import type { CreatorListItem, CreatorListResponse } from "@snc/shared";

import { ComingSoon } from "../../components/coming-soon/coming-soon.js";
import { CreatorCard } from "../../components/creator/creator-card.js";
import { fetchApiServer } from "../../lib/api-server.js";
import { useCursorPagination } from "../../hooks/use-cursor-pagination.js";
import { isFeatureEnabled } from "../../lib/config.js";
import styles from "./creators.module.css";
import listingStyles from "../../styles/listing-page.module.css";

export const Route = createFileRoute("/creators/")({
  loader: async (): Promise<CreatorListResponse> => {
    if (!isFeatureEnabled("creator")) return { items: [], nextCursor: null };
    try {
      return (await fetchApiServer({
        data: "/api/creators?limit=24",
      })) as CreatorListResponse;
    } catch {
      return { items: [], nextCursor: null };
    }
  },
  component: CreatorsPage,
});

function CreatorsPage(): React.ReactElement {
  if (!isFeatureEnabled("creator")) return <ComingSoon feature="creator" />;

  const loaderData = Route.useLoaderData();

  const { items, nextCursor, isLoading, loadMore } =
    useCursorPagination<CreatorListItem>({
      buildUrl: (cursor) => buildCreatorsUrl({ cursor, limit: 24 }),
      initialData: loaderData,
    });

  return (
    <div className={styles.creatorsPage}>
      <h1 className={listingStyles.heading}>Creators</h1>
      {isLoading && items.length === 0 ? (
        <p className={listingStyles.status}>Loading...</p>
      ) : items.length === 0 ? (
        <p className={listingStyles.status}>No creators found.</p>
      ) : (
        <>
          <div className="content-grid">
            {items.map((creator) => (
              <CreatorCard key={creator.userId} creator={creator} />
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

function buildCreatorsUrl({
  cursor,
  limit,
}: {
  cursor: string | null;
  limit: number;
}): string {
  const params = new URLSearchParams();
  params.set("limit", String(limit));
  if (cursor) {
    params.set("cursor", cursor);
  }
  return `/api/creators?${params.toString()}`;
}
