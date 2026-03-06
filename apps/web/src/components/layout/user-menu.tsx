import { useCallback, useRef } from "react";

import { Link, useNavigate } from "@tanstack/react-router";

import { useMenuToggle } from "../../hooks/use-menu-toggle.js";
import { authClient } from "../../lib/auth-client.js";
import { useSession, useRoles, hasRole } from "../../lib/auth.js";
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

export function UserMenu() {
  const session = useSession();
  const roles = useRoles();
  const navigate = useNavigate();
  const menuRef = useRef<HTMLDivElement>(null);
  const { isOpen, handleToggle, handleClose } = useMenuToggle(menuRef);

  const handleLogout = useCallback(async () => {
    await authClient.signOut();
    handleClose();
    void navigate({ to: "/" });
  }, [navigate, handleClose]);

  if (session.isPending) {
    return null;
  }

  if (!session.data) {
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

  const user = session.data.user;
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

          {hasRole(roles, "admin") && (
            <Link
              to="/admin"
              className={styles.menuItem}
              role="menuitem"
              onClick={handleClose}
            >
              Admin
            </Link>
          )}

          {hasRole(roles, "cooperative-member") && (
            <Link
              to="/dashboard"
              className={styles.menuItem}
              role="menuitem"
              onClick={handleClose}
            >
              Dashboard
            </Link>
          )}

          {hasRole(roles, "creator") && (
            <Link
              to="/settings/creator"
              className={styles.menuItem}
              role="menuitem"
              onClick={handleClose}
            >
              Creator Settings
            </Link>
          )}

          {hasRole(roles, "creator") && (
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
