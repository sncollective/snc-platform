import type { Role } from "@snc/shared";

import { isFeatureEnabled } from "../lib/config.js";
import { hasRole } from "../lib/auth.js";

// ── Public Types ──

export interface AuthMenuItem {
  readonly key: string;
  readonly to: string;
  readonly label: string;
  readonly external?: boolean;
}

// ── Public API ──

/**
 * Returns the ordered list of authenticated user-action menu items for the given roles.
 * Covers: Admin, Dashboard, Calendar, Projects, Files, Settings, Subscriptions, My Bookings.
 * Used in both the desktop UserMenu dropdown and the mobile AuthenticatedNav section.
 */
export function getAuthMenuItems(effectiveRoles: readonly Role[]): readonly AuthMenuItem[] {
  const items: AuthMenuItem[] = [];

  if (isFeatureEnabled("admin") && hasRole(effectiveRoles, "admin")) {
    items.push({ key: "admin", to: "/admin", label: "Admin" });
  }

  if (isFeatureEnabled("dashboard") && hasRole(effectiveRoles, "stakeholder")) {
    items.push({ key: "dashboard", to: "/dashboard", label: "Dashboard" });
  }

  if (isFeatureEnabled("calendar") && hasRole(effectiveRoles, "stakeholder")) {
    items.push({ key: "calendar", to: "/calendar", label: "Calendar" });
  }

  if (isFeatureEnabled("calendar") && hasRole(effectiveRoles, "stakeholder")) {
    items.push({ key: "projects", to: "/projects", label: "Projects" });
  }

  if (hasRole(effectiveRoles, "stakeholder") || hasRole(effectiveRoles, "admin")) {
    items.push({ key: "files", to: "https://files.s-nc.org", label: "Files", external: true });
  }

  items.push({ key: "settings", to: "/settings", label: "Settings" });

  if (isFeatureEnabled("subscription")) {
    items.push({ key: "subscriptions", to: "/settings/subscriptions", label: "Subscriptions" });
  }

  if (isFeatureEnabled("booking")) {
    items.push({ key: "bookings", to: "/settings/bookings", label: "My Bookings" });
  }

  return items;
}
