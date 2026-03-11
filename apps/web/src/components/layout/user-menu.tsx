import { useRef } from "react";

import { Link, useNavigate } from "@tanstack/react-router";

import { useMenuToggle } from "../../hooks/use-menu-toggle.js";
import { authClient } from "../../lib/auth-client.js";
import { useSession, useRoles, hasRole } from "../../lib/auth.js";
import type { AuthState } from "../../lib/auth.js";
import styles from "./user-menu.module.css";

// ── Private Helpers ──

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

// ── Public API ──

export function UserMenu({ serverAuth }: { readonly serverAuth?: AuthState }) {
  const session = useSession();
  const roles = useRoles();
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
            <span className={styles.userName}>{user.name}</span>
            <span className={styles.userEmail}>{user.email}</span>
          </div>

          <div className={styles.divider} />

          {hasRole(effectiveRoles, "admin") && (
            <Link
              to="/admin"
              className={styles.menuItem}
              role="menuitem"
              onClick={handleClose}
            >
              Admin
            </Link>
          )}

          {hasRole(effectiveRoles, "cooperative-member") && (
            <Link
              to="/dashboard"
              className={styles.menuItem}
              role="menuitem"
              onClick={handleClose}
            >
              Dashboard
            </Link>
          )}

          {hasRole(effectiveRoles, "creator") && (
            <Link
              to="/settings/creator"
              className={styles.menuItem}
              role="menuitem"
              onClick={handleClose}
            >
              Creator Settings
            </Link>
          )}

          {hasRole(effectiveRoles, "creator") && (
            <Link
              to="/settings/content"
              className={styles.menuItem}
              role="menuitem"
              onClick={handleClose}
            >
              My Content
            </Link>
          )}

          <Link
            to="/settings"
            className={styles.menuItem}
            role="menuitem"
            onClick={handleClose}
          >
            Settings
          </Link>

          <Link
            to="/settings/subscriptions"
            className={styles.menuItem}
            role="menuitem"
            onClick={handleClose}
          >
            Subscriptions
          </Link>

          <Link
            to="/settings/bookings"
            className={styles.menuItem}
            role="menuitem"
            onClick={handleClose}
          >
            My Bookings
          </Link>

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
