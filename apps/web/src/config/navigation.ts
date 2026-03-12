import type { FeatureFlag } from "@snc/shared";

import { isFeatureEnabled } from "../lib/config.js";

// ── Public Types ──

export interface NavLink {
  readonly to: string;
  readonly label: string;
  readonly feature?: FeatureFlag;
}

// ── Private Constants ──

const ALL_NAV_LINKS: readonly NavLink[] = [
  { to: "/feed", label: "Feed", feature: "content" },
  { to: "/creators", label: "Creators", feature: "creator" },
  { to: "/services", label: "Services", feature: "booking" },
  { to: "/merch", label: "Merch", feature: "merch" },
  { to: "/pricing", label: "Pricing", feature: "subscription" },
  { to: "/emissions", label: "Emissions", feature: "emissions" },
] as const;

// ── Public API ──

export const NAV_LINKS: readonly NavLink[] = ALL_NAV_LINKS.filter(
  (link) => !link.feature || isFeatureEnabled(link.feature),
);
