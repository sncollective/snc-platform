import { createFileRoute, getRouteApi, Link } from "@tanstack/react-router";
import { ChevronDown, LayoutGrid, List, Upload, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type React from "react";

import type {
  ContentAsset,
  ContentAssetSharing,
  ContentAssetUseStatus,
} from "@snc/shared";

import { useCursorPagination } from "../../../../hooks/use-cursor-pagination.js";
import { contentLibraryThumbnailUrl } from "../../../../lib/content-library.js";
import styles from "./library.module.css";

const parentRoute = getRouteApi("/creators/$creatorId/manage");

const SHARING_OPTIONS = ["private", "requestable", "open"] as const;

type LibrarySource = "mine" | "shared";
type SortOrder = "newest" | "oldest" | "largest" | "smallest";
type ViewMode = "grid" | "table";
type OpenFilter = "source" | "sharing" | null;

const SHARING_LABELS: Record<ContentAssetSharing, string> = {
  private: "Private",
  requestable: "Requestable",
  open: "Open",
};

const USE_STATUS_LABELS: Record<ContentAssetUseStatus, string> = {
  own: "Own",
  admin: "Admin access",
  open: "Open",
  granted: "Granted",
  "requestable-needs-grant": "Needs permission",
};

const DATE_FORMATTER = new Intl.DateTimeFormat("en", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

export const Route = createFileRoute("/creators/$creatorId/manage/library")({
  head: () => ({ meta: [{ title: "Media Library — S/NC" }] }),
  component: CreatorLibraryPage,
});

function buildLibraryUrl(creatorId: string, cursor: string | null): string {
  const endpoint = `/api/creators/${encodeURIComponent(creatorId)}/library/assets`;
  if (!cursor) return endpoint;
  return `${endpoint}?before=${encodeURIComponent(cursor)}`;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"] as const;
  let value = bytes / 1024;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value >= 10 ? value.toFixed(0) : value.toFixed(1)} ${units[unitIndex]}`;
}

function formatDimensions(asset: ContentAsset): string {
  return asset.width && asset.height ? `${asset.width} × ${asset.height}` : "Not available";
}

function assetName(asset: ContentAsset): string {
  return asset.originalFilename?.trim() || "Untitled image";
}

function displayUseStatus(asset: ContentAsset, currentCreatorId: string): string {
  if (asset.creatorId === currentCreatorId) return "Own";
  return USE_STATUS_LABELS[asset.useStatus];
}

function CreatorLibraryPage(): React.ReactElement {
  const { creator } = parentRoute.useLoaderData();
  const { creatorId } = Route.useParams();
  const [source, setSource] = useState<LibrarySource>("mine");
  const [sharingScopes, setSharingScopes] = useState<Set<ContentAssetSharing>>(
    () => new Set(),
  );
  const [sortOrder, setSortOrder] = useState<SortOrder>("newest");
  const [view, setView] = useState<ViewMode>("grid");
  const [openFilter, setOpenFilter] = useState<OpenFilter>(null);
  const filterBarRef = useRef<HTMLElement>(null);
  const sourceFilterButtonRef = useRef<HTMLButtonElement>(null);
  const sharingFilterButtonRef = useRef<HTMLButtonElement>(null);

  const {
    items,
    nextCursor,
    isLoading,
    error,
    loadMore,
  } = useCursorPagination<ContentAsset>({
    buildUrl: (cursor) => buildLibraryUrl(creator.id, cursor),
    deps: [creator.id],
    fetchOptions: { credentials: "include" },
  });

  useEffect(() => {
    if (!openFilter) return;

    const closeOnOutsideClick = (event: PointerEvent): void => {
      if (!filterBarRef.current?.contains(event.target as Node)) setOpenFilter(null);
    };
    const closeOnEscape = (event: KeyboardEvent): void => {
      if (event.key !== "Escape") return;
      const trigger = openFilter === "source"
        ? sourceFilterButtonRef.current
        : sharingFilterButtonRef.current;
      setOpenFilter(null);
      trigger?.focus();
    };

    document.addEventListener("pointerdown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [openFilter]);

  const ownCount = items.filter((asset) => asset.creatorId === creator.id).length;
  const sharedCount = items.length - ownCount;

  const sourceAssets = useMemo(
    () => items.filter((asset) => source === "mine"
      ? asset.creatorId === creator.id
      : asset.creatorId !== creator.id),
    [creator.id, items, source],
  );

  const visibleAssets = useMemo(() => {
    const filtered = sharingScopes.size === 0
      ? [...sourceAssets]
      : sourceAssets.filter((asset) => sharingScopes.has(asset.sharing));

    return filtered.sort((a, b) => {
      if (sortOrder === "largest") return b.size - a.size;
      if (sortOrder === "smallest") return a.size - b.size;
      const dateOrder = b.createdAt.localeCompare(a.createdAt);
      return sortOrder === "oldest" ? -dateOrder : dateOrder;
    });
  }, [sharingScopes, sortOrder, sourceAssets]);

  const activeFilterCount = 1 + sharingScopes.size;
  const hasNonDefaultFilters = source !== "mine" || sharingScopes.size > 0;
  const sourceLabel = source === "mine" ? "My library" : "Shared with me";

  const selectSource = (nextSource: LibrarySource): void => {
    setSource(nextSource);
    setOpenFilter(null);
    sourceFilterButtonRef.current?.focus();
  };

  const toggleSharingScope = (scope: ContentAssetSharing): void => {
    setSharingScopes((current) => {
      const next = new Set(current);
      if (next.has(scope)) next.delete(scope);
      else next.add(scope);
      return next;
    });
  };

  const clearFilters = (): void => {
    setSource("mine");
    setSharingScopes(new Set());
    setOpenFilter(null);
  };

  const removeSharingScope = (scope: ContentAssetSharing): void => {
    setSharingScopes((current) => {
      const next = new Set(current);
      next.delete(scope);
      return next;
    });
  };

  const isInitialLoading = isLoading && items.length === 0;
  const isEmptySource = !isInitialLoading && !error && sourceAssets.length === 0
    && sharingScopes.size === 0 && nextCursor === null;
  const hasNoResults = !isInitialLoading && !error && visibleAssets.length === 0
    && !isEmptySource;

  return (
    <main className={styles.page}>
      <header className={styles.titleRow}>
        <div>
          <p className={styles.eyebrow}>Media library</p>
          <h1>{creator.displayName} library</h1>
          <p className={styles.lead}>
            Find and share campaign images. This page opens to your own assets; adjust the
            filters whenever you need a wider view.
          </p>
        </div>
        <Link
          to="/creators/$creatorId/manage/press"
          params={{ creatorId }}
          className={styles.uploadButton}
          aria-label="Upload images from the press-page image picker"
        >
          <Upload size={17} aria-hidden="true" />
          Upload images
        </Link>
      </header>

      <section className={styles.library} aria-labelledby="library-heading" aria-busy={isLoading}>
        <header className={styles.libraryHead}>
          <div className={styles.libraryTitle}>
            <h2 id="library-heading">{sourceLabel}</h2>
            <p>{creator.displayName} · {source === "mine" ? "current creator" : "shared pool"}</p>
          </div>
          {source === "mine" && <span className={styles.defaultPill}>Default source</span>}
          <span className={styles.libraryCount} aria-live="polite">
            <strong>{sourceAssets.length}</strong> {sourceAssets.length === 1 ? "image" : "images"} loaded
          </span>
        </header>

        <nav ref={filterBarRef} className={styles.filters} aria-label="Library filters">
          <div className={styles.filter}>
            <button
              ref={sourceFilterButtonRef}
              type="button"
              className={styles.filterButton}
              aria-expanded={openFilter === "source"}
              aria-controls="library-source-filter"
              onClick={() => setOpenFilter((current) => current === "source" ? null : "source")}
            >
              <strong>Source:</strong> {sourceLabel}
              <ChevronDown size={14} aria-hidden="true" />
            </button>
            {openFilter === "source" && (
              <fieldset id="library-source-filter" className={styles.filterMenu}>
                <legend>Source</legend>
                <p>Opens to the current creator.</p>
                <label className={styles.filterOption}>
                  <input
                    type="radio"
                    name="library-source"
                    checked={source === "mine"}
                    onChange={() => selectSource("mine")}
                  />
                  <span>My library</span>
                  <small>{ownCount} · default</small>
                </label>
                <label className={styles.filterOption}>
                  <input
                    type="radio"
                    name="library-source"
                    checked={source === "shared"}
                    onChange={() => selectSource("shared")}
                  />
                  <span>Shared with me</span>
                  <small>{sharedCount}</small>
                </label>
              </fieldset>
            )}
          </div>

          <div className={styles.filter}>
            <button
              ref={sharingFilterButtonRef}
              type="button"
              className={`${styles.filterButton} ${sharingScopes.size > 0 ? styles.filterButtonActive : ""}`}
              aria-expanded={openFilter === "sharing"}
              aria-controls="library-sharing-filter"
              onClick={() => setOpenFilter((current) => current === "sharing" ? null : "sharing")}
            >
              <strong>Sharing scope</strong>
              {sharingScopes.size > 0 && <span>({sharingScopes.size})</span>}
              <ChevronDown size={14} aria-hidden="true" />
            </button>
            {openFilter === "sharing" && (
              <fieldset id="library-sharing-filter" className={styles.filterMenu}>
                <legend>Sharing scope</legend>
                {SHARING_OPTIONS.map((scope) => (
                  <label key={scope} className={styles.filterOption}>
                    <input
                      type="checkbox"
                      checked={sharingScopes.has(scope)}
                      onChange={() => toggleSharingScope(scope)}
                    />
                    <span>{SHARING_LABELS[scope]}</span>
                    <small>{sourceAssets.filter((asset) => asset.sharing === scope).length}</small>
                  </label>
                ))}
              </fieldset>
            )}
          </div>
        </nav>

        <div className={styles.tools}>
          <label className={styles.sortLabel} htmlFor="library-sort">Sort</label>
          <select
            id="library-sort"
            className={styles.sort}
            value={sortOrder}
            onChange={(event) => setSortOrder(event.target.value as SortOrder)}
          >
            <option value="newest">Date added · newest</option>
            <option value="oldest">Date added · oldest</option>
            <option value="largest">Size · largest</option>
            <option value="smallest">Size · smallest</option>
          </select>
          <span className={styles.toolsSpacer} />
          <div className={styles.viewToggle} role="group" aria-label="View mode">
            <button
              type="button"
              aria-label="Grid view"
              aria-pressed={view === "grid"}
              onClick={() => setView("grid")}
            >
              <LayoutGrid size={16} aria-hidden="true" /> Grid
            </button>
            <button
              type="button"
              aria-label="Table view"
              aria-pressed={view === "table"}
              onClick={() => setView("table")}
            >
              <List size={16} aria-hidden="true" /> Table
            </button>
          </div>
        </div>

        <div className={styles.activeFilters} aria-label="Active filters">
          <span className={styles.activeSummary}>{activeFilterCount} {activeFilterCount === 1 ? "filter" : "filters"} active</span>
          {source === "mine" ? (
            <span className={styles.filterChip}>Source: My library</span>
          ) : (
            <button type="button" className={styles.filterChip} onClick={() => setSource("mine")}>
              Source: Shared with me <X size={13} aria-hidden="true" />
              <span className={styles.srOnly}>Remove source filter</span>
            </button>
          )}
          {SHARING_OPTIONS.filter((scope) => sharingScopes.has(scope)).map((scope) => (
            <button
              key={scope}
              type="button"
              className={styles.filterChip}
              onClick={() => removeSharingScope(scope)}
            >
              Sharing: {SHARING_LABELS[scope]} <X size={13} aria-hidden="true" />
              <span className={styles.srOnly}>Remove {SHARING_LABELS[scope]} sharing filter</span>
            </button>
          ))}
          {hasNonDefaultFilters && (
            <button type="button" className={styles.clearFilters} onClick={clearFilters}>
              Clear filters
            </button>
          )}
          <span className={styles.resultCount} aria-live="polite">
            <strong>{visibleAssets.length}</strong> {visibleAssets.length === 1 ? "result" : "results"}
          </span>
        </div>

        <div className={styles.results}>
          {isInitialLoading && <LoadingState />}
          {error && <ErrorState message={error} />}
          {isEmptySource && <EmptyState source={source} creatorId={creatorId} />}
          {hasNoResults && <NoResultsState onClear={clearFilters} />}
          {!isInitialLoading && !error && visibleAssets.length > 0 && (
            view === "grid"
              ? <AssetGrid assets={visibleAssets} currentCreatorId={creator.id} />
              : <AssetTable assets={visibleAssets} currentCreatorId={creator.id} />
          )}
        </div>

        {nextCursor && (
          <div className={styles.loadMoreRow}>
            <button type="button" className={styles.loadMoreButton} disabled={isLoading} onClick={loadMore}>
              {isLoading ? "Loading more…" : "Load more images"}
            </button>
            <span>Filters apply to every loaded page.</span>
          </div>
        )}
      </section>
    </main>
  );
}

function AssetGrid({
  assets,
  currentCreatorId,
}: {
  assets: readonly ContentAsset[];
  currentCreatorId: string;
}): React.ReactElement {
  return (
    <ul className={styles.assetGrid} aria-label="Library image grid">
      {assets.map((asset) => (
        <li key={asset.id} className={styles.assetCard}>
          <div className={styles.cardImage}>
            <img src={contentLibraryThumbnailUrl(asset.storageKey)} alt="" loading="lazy" />
          </div>
          <div className={styles.cardBody}>
            <strong className={styles.assetName} title={assetName(asset)}>{assetName(asset)}</strong>
            <span className={styles.assetMeta}>{formatDimensions(asset)} · {formatBytes(asset.size)}</span>
            <div className={styles.badges}>
              <SharingBadge sharing={asset.sharing} />
              <UseStatusBadge label={displayUseStatus(asset, currentCreatorId)} status={asset.useStatus} />
            </div>
            <time dateTime={asset.createdAt}>{DATE_FORMATTER.format(new Date(asset.createdAt))}</time>
          </div>
        </li>
      ))}
    </ul>
  );
}

function AssetTable({
  assets,
  currentCreatorId,
}: {
  assets: readonly ContentAsset[];
  currentCreatorId: string;
}): React.ReactElement {
  return (
    <div className={styles.tableWrapper}>
      <table className={styles.assetTable}>
        <caption className={styles.srOnly}>Library image properties</caption>
        <thead>
          <tr>
            <th scope="col">Image</th>
            <th scope="col">Dimensions</th>
            <th scope="col">Sharing</th>
            <th scope="col">Use status</th>
            <th scope="col">Date added</th>
            <th scope="col">Size</th>
          </tr>
        </thead>
        <tbody>
          {assets.map((asset) => (
            <tr key={asset.id}>
              <th scope="row" data-label="Image">
                <span className={styles.tableFile}>
                  <span className={styles.tableThumb}><img src={contentLibraryThumbnailUrl(asset.storageKey)} alt="" loading="lazy" /></span>
                  <span><strong title={assetName(asset)}>{assetName(asset)}</strong><small>{asset.mimeType.replace("image/", "").toUpperCase()}</small></span>
                </span>
              </th>
              <td data-label="Dimensions">{formatDimensions(asset)}</td>
              <td data-label="Sharing"><SharingBadge sharing={asset.sharing} /></td>
              <td data-label="Use status"><UseStatusBadge label={displayUseStatus(asset, currentCreatorId)} status={asset.useStatus} /></td>
              <td data-label="Date added"><time dateTime={asset.createdAt}>{DATE_FORMATTER.format(new Date(asset.createdAt))}</time></td>
              <td data-label="Size">{formatBytes(asset.size)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SharingBadge({ sharing }: { sharing: ContentAssetSharing }): React.ReactElement {
  return <span className={styles.badge} data-sharing={sharing}>{SHARING_LABELS[sharing]}</span>;
}

function UseStatusBadge({
  label,
  status,
}: {
  label: string;
  status: ContentAssetUseStatus;
}): React.ReactElement {
  return <span className={styles.badge} data-use-status={status}>{label}</span>;
}

function LoadingState(): React.ReactElement {
  return (
    <div className={styles.state} role="status">
      <span className={styles.spinner} aria-hidden="true" />
      <strong>Loading image library…</strong>
      <span>Finding your reusable campaign images.</span>
    </div>
  );
}

function ErrorState({ message }: { message: string }): React.ReactElement {
  return (
    <div className={styles.state} role="alert">
      <strong>We couldn’t load the library.</strong>
      <span>{message}</span>
    </div>
  );
}

function EmptyState({
  source,
  creatorId,
}: {
  source: LibrarySource;
  creatorId: string;
}): React.ReactElement {
  if (source === "shared") {
    return (
      <div className={styles.state}>
        <LayoutGrid size={30} aria-hidden="true" />
        <strong>Nothing has been shared with you yet.</strong>
        <span>Open and granted images from other creators will appear here.</span>
      </div>
    );
  }

  return (
    <div className={styles.state}>
      <Upload size={30} aria-hidden="true" />
      <strong>Your library is ready for its first image.</strong>
      <span>Upload from an image field and every reusable image will collect here.</span>
      <Link
        to="/creators/$creatorId/manage/press"
        params={{ creatorId }}
        className={styles.stateAction}
      >
        Upload a press image
      </Link>
    </div>
  );
}

function NoResultsState({ onClear }: { onClear: () => void }): React.ReactElement {
  return (
    <div className={styles.state} role="status">
      <strong>No images match these filters.</strong>
      <span>Remove a sharing scope or return to your library.</span>
      <button type="button" className={styles.stateAction} onClick={onClear}>Clear filters</button>
    </div>
  );
}
