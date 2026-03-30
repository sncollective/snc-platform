import type { FeatureFlag, Role, CreatorPermission } from "@snc/shared";

// ── Public Types ──

export interface ContextNavItem {
  readonly to: string;
  readonly label: string;
  readonly role?: Role;
  readonly creatorPermission?: CreatorPermission;
  readonly featureFlag?: FeatureFlag;
}

export interface ContextNavConfig {
  readonly label: string;
  readonly basePath: string;
  readonly backTo: string;
  readonly backLabel: string;
  readonly items: readonly ContextNavItem[];
}

// ── Admin Context ──

export const ADMIN_NAV: ContextNavConfig = {
  label: "Admin",
  basePath: "/admin",
  backTo: "/",
  backLabel: "Back to site",
  items: [
    { to: "", label: "Users" },
    { to: "/playout", label: "Playout", featureFlag: "streaming" },
    { to: "/simulcast", label: "Simulcast", featureFlag: "streaming" },
    { to: "/creators", label: "Creators" },
  ],
};

// ── Co-op Governance Context ──

export const GOVERNANCE_NAV: ContextNavConfig = {
  label: "Co-op",
  basePath: "/governance",
  backTo: "/",
  backLabel: "Back to site",
  items: [
    { to: "/calendar", label: "Calendar", featureFlag: "calendar" },
    { to: "/projects", label: "Projects", featureFlag: "calendar" },
  ],
};
