import { createFileRoute, getRouteApi, useNavigate } from "@tanstack/react-router";
import { useState, useRef, useEffect } from "react";
import type React from "react";
import type { ContentType } from "@snc/shared";
import { CONTENT_TYPES } from "@snc/shared";

import { ContentManagementList } from "../../../../../components/content/content-management-list.js";
import { createContent } from "../../../../../lib/content.js";
import { useMenuToggle } from "../../../../../hooks/use-menu-toggle.js";

import styles from "../content-manage.module.css";

// ── Route ──

const manageRoute = getRouteApi("/creators/$creatorId/manage");

export const Route = createFileRoute("/creators/$creatorId/manage/content/")({
  head: () => ({ meta: [{ title: "Manage Content — S/NC" }] }),
  component: ManageContentPage,
});

// ── Constants ──

const TYPE_LABELS: Record<ContentType, string> = {
  video: "Video",
  audio: "Audio",
  written: "Written Post",
};

// ── Component ──

function ManageContentPage(): React.ReactElement {
  const { creator } = manageRoute.useLoaderData();
  const creatorSlug = creator.handle ?? creator.id;
  const navigate = useNavigate();
  const [refreshKey, setRefreshKey] = useState(0);
  const [isCreating, setIsCreating] = useState(false);
  const typeSelectorRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const { isOpen: showTypeSelector, handleToggle: toggleTypeSelector, handleClose: closeTypeSelector } =
    useMenuToggle(typeSelectorRef);

  const refresh = () => setRefreshKey((k) => k + 1);

  // Auto-focus first menuitem when the menu opens
  useEffect(() => {
    if (!showTypeSelector) return;
    const firstItem = menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]');
    firstItem?.focus();
  }, [showTypeSelector]);

  // Arrow-key navigation within the menu (WAI-ARIA Menu Button pattern)
  const handleMenuKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const items = Array.from(
      menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [],
    );
    if (items.length === 0) return;

    const currentIndex = items.indexOf(document.activeElement as HTMLElement);

    switch (e.key) {
      case "ArrowDown": {
        e.preventDefault();
        const next = currentIndex < items.length - 1 ? currentIndex + 1 : 0;
        items[next]?.focus();
        break;
      }
      case "ArrowUp": {
        e.preventDefault();
        const prev = currentIndex > 0 ? currentIndex - 1 : items.length - 1;
        items[prev]?.focus();
        break;
      }
      case "Home": {
        e.preventDefault();
        items[0]?.focus();
        break;
      }
      case "End": {
        e.preventDefault();
        items[items.length - 1]?.focus();
        break;
      }
      case "Tab": {
        closeTypeSelector();
        break;
      }
    }
  };

  const handleCreate = async (type: ContentType) => {
    setIsCreating(true);
    try {
      const draft = await createContent({
        creatorId: creator.id,
        title: `Untitled ${TYPE_LABELS[type]}`,
        type,
        visibility: "public",
      });
      void navigate({
        to: "/creators/$creatorId/manage/content/$contentId",
        params: {
          creatorId: creatorSlug,
          contentId: draft.slug ?? draft.id,
        },
      });
    } catch {
      setIsCreating(false);
      closeTypeSelector();
    }
  };

  return (
    <div className={styles.contentManage}>
      <div className={styles.header}>
        <h2 className={styles.heading}>Content</h2>
        <div className={styles.createWrapper} ref={typeSelectorRef}>
          <button
            type="button"
            className={styles.createButton}
            onClick={toggleTypeSelector}
            disabled={isCreating}
            aria-expanded={showTypeSelector}
            aria-haspopup="menu"
          >
            {isCreating ? "Creating..." : "Create New"}
          </button>
          {showTypeSelector && (
            <div
              ref={menuRef}
              className={styles.typeSelector}
              role="menu"
              onKeyDown={handleMenuKeyDown}
            >
              {CONTENT_TYPES.map((type) => (
                <button
                  key={type}
                  type="button"
                  role="menuitem"
                  className={styles.typeSelectorOption}
                  onClick={() => void handleCreate(type)}
                  disabled={isCreating}
                >
                  {TYPE_LABELS[type]}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <ContentManagementList
        creatorId={creator.id}
        creatorSlug={creatorSlug}
        refreshKey={refreshKey}
        onDeleted={refresh}
      />
    </div>
  );
}
