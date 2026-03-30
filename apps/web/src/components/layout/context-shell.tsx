import type React from "react";
import type { ReactNode } from "react";

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
          {config.items.map((item) => {
            if (item.featureFlag && !isFeatureEnabled(item.featureFlag)) return null;
            if (itemFilter && !itemFilter(item)) return null;

            const itemPath = `${config.basePath}${item.to}`;
            const isActive =
              item.to === ""
                ? currentPath === config.basePath || currentPath === `${config.basePath}/`
                : currentPath.startsWith(itemPath);

            return (
              <Link
                key={item.to}
                to={itemPath}
                className={clsx(styles.navItem, isActive && styles.navItemActive)}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>

      <div className={styles.content}>
        {children}
      </div>
    </div>
  );
}
