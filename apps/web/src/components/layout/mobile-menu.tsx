import { useRef } from "react";

import { Link } from "@tanstack/react-router";
import { LogOut, Menu } from "lucide-react";
import type { Role } from "@snc/shared";

import { NAV_LINKS } from "../../config/navigation.js";
import { getAuthMenuItems } from "../../config/auth-menu-items.js";
import { useMenuToggle } from "../../hooks/use-menu-toggle.js";
import { authClient } from "../../lib/auth-client.js";
import { useSession, useAuthExtras, hasRole } from "../../lib/auth.js";
import type { AuthState } from "../../lib/auth.js";
import { NavLinkItem } from "./nav-link-item.js";
import { clsx } from "clsx/lite";

import styles from "./mobile-menu.module.css";

// ── Public Types ──

export interface MobileMenuProps {
  readonly currentPath: string;
  readonly serverAuth?: AuthState;
}

// ── Private Components ──

interface MobileNavLinkProps {
  readonly to: string;
  readonly currentPath: string;
  readonly exact?: boolean;
  readonly onClick: () => void;
  readonly children: React.ReactNode;
}

function MobileNavLink({ to, currentPath, exact, onClick, children }: MobileNavLinkProps) {
  const isActive = exact
    ? currentPath === to
    : currentPath === to || currentPath.startsWith(`${to}/`);
  const className = clsx(styles.menuLink, isActive && styles.menuLinkActive);
  return <Link to={to} className={className} onClick={onClick}>{children}</Link>;
}

interface NavLinkListProps {
  readonly currentPath: string;
  readonly effectiveRoles: readonly Role[];
  readonly onClose: () => void;
}

function NavLinkList({ currentPath, effectiveRoles, onClose }: NavLinkListProps) {
  return (
    <ul className={styles.linkList}>
      {NAV_LINKS.map((link) => (
        <NavLinkItem
          key={link.to}
          link={link}
          currentPath={currentPath}
          effectiveRoles={effectiveRoles}
          linkClass={styles.menuLink}
          activeClass={styles.menuLinkActive}
          disabledClass={styles.menuLinkDisabled}
          onClick={onClose}
        />
      ))}
    </ul>
  );
}

interface AuthenticatedNavProps {
  readonly currentPath: string;
  readonly effectiveRoles: readonly Role[];
  readonly onClose: () => void;
  readonly onLogout: () => void;
}

function AuthenticatedNav({ currentPath, effectiveRoles, onClose, onLogout }: AuthenticatedNavProps) {
  return (
    <div className={styles.authSection}>
      {getAuthMenuItems(effectiveRoles).map((item) =>
        item.external ? (
          <a
            key={item.key}
            href={item.to}
            className={styles.menuLink}
            target="_blank"
            rel="noopener noreferrer"
            onClick={onClose}
          >
            <item.icon size={16} aria-hidden="true" />
            {item.label}
          </a>
        ) : (
          <MobileNavLink key={item.key} to={item.to} currentPath={currentPath} onClick={onClose}>
            <item.icon size={16} aria-hidden="true" />
            {item.label}
          </MobileNavLink>
        )
      )}

      <button
        className={styles.logoutButton}
        onClick={onLogout}
        type="button"
      >
        <LogOut size={16} aria-hidden="true" />
        Log out
      </button>
    </div>
  );
}

interface UnauthenticatedNavProps {
  readonly onClose: () => void;
}

function UnauthenticatedNav({ onClose }: UnauthenticatedNavProps) {
  return (
    <div className={styles.authSection}>
      <Link
        to="/login"
        className={styles.menuLink}
        onClick={onClose}
      >
        Log in
      </Link>
      <Link
        to="/register"
        className={styles.menuLink}
        onClick={onClose}
      >
        Sign up
      </Link>
    </div>
  );
}

// ── Public API ──

/** Hamburger-triggered mobile navigation overlay with auth-aware links and logout. */
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
        <Menu size={24} aria-hidden="true" />
      </button>

      {isOpen && (
        <nav
          className={styles.overlay}
          aria-label="Mobile navigation"
        >
          <NavLinkList
            currentPath={currentPath}
            effectiveRoles={effectiveRoles}
            onClose={handleClose}
          />

          <div className={styles.divider} />

          {session.data ? (
            <AuthenticatedNav
              currentPath={currentPath}
              effectiveRoles={effectiveRoles}
              onClose={handleClose}
              onLogout={() => void handleLogout()}
            />
          ) : (
            <UnauthenticatedNav onClose={handleClose} />
          )}
        </nav>
      )}
    </div>
  );
}
