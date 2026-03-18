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
  { to: "https://s-nc.org/studio", label: "Studio", feature: "booking", external: true },
  { to: "/merch", label: "Merch", feature: "merch" },
  { to: "/pricing", label: "Pricing", feature: "subscription" },
  { to: "/emissions", label: "Emissions", feature: "emissions" },
] as const;

// ── Public API ──

export const NAV_LINKS: readonly NavLink[] = ALL_NAV_LINKS.map((link) => ({
  ...link,
  disabled: link.feature !== undefined && !isFeatureEnabled(link.feature),
}));
