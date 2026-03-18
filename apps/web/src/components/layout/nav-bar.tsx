import { Link, useRouterState } from "@tanstack/react-router";

import { useSession, useAuthExtras, hasRole } from "../../lib/auth.js";
import type { AuthState } from "../../lib/auth.js";
import { NAV_LINKS } from "../../config/navigation.js";
import { UserMenu } from "./user-menu.js";
import { MobileMenu } from "./mobile-menu.js";
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

            const pathMatches = !link.external && !link.disabled &&
              (currentPath === link.to || currentPath.startsWith(`${link.to}/`));
            const isActive = pathMatches && !NAV_LINKS.some(
              (other) => other !== link && !other.external && other.to.startsWith(link.to) &&
                other.to.length > link.to.length &&
                (currentPath === other.to || currentPath.startsWith(`${other.to}/`)),
            );
            const className = [
              styles.navLink,
              link.disabled && styles.navLinkDisabled,
              isActive && styles.navLinkActive,
            ].filter(Boolean).join(" ");

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
