import { useNavigate, Link } from "@tanstack/react-router";
import { LogOut } from "lucide-react";

import { authClient } from "../../lib/auth-client.js";
import { useSession, useAuthExtras } from "../../lib/auth.js";
import type { AuthState } from "../../lib/auth.js";
import { getAuthMenuItems } from "../../config/auth-menu-items.js";
import { clsx } from "clsx/lite";

import { getInitials } from "../../lib/format.js";
import {
  MenuRoot,
  MenuTrigger,
  MenuContent,
  MenuItem,
  MenuSeparator,
} from "../ui/menu.js";
import styles from "./user-menu.module.css";

// ── Public API ──

/** Avatar button dropdown menu showing user info, role-based nav items, and logout. */
export function UserMenu({ serverAuth }: { readonly serverAuth?: AuthState }) {
  const session = useSession();
  const { roles, isPatron } = useAuthExtras();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await authClient.signOut();
    } catch {
      // Sign-out failed — navigate to login as fallback
    }
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
    <MenuRoot>
      <MenuTrigger asChild>
        <button
          className={styles.avatarButton}
          aria-label="User menu"
          type="button"
        >
          <span className={clsx(styles.avatar, effectiveIsPatron && styles.patronAvatar)}>
            {initials}
          </span>
        </button>
      </MenuTrigger>

      <MenuContent>
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

        <MenuSeparator />

        {getAuthMenuItems(effectiveRoles).map((item) =>
          item.external ? (
            <MenuItem key={item.key} value={item.key} asChild>
              <a
                href={item.to}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.menuItem}
              >
                <item.icon size={16} aria-hidden="true" />
                {item.label}
              </a>
            </MenuItem>
          ) : (
            <MenuItem key={item.key} value={item.key} asChild>
              <Link to={item.to} className={styles.menuItem}>
                <item.icon size={16} aria-hidden="true" />
                {item.label}
              </Link>
            </MenuItem>
          )
        )}

        <MenuSeparator />

        <MenuItem value="logout" onSelect={() => void handleLogout()}>
          <LogOut size={16} aria-hidden="true" />
          Log out
        </MenuItem>
      </MenuContent>
    </MenuRoot>
  );
}
