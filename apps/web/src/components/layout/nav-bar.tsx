import { Link, useRouterState } from "@tanstack/react-router";

import { useSession, useAuthExtras } from "../../lib/auth.js";
import type { AuthState } from "../../lib/auth.js";
import { NAV_LINKS } from "../../config/navigation.js";
import { NotificationBell } from "../notification-bell.js";
import { UserMenu } from "./user-menu.js";
import { NavLinkItem } from "./nav-link-item.js";

import styles from "./nav-bar.module.css";

// ── Public API ──

/** Top-level navigation header with desktop link list and user menu. */
export function NavBar({ serverAuth }: { readonly serverAuth?: AuthState }) {
  const routerState = useRouterState();
  const currentPath = routerState.location.pathname;
  const session = useSession();
  const { roles } = useAuthExtras();

  const effectiveRoles = session.isPending
    ? serverAuth?.roles ?? []
    : roles;

  const user = session.isPending
    ? serverAuth?.user ?? null
    : session.data?.user ?? null;

  return (
    <header className={styles.header}>
      <nav className={styles.nav} aria-label="Main navigation">
        <Link to="/" className={styles.logo}>
          S/NC
        </Link>

        <ul className={styles.links}>
          {NAV_LINKS.map((link) => (
            <NavLinkItem
              key={link.to}
              link={link}
              currentPath={currentPath}
              effectiveRoles={effectiveRoles}
              linkClass={styles.navLink}
              activeClass={styles.navLinkActive}
              disabledClass={styles.navLinkDisabled}
            />
          ))}
        </ul>

        <div className={styles.right}>
          {user && <NotificationBell />}
          <UserMenu {...(serverAuth !== undefined ? { serverAuth } : {})} />
        </div>
      </nav>
    </header>
  );
}
