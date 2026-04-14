import type React from "react";
import type { Role } from "@snc/shared";

import { Link } from "@tanstack/react-router";
import { clsx } from "clsx/lite";

import { hasRole } from "../../lib/auth.js";
import { NAV_LINKS, isNavLinkActive } from "../../config/navigation.js";
import type { NavLink } from "../../config/navigation.js";

// ── Public Types ──

export interface NavLinkItemProps {
  readonly link: NavLink;
  readonly currentPath: string;
  readonly effectiveRoles: readonly Role[];
  /** CSS class for the base (non-active, non-disabled) link. */
  readonly linkClass: string | undefined;
  /** CSS class applied when the link is active. */
  readonly activeClass: string | undefined;
  /** CSS class applied when the link is disabled. */
  readonly disabledClass: string | undefined;
  readonly onClick?: () => void;
}

// ── Public API ──

/** Renders a single nav link with role-gating, active-state, and external/internal handling. Returns null when the user lacks the required role. */
export function NavLinkItem({
  link,
  currentPath,
  effectiveRoles,
  linkClass,
  activeClass,
  disabledClass,
  onClick,
}: NavLinkItemProps): React.ReactElement | null {
  if (link.role && !hasRole(effectiveRoles, link.role) && !hasRole(effectiveRoles, "admin")) {
    return null;
  }

  const isActive = isNavLinkActive(link, currentPath, NAV_LINKS);
  const className = clsx(
    linkClass,
    link.disabled && disabledClass,
    isActive && activeClass,
  );

  return (
    <li key={link.to}>
      {link.external ? (
        <a
          href={link.to}
          className={className}
          target="_blank"
          rel="noopener noreferrer"
          onClick={onClick}
        >
          {link.icon && <link.icon size={16} aria-hidden="true" />}
          {link.label}
        </a>
      ) : (
        <Link to={link.to} className={className} onClick={onClick}>
          {link.icon && <link.icon size={16} aria-hidden="true" />}
          {link.label}
        </Link>
      )}
    </li>
  );
}
