import { useRef } from "react";

import { Link, useNavigate } from "@tanstack/react-router";

import { useMenuToggle } from "../../hooks/use-menu-toggle.js";
import { authClient } from "../../lib/auth-client.js";
import { useSession, useAuthExtras, hasRole } from "../../lib/auth.js";
import type { AuthState } from "../../lib/auth.js";
import { isFeatureEnabled } from "../../lib/config.js";
import { getInitials } from "../../lib/format.js";
import styles from "./user-menu.module.css";

// ── Public API ──

export function UserMenu({ serverAuth }: { readonly serverAuth?: AuthState }) {
  const session = useSession();
  const { roles, isPatron } = useAuthExtras();
  const navigate = useNavigate();
  const menuRef = useRef<HTMLDivElement>(null);
  const { isOpen, handleToggle, handleClose } = useMenuToggle(menuRef);

  const handleLogout = async () => {
    await authClient.signOut();
    handleClose();
    void navigate({ to: "/" });
  };

  // Resolve user: prefer live session, fall back to server-prefetched
  const user = session.isPending
    ? serverAuth?.user ?? null
    : session.data?.user ?? null;
  const effectiveRoles = session.isPending
    ? serverAuth?.roles ?? []
    : roles;
  const effectiveIsPatron = session.isPending
    ? serverAuth?.isPatron ?? false
    : isPatron;

  // Still loading and no server data at all — show skeleton
  // (serverAuth undefined = genuinely unknown; serverAuth.user null = confirmed logged out)
  if (!user && session.isPending && !serverAuth) {
    return <div className={styles.avatarSkeleton} aria-hidden="true" />;
  }

  if (!user) {
    return (
      <div className={styles.loggedOut}>
        <Link to="/login" className={styles.loginLink}>
          Log in
        </Link>
        <Link to="/register" className={styles.signupLink}>
          Sign up
        </Link>
      </div>
    );
  }

  const initials = getInitials(user.name);

  return (
    <div className={styles.menu} ref={menuRef}>
      <button
        className={styles.avatarButton}
        onClick={handleToggle}
        aria-expanded={isOpen}
        aria-haspopup="true"
        aria-label="User menu"
        type="button"
      >
        <span className={styles.avatar}>{initials}</span>
      </button>

      {isOpen && (
        <div className={styles.dropdown} role="menu">
          <div className={styles.userInfo}>
            <span className={styles.userName}>
              {user.name}
              {effectiveIsPatron && (
                <span className={styles.patronBadge} aria-label="Patron">
                  patron
                </span>
              )}
            </span>
            <span className={styles.userEmail}>{user.email}</span>
          </div>

          <div className={styles.divider} />

          {isFeatureEnabled("admin") && hasRole(effectiveRoles, "admin") && (
            <Link
              to="/admin"
              className={styles.menuItem}
              role="menuitem"
              onClick={handleClose}
            >
              Admin
            </Link>
          )}

          {isFeatureEnabled("dashboard") && hasRole(effectiveRoles, "stakeholder") && (
            <Link
              to="/dashboard"
              className={styles.menuItem}
              role="menuitem"
              onClick={handleClose}
            >
              Dashboard
            </Link>
          )}

          {isFeatureEnabled("calendar") && hasRole(effectiveRoles, "stakeholder") && (
            <Link
              to="/calendar"
              className={styles.menuItem}
              role="menuitem"
              onClick={handleClose}
            >
              Calendar
            </Link>
          )}

          {(hasRole(effectiveRoles, "stakeholder") || hasRole(effectiveRoles, "admin")) && (
            <a
              href="https://files.s-nc.org"
              className={styles.menuItem}
              role="menuitem"
              target="_blank"
              rel="noopener noreferrer"
              onClick={handleClose}
            >
              Files
            </a>
          )}

          <Link
            to="/settings"
            className={styles.menuItem}
            role="menuitem"
            onClick={handleClose}
          >
            Settings
          </Link>

          {isFeatureEnabled("subscription") && (
            <Link
              to="/settings/subscriptions"
              className={styles.menuItem}
              role="menuitem"
              onClick={handleClose}
            >
              Subscriptions
            </Link>
          )}

          {isFeatureEnabled("booking") && (
            <Link
              to="/settings/bookings"
              className={styles.menuItem}
              role="menuitem"
              onClick={handleClose}
            >
              My Bookings
            </Link>
          )}

          <div className={styles.divider} />

          <button
            className={styles.logoutButton}
            onClick={handleLogout}
            role="menuitem"
            type="button"
          >
            Log out
          </button>
        </div>
      )}
    </div>
  );
}
