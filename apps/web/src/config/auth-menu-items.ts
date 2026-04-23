import type { Role } from "@snc/shared";
import { Bell, CreditCard, FolderOpen, type LucideIcon, Settings, Shield, Users } from "lucide-react";

import { isFeatureEnabled } from "../lib/config.js";
import { hasRole } from "../lib/auth.js";

// ── Public Types ──

export interface AuthMenuItem {
  readonly key: string;
  readonly to: string;
  readonly label: string;
  readonly icon: LucideIcon;
  readonly external?: boolean;
}

// ── Public API ──

/**
 * Returns the ordered list of authenticated user-action menu items for the given roles.
 * Covers: Admin, Co-op, Files, Settings, Notifications, Subscriptions.
 * Used in both the desktop UserMenu dropdown and the mobile AuthenticatedNav section.
 */
export function getAuthMenuItems(effectiveRoles: readonly Role[]): readonly AuthMenuItem[] {
  const items: AuthMenuItem[] = [];

  if (hasRole(effectiveRoles, "admin")) {
    items.push({ key: "admin", to: "/admin", label: "Admin", icon: Shield });
  }

  if (hasRole(effectiveRoles, "stakeholder")) {
    items.push({ key: "governance", to: "/governance", label: "Co-op", icon: Users });
  }

  if (hasRole(effectiveRoles, "stakeholder") || hasRole(effectiveRoles, "admin")) {
    items.push({ key: "files", to: "https://files.s-nc.org", label: "Files", icon: FolderOpen, external: true });
  }

  items.push({ key: "settings", to: "/settings", label: "Settings", icon: Settings });
  items.push({ key: "notifications", to: "/settings/notifications", label: "Notifications", icon: Bell });

  if (isFeatureEnabled("subscription")) {
    items.push({ key: "subscriptions", to: "/settings/subscriptions", label: "Subscriptions", icon: CreditCard });
  }

  return items;
}
