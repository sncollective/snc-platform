import { createFileRoute } from "@tanstack/react-router";
import type React from "react";
import * as z from "zod/mini";
import type { MerchProduct } from "@snc/shared";

import { ComingSoon } from "../../components/coming-soon/coming-soon.js";
import { ProductCard } from "../../components/merch/product-card.js";
import { useCursorPagination } from "../../hooks/use-cursor-pagination.js";
import { isFeatureEnabled } from "../../lib/config.js";
import successStyles from "../../styles/success-alert.module.css";
import styles from "./merch-index.module.css";
import listingStyles from "../../styles/listing-page.module.css";

// ── Route ──

const MerchSearchSchema = z.object({
  creatorId: z.optional(z.string()),
  status: z.optional(z.string()),
});

export const Route = createFileRoute("/merch/")({
  validateSearch: MerchSearchSchema,
  head: () => ({
    meta: [
      { title: "Merch — S/NC" },
      { name: "description", content: "Browse merch from S/NC creators." },
    ],
  }),
  component: MerchPage,
});

// ── Component ──

function MerchPage(): React.ReactElement {
  if (!isFeatureEnabled("merch")) return <ComingSoon feature="merch" />;

  const search = Route.useSearch();

  const creatorId = search.creatorId ?? null;
  const status = search.status ?? null;

  const { items, nextCursor, isLoading, error, loadMore } =
    useCursorPagination<MerchProduct>({
      buildUrl: (cursor) =>
        buildMerchUrl({ creatorId, cursor, limit: 12 }),
      deps: [creatorId],
    });

  return (
    <div className={styles.merchPage}>
      <h1 className={listingStyles.heading}>Merch</h1>

      {status === "success" && (
        <div className={successStyles.success} role="status">
          Purchase complete! Thank you for your order.
        </div>
      )}

      {status === "cancel" && (
        <div className={styles.bannerInfo} role="status">
          Checkout was canceled. No charges were made.
        </div>
      )}

      {isLoading && items.length === 0 ? (
        <p className={listingStyles.status}>Loading...</p>
      ) : error !== null && items.length === 0 ? (
        <p className={listingStyles.status}>Merch coming soon.</p>
      ) : items.length === 0 ? (
        <p className={listingStyles.status}>No products found.</p>
      ) : (
        <>
          <div className="content-grid">
            {items.map((product) => (
              <ProductCard key={product.handle} product={product} />
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

function buildMerchUrl({
  creatorId,
  cursor,
  limit,
}: {
  creatorId: string | null;
  cursor: string | null;
  limit: number;
}): string {
  const params = new URLSearchParams();
  params.set("limit", String(limit));
  if (creatorId) {
    params.set("creatorId", creatorId);
  }
  if (cursor) {
    params.set("cursor", cursor);
  }
  return `/api/merch?${params.toString()}`;
}
