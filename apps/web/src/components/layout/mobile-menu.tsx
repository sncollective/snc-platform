import { useRef } from "react";

import { Link } from "@tanstack/react-router";

import { NAV_LINKS } from "../../config/navigation.js";
import { useMenuToggle } from "../../hooks/use-menu-toggle.js";
import { authClient } from "../../lib/auth-client.js";
import { useSession, useRoles, hasRole } from "../../lib/auth.js";
import { isFeatureEnabled } from "../../lib/config.js";
import styles from "./mobile-menu.module.css";

// ── Public Types ──

export interface MobileMenuProps {
  readonly currentPath: string;
}

// ── Public API ──

export function MobileMenu({ currentPath }: MobileMenuProps) {
  const session = useSession();
  const roles = useRoles();
  const menuRef = useRef<HTMLDivElement>(null);
  const { isOpen, handleToggle, handleClose } = useMenuToggle(menuRef);

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
            {NAV_LINKS.map((link) => (
              <li key={link.to}>
                <Link
                  to={link.to}
                  className={
                    currentPath.startsWith(link.to)
                      ? `${styles.menuLink} ${styles.menuLinkActive}`
                      : styles.menuLink
                  }
                  onClick={handleClose}
                >
                  {link.label}
                </Link>
              </li>
            ))}

            {isFeatureEnabled("dashboard") && session.data && hasRole(roles, "cooperative-member") && (
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
