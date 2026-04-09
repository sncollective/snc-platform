import { Link, useRouterState } from "@tanstack/react-router";
import type React from "react";
import { Home, Rss, Radio, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { useNotificationCount } from "../../contexts/notification-context.js";
import styles from "./bottom-tab-bar.module.css";

// ── Private Constants ──

interface TabItem {
  readonly to: string;
  readonly label: string;
  readonly icon: LucideIcon;
  readonly exact?: boolean;
}

const TAB_ITEMS: readonly TabItem[] = [
  { to: "/", label: "Home", icon: Home, exact: true },
  { to: "/feed", label: "Feed", icon: Rss },
  { to: "/live", label: "Live", icon: Radio },
  { to: "/creators", label: "Creators", icon: Users },
];

// ── Public API ──

/** Fixed bottom tab bar for mobile navigation. Hidden on desktop (≥768px). */
export function BottomTabBar(): React.ReactElement {
  const routerState = useRouterState();
  const currentPath = routerState.location.pathname;
  const unreadCount = useNotificationCount();

  return (
    <nav
      className={styles.tabBar}
      aria-label="Primary navigation"
    >
      {TAB_ITEMS.map((item) => {
        const isActive = item.exact
          ? currentPath === item.to
          : currentPath === item.to || currentPath.startsWith(`${item.to}/`);
        const Icon = item.icon;

        return (
          <Link
            key={item.to}
            to={item.to}
            className={isActive ? styles.tabActive : styles.tab}
            aria-current={isActive ? "page" : undefined}
          >
            <div className={styles.tabIconWrapper}>
              <Icon size={20} aria-hidden="true" />
              {item.exact && unreadCount > 0 && (
                <span className={styles.badge} aria-label="Unread notifications" />
              )}
            </div>
            <span className={styles.tabLabel}>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
