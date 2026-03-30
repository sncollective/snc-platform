import type { FeatureFlag, Role } from "@snc/shared";

import { isFeatureEnabled } from "../lib/config.js";

// ── Public Types ──

export interface NavLink {
  readonly to: string;
  readonly label: string;
  readonly feature?: FeatureFlag;
  readonly disabled?: boolean;
  readonly external?: boolean;
  readonly role?: Role;
}

// ── Private Constants ──

const ALL_NAV_LINKS: readonly Omit<NavLink, "disabled">[] = [
  { to: "/feed", label: "Feed", feature: "content" },
  { to: "/creators", label: "Creators", feature: "creator" },
  { to: "/live", label: "Live", feature: "streaming" },
  { to: "/studio", label: "Studio", feature: "booking" },
  { to: "/merch", label: "Merch", feature: "merch" },
  { to: "/emissions", label: "Emissions", feature: "emissions" },
] as const;

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
