import { Link, useRouterState } from "@tanstack/react-router";

import type { AuthState } from "../../lib/auth.js";
import { NAV_LINKS } from "../../config/navigation.js";
import { UserMenu } from "./user-menu.js";
import { MobileMenu } from "./mobile-menu.js";
import styles from "./nav-bar.module.css";

// ── Public API ──

export function NavBar({ serverAuth }: { readonly serverAuth?: AuthState }) {
  const routerState = useRouterState();
  const currentPath = routerState.location.pathname;

  return (
    <header className={styles.header}>
      <nav className={styles.nav} aria-label="Main navigation">
        <Link to="/" className={styles.logo}>
          S/NC
        </Link>

        <ul className={styles.links}>
          {NAV_LINKS.map((link) => (
            <li key={link.to}>
              <Link
                to={link.to}
                className={[
                  styles.navLink,
                  link.disabled && styles.navLinkDisabled,
                  !link.disabled && currentPath.startsWith(link.to) && styles.navLinkActive,
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                {link.label}
              </Link>
            </li>
          ))}
        </ul>

        <div className={styles.right}>
          <UserMenu serverAuth={serverAuth} />
          <MobileMenu currentPath={currentPath} />
        </div>
      </nav>
    </header>
  );
}
