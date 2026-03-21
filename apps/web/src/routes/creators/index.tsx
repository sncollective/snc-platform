import { useState, useEffect } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import type React from "react";
import type { CreatorListItem, CreatorListResponse, CreatorProfileResponse } from "@snc/shared";

import { RouteErrorBoundary } from "../../components/error/route-error-boundary.js";
import { ComingSoon } from "../../components/coming-soon/coming-soon.js";
import { CreatorCard } from "../../components/creator/creator-card.js";
import { CreateCreatorForm } from "../../components/creator/create-creator-form.js";
import { fetchApiServer } from "../../lib/api-server.js";
import { useCursorPagination } from "../../hooks/use-cursor-pagination.js";
import { isFeatureEnabled } from "../../lib/config.js";
import { fetchAuthState } from "../../lib/auth.js";
import styles from "./creators.module.css";
import listingStyles from "../../styles/listing-page.module.css";
import buttonStyles from "../../styles/button.module.css";

export const Route = createFileRoute("/creators/")({
  errorComponent: RouteErrorBoundary,
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

// ── Private Types ──

type ViewMode = "grid" | "list";

// ── Private Constants ──

const VIEW_MODE_KEY = "snc-creators-view-mode";

// ── Private Helpers ──

function getInitialViewMode(): ViewMode {
  if (typeof window === "undefined") return "grid";
  const stored = localStorage.getItem(VIEW_MODE_KEY);
  return stored === "list" ? "list" : "grid";
}

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

// ── Page Component ──

function CreatorsPage(): React.ReactElement {
  if (!isFeatureEnabled("creator")) return <ComingSoon feature="creator" />;

  const loaderData = Route.useLoaderData();
  const navigate = useNavigate();

  const { items, nextCursor, isLoading, loadMore } =
    useCursorPagination<CreatorListItem>({
      buildUrl: (cursor) => buildCreatorsUrl({ cursor, limit: 24 }),
      fetchOptions: { credentials: "include" },
      initialData: loaderData,
    });

  const [viewMode, setViewMode] = useState<ViewMode>(getInitialViewMode);
  const [canManage, setCanManage] = useState(false);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    void fetchAuthState().then((auth) => {
      const manage = auth.roles.includes("stakeholder") || auth.roles.includes("admin");
      setCanManage(manage);
    });
  }, []);

  const handleViewModeChange = (mode: ViewMode) => {
    setViewMode(mode);
    localStorage.setItem(VIEW_MODE_KEY, mode);
  };

  const handleCreated = (profile: CreatorProfileResponse) => {
    void navigate({ to: "/creators/$creatorId/manage", params: { creatorId: profile.id } });
  };

  return (
    <div className={styles.creatorsPage}>
      <div className={styles.pageHeader}>
        <h1 className={listingStyles.heading}>Creators</h1>
        {canManage && (
          <button
            type="button"
            className={buttonStyles.primaryButton}
            onClick={() => setShowForm((v) => !v)}
          >
            {showForm ? "Cancel" : "New Creator"}
          </button>
        )}
        {canManage && (
          <div className={styles.viewToggle}>
            <button
              type="button"
              className={`${styles.viewToggleButton} ${viewMode === "grid" ? styles.viewToggleActive : ""}`}
              onClick={() => handleViewModeChange("grid")}
              aria-label="Grid view"
              aria-pressed={viewMode === "grid"}
            >
              Grid
            </button>
            <button
              type="button"
              className={`${styles.viewToggleButton} ${viewMode === "list" ? styles.viewToggleActive : ""}`}
              onClick={() => handleViewModeChange("list")}
              aria-label="List view"
              aria-pressed={viewMode === "list"}
            >
              List
            </button>
          </div>
        )}
      </div>
      {showForm && <CreateCreatorForm onCreated={handleCreated} />}
      {isLoading && items.length === 0 ? (
        <p className={listingStyles.status}>Loading...</p>
      ) : items.length === 0 ? (
        <p className={listingStyles.status}>No creators found.</p>
      ) : (
        <>
          <div className={viewMode === "grid" ? "content-grid" : styles.listLayout}>
            {items.map((creator) => (
              <CreatorCard key={creator.id} creator={creator} viewMode={viewMode} />
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
