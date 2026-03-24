import { useRef } from "react";

import { Link } from "@tanstack/react-router";
import type { Role } from "@snc/shared";

import { NAV_LINKS, isNavLinkActive } from "../../config/navigation.js";
import { useMenuToggle } from "../../hooks/use-menu-toggle.js";
import { authClient } from "../../lib/auth-client.js";
import { useSession, useAuthExtras, hasRole } from "../../lib/auth.js";
import type { AuthState } from "../../lib/auth.js";
import { isFeatureEnabled } from "../../lib/config.js";
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
  readonly isAuthenticated: boolean;
  readonly onClose: () => void;
}

function NavLinkList({ currentPath, effectiveRoles, isAuthenticated, onClose }: NavLinkListProps) {
  return (
    <ul className={styles.linkList}>
      {NAV_LINKS.map((link) => {
        if (link.role && !hasRole(effectiveRoles, link.role) && !hasRole(effectiveRoles, "admin")) {
          return null;
        }

        const isActive = isNavLinkActive(link, currentPath, NAV_LINKS);
        const className = clsx(
          styles.menuLink,
          link.disabled && styles.menuLinkDisabled,
          isActive && styles.menuLinkActive,
        );

        return (
          <li key={link.to}>
            {link.external ? (
              <a
                href={link.to}
                className={className}
                target="_blank"
                rel="noopener noreferrer"
                onClick={onClose}
              >
                {link.label}
              </a>
            ) : (
              <Link
                to={link.to}
                className={className}
                onClick={onClose}
              >
                {link.label}
              </Link>
            )}
          </li>
        );
      })}

      {isFeatureEnabled("dashboard") && isAuthenticated && hasRole(effectiveRoles, "stakeholder") && (
        <li>
          <MobileNavLink to="/dashboard" currentPath={currentPath} onClick={onClose}>
            Dashboard
          </MobileNavLink>
        </li>
      )}

      {isFeatureEnabled("calendar") && isAuthenticated && hasRole(effectiveRoles, "stakeholder") && (
        <li>
          <MobileNavLink to="/calendar" currentPath={currentPath} onClick={onClose}>
            Calendar
          </MobileNavLink>
        </li>
      )}

      {isAuthenticated && (hasRole(effectiveRoles, "stakeholder") || hasRole(effectiveRoles, "admin")) && (
        <li>
          <a
            href="https://files.s-nc.org"
            className={styles.menuLink}
            target="_blank"
            rel="noopener noreferrer"
            onClick={onClose}
          >
            Files
          </a>
        </li>
      )}
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
      {isFeatureEnabled("admin") && hasRole(effectiveRoles, "admin") && (
        <MobileNavLink to="/admin" currentPath={currentPath} onClick={onClose}>
          Admin
        </MobileNavLink>
      )}

      {isFeatureEnabled("calendar") && hasRole(effectiveRoles, "stakeholder") && (
        <MobileNavLink to="/projects" currentPath={currentPath} onClick={onClose}>
          Projects
        </MobileNavLink>
      )}

      <MobileNavLink to="/settings" currentPath={currentPath} exact onClick={onClose}>
        Settings
      </MobileNavLink>

      {isFeatureEnabled("subscription") && (
        <MobileNavLink to="/settings/subscriptions" currentPath={currentPath} onClick={onClose}>
          Subscriptions
        </MobileNavLink>
      )}

      {isFeatureEnabled("booking") && (
        <MobileNavLink to="/settings/bookings" currentPath={currentPath} onClick={onClose}>
          My Bookings
        </MobileNavLink>
      )}

      <button
        className={styles.logoutButton}
        onClick={onLogout}
        type="button"
      >
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
          aria-label="Mobile navigation"
        >
          <NavLinkList
            currentPath={currentPath}
            effectiveRoles={effectiveRoles}
            isAuthenticated={!!session.data}
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
