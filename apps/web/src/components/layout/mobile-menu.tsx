import { useRef } from "react";

import { Link } from "@tanstack/react-router";

import { NAV_LINKS } from "../../config/navigation.js";
import { useMenuToggle } from "../../hooks/use-menu-toggle.js";
import { authClient } from "../../lib/auth-client.js";
import { useSession, useAuthExtras, hasRole } from "../../lib/auth.js";
import type { AuthState } from "../../lib/auth.js";
import { isFeatureEnabled } from "../../lib/config.js";
import styles from "./mobile-menu.module.css";

// ── Public Types ──

export interface MobileMenuProps {
  readonly currentPath: string;
  readonly serverAuth?: AuthState;
}

// ── Public API ──

export function MobileMenu({ currentPath, serverAuth }: MobileMenuProps) {
  const session = useSession();
  const { roles } = useAuthExtras();
  const menuRef = useRef<HTMLDivElement>(null);
  const { isOpen, handleToggle, handleClose } = useMenuToggle(menuRef);

  const effectiveRoles = session.isPending
    ? serverAuth?.roles ?? []
    : roles;

  const handleLogout = async () => {
    await authClient.signOut();
    handleClose();
  };

  return (
    <div className={styles.mobileMenu} ref={menuRef}>
      <button
        className={styles.hamburger}
        onClick={handleToggle}
        aria-expanded={isOpen}
        aria-label={isOpen ? "Close menu" : "Open menu"}
        type="button"
      >
        <span className={styles.hamburgerLine} />
        <span className={styles.hamburgerLine} />
        <span className={styles.hamburgerLine} />
      </button>

      {isOpen && (
        <nav
          className={styles.overlay}
          role="navigation"
          aria-label="Mobile navigation"
        >
          <ul className={styles.linkList}>
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
                styles.menuLink,
                link.disabled && styles.menuLinkDisabled,
                isActive && styles.menuLinkActive,
              ].filter(Boolean).join(" ");

              return (
                <li key={link.to}>
                  {link.external ? (
                    <a
                      href={link.to}
                      className={className}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={handleClose}
                    >
                      {link.label}
                    </a>
                  ) : (
                    <Link
                      to={link.to}
                      className={className}
                      onClick={handleClose}
                    >
                      {link.label}
                    </Link>
                  )}
                </li>
              );
            })}

            {isFeatureEnabled("dashboard") && session.data && hasRole(effectiveRoles, "stakeholder") && (
              <li>
                <Link
                  to="/dashboard"
                  className={
                    currentPath.startsWith("/dashboard")
                      ? `${styles.menuLink} ${styles.menuLinkActive}`
                      : styles.menuLink
                  }
                  onClick={handleClose}
                >
                  Dashboard
                </Link>
              </li>
            )}

            {isFeatureEnabled("calendar") && session.data && hasRole(effectiveRoles, "stakeholder") && (
              <li>
                <Link
                  to="/calendar"
                  className={
                    currentPath.startsWith("/calendar")
                      ? `${styles.menuLink} ${styles.menuLinkActive}`
                      : styles.menuLink
                  }
                  onClick={handleClose}
                >
                  Calendar
                </Link>
              </li>
            )}
          </ul>

          <div className={styles.divider} />

          {session.data ? (
            <div className={styles.authSection}>
              <Link
                to="/settings"
                className={styles.menuLink}
                onClick={handleClose}
              >
                Settings
              </Link>
              <button
                className={styles.logoutButton}
                onClick={handleLogout}
                type="button"
              >
                Log out
              </button>
            </div>
          ) : (
            <div className={styles.authSection}>
              <Link
                to="/login"
                className={styles.menuLink}
                onClick={handleClose}
              >
                Log in
              </Link>
              <Link
                to="/register"
                className={styles.menuLink}
                onClick={handleClose}
              >
                Sign up
              </Link>
            </div>
          )}
        </nav>
      )}
    </div>
  );
}
