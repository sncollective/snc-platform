import { Link, useRouterState } from "@tanstack/react-router";

import { useSession, useAuthExtras, hasRole } from "../../lib/auth.js";
import type { AuthState } from "../../lib/auth.js";
import { NAV_LINKS, isNavLinkActive } from "../../config/navigation.js";
import { UserMenu } from "./user-menu.js";
import { MobileMenu } from "./mobile-menu.js";
import { clsx } from "clsx/lite";

import styles from "./nav-bar.module.css";

// ── Public API ──

export function NavBar({ serverAuth }: { readonly serverAuth?: AuthState }) {
  const routerState = useRouterState();
  const currentPath = routerState.location.pathname;
  const session = useSession();
  const { roles } = useAuthExtras();

  const effectiveRoles = session.isPending
    ? serverAuth?.roles ?? []
    : roles;

  return (
    <header className={styles.header}>
      <nav className={styles.nav} aria-label="Main navigation">
        <Link to="/" className={styles.logo}>
          S/NC
        </Link>

        <ul className={styles.links}>
          {NAV_LINKS.map((link) => {
            if (link.role && !hasRole(effectiveRoles, link.role) && !hasRole(effectiveRoles, "admin")) {
              return null;
            }

            const isActive = isNavLinkActive(link, currentPath, NAV_LINKS);
            const className = clsx(
              styles.navLink,
              link.disabled && styles.navLinkDisabled,
              isActive && styles.navLinkActive,
            );

            return (
              <li key={link.to}>
                {link.external ? (
                  <a
                    href={link.to}
                    className={className}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {link.label}
                  </a>
                ) : (
                  <Link to={link.to} className={className}>
                    {link.label}
                  </Link>
                )}
              </li>
            );
          })}
        </ul>

        <div className={styles.right}>
          <UserMenu {...(serverAuth !== undefined ? { serverAuth } : {})} />
          <MobileMenu currentPath={currentPath} {...(serverAuth !== undefined ? { serverAuth } : {})} />
        </div>
      </nav>
    </header>
  );
}
