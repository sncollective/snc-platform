import type React from "react";
import type { ReactNode } from "react";
import { useRef, useEffect } from "react";

import { Link, useRouterState } from "@tanstack/react-router";
import { clsx } from "clsx/lite";

import type { ContextNavConfig, ContextNavItem } from "../../config/context-nav.js";
import { isFeatureEnabled } from "../../lib/config.js";
import { useContextAnnouncer } from "../../hooks/use-context-announcer.js";

import styles from "./context-shell.module.css";

// ── Public Types ──

export interface ContextShellProps {
  readonly config: ContextNavConfig;
  /** Optional header slot rendered above the nav items (e.g. creator switcher). */
  readonly headerSlot?: ReactNode;
  /** Content to render in the main area. */
  readonly children: ReactNode;
  /** Optional filter for nav items (e.g. permission-based). Return false to hide. */
  readonly itemFilter?: (item: ContextNavItem) => boolean;
}

// ── Private Types ──

interface RenderedItem {
  readonly item: ContextNavItem;
  readonly itemPath: string;
  readonly isActive: boolean;
}

// ── Private Helpers ──

/**
 * Single source of truth for nav item visibility and active-state.
 *
 * Applies feature-flag filtering, itemFilter, and active-state computation
 * so that both the sidebar nav and the mobile chip bar share identical output
 * without duplicating conditional logic.
 */
function useRenderedItems(
  config: ContextNavConfig,
  itemFilter: ((item: ContextNavItem) => boolean) | undefined,
  currentPath: string,
): readonly RenderedItem[] {
  return config.items
    .filter((item) => !item.featureFlag || isFeatureEnabled(item.featureFlag))
    .filter((item) => !itemFilter || itemFilter(item))
    .map((item) => {
      const itemPath = `${config.basePath}${item.to}`;
      const isActive =
        item.to === ""
          ? currentPath === config.basePath || currentPath === `${config.basePath}/`
          : currentPath.startsWith(itemPath);
      return { item, itemPath, isActive };
    });
}

// ── Public API ──

/** Sidebar layout shell for internal contexts. Replaces the public nav. */
export function ContextShell({
  config,
  headerSlot,
  children,
  itemFilter,
}: ContextShellProps): React.ReactElement {
  const currentPath = useRouterState({ select: (s) => s.location.pathname });
  useContextAnnouncer(config.label);

  const chipBarRef = useRef<HTMLElement | null>(null);
  const renderedItems = useRenderedItems(config, itemFilter, currentPath);

  useEffect(() => {
    const active = chipBarRef.current?.querySelector(`.${styles.chipActive}`);
    if (active instanceof HTMLElement) {
      active.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
    }
  }, [currentPath]);

  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar} role="navigation" aria-label={`${config.label} navigation`}>
        <div className={styles.sidebarHeader}>
          <Link to={config.backTo} className={styles.backLink}>
            &larr; {config.backLabel}
          </Link>
          <span className={styles.contextLabel}>{config.label}</span>
        </div>

        {headerSlot && <div className={styles.headerSlot}>{headerSlot}</div>}

        <nav className={styles.nav}>
          {renderedItems.map(({ item, itemPath, isActive }) => (
            <Link
              key={item.to}
              to={itemPath}
              className={clsx(styles.navItem, isActive && styles.navItemActive)}
              aria-current={isActive ? "page" : undefined}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>

      <nav
        ref={chipBarRef}
        className={styles.chipBar}
        aria-label={`${config.label} mobile navigation`}
      >
        {renderedItems.map(({ item, itemPath, isActive }) => (
          <Link
            key={item.to}
            to={itemPath}
            className={clsx(styles.chip, isActive && styles.chipActive)}
            aria-current={isActive ? "page" : undefined}
          >
            {item.label}
          </Link>
        ))}
      </nav>

      <div className={styles.content}>
        {children}
      </div>
    </div>
  );
}
