import { useRef } from "react";

import { Link, useNavigate } from "@tanstack/react-router";
import { LogOut } from "lucide-react";

import { useMenuToggle } from "../../hooks/use-menu-toggle.js";
import { authClient } from "../../lib/auth-client.js";
import { useSession, useAuthExtras } from "../../lib/auth.js";
import type { AuthState } from "../../lib/auth.js";
import { getAuthMenuItems } from "../../config/auth-menu-items.js";
import { clsx } from "clsx/lite";

import { getInitials } from "../../lib/format.js";
import styles from "./user-menu.module.css";

// ── Public API ──

/** Avatar button dropdown menu showing user info, role-based nav items, and logout. */
export function UserMenu({ serverAuth }: { readonly serverAuth?: AuthState }) {
  const session = useSession();
  const { roles, isPatron } = useAuthExtras();
  const navigate = useNavigate();
  const menuRef = useRef<HTMLDivElement>(null);
  const { isOpen, handleToggle, handleClose } = useMenuToggle(menuRef);

  const handleLogout = async () => {
    try {
      await authClient.signOut();
    } catch {
      // Sign-out failed — navigate to login as fallback
    }
    handleClose();
    void navigate({ to: "/login" });
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
        <span className={clsx(styles.avatar, effectiveIsPatron && styles.patronAvatar)}>
          {initials}
        </span>
      </button>

      {isOpen && (
        <div className={styles.dropdown}>
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

          {getAuthMenuItems(effectiveRoles).map((item) =>
            item.external ? (
              <a
                key={item.key}
                href={item.to}
                className={styles.menuItem}
                target="_blank"
                rel="noopener noreferrer"
                onClick={handleClose}
              >
                <item.icon size={16} aria-hidden="true" />
                {item.label}
              </a>
            ) : (
              <Link
                key={item.key}
                to={item.to}
                className={styles.menuItem}
                onClick={handleClose}
              >
                <item.icon size={16} aria-hidden="true" />
                {item.label}
              </Link>
            )
          )}

          <div className={styles.divider} />

          <button
            className={styles.logoutButton}
            onClick={handleLogout}
            type="button"
          >
            <LogOut size={16} aria-hidden="true" />
            Log out
          </button>
        </div>
      )}
    </div>
  );
}
