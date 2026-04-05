import type { FeatureFlag, Role } from "@snc/shared";

import { Rss, Users, Radio, Mic, ShoppingBag, Leaf } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { isFeatureEnabled } from "../lib/config.js";

// ── Public Types ──

export interface NavLink {
  readonly to: string;
  readonly label: string;
  readonly icon?: LucideIcon;
  readonly feature?: FeatureFlag;
  readonly disabled?: boolean;
  readonly external?: boolean;
  readonly role?: Role;
}

// ── Private Constants ──

const ALL_NAV_LINKS: readonly Omit<NavLink, "disabled">[] = [
  { to: "/feed", label: "Feed", icon: Rss },
  { to: "/creators", label: "Creators", icon: Users },
  { to: "/live", label: "Live", icon: Radio },
  { to: "/studio", label: "Studio", feature: "booking", icon: Mic },
  { to: "/merch", label: "Merch", feature: "merch", icon: ShoppingBag },
  { to: "/emissions", label: "Emissions", feature: "emissions", icon: Leaf },
];

// ── Public API ──

export const NAV_LINKS: readonly NavLink[] = ALL_NAV_LINKS.map((link) => ({
  ...link,
  disabled: link.feature !== undefined && !isFeatureEnabled(link.feature),
}));

/**
 * Determines whether a nav link is "active" using a most-specific-match algorithm.
 * A link is active only if its path matches the current path AND no longer (more specific)
 * link in `allLinks` also matches.
 */
export function isNavLinkActive(
  link: NavLink,
  currentPath: string,
  allLinks: readonly NavLink[],
): boolean {
  const pathMatches = !link.external && !link.disabled &&
    (currentPath === link.to || currentPath.startsWith(`${link.to}/`));
  return pathMatches && !allLinks.some(
    (other) => other !== link && !other.external && other.to.startsWith(link.to) &&
      other.to.length > link.to.length &&
      (currentPath === other.to || currentPath.startsWith(`${other.to}/`)),
  );
}
