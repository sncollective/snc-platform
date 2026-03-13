// ── Public Types ──

export const FEATURE_FLAGS = [
  "content",
  "creator",
  "subscription",
  "merch",
  "booking",
  "dashboard",
  "admin",
  "emissions",
  "calendar",
] as const;

export type FeatureFlag = (typeof FEATURE_FLAGS)[number];

export type FeatureFlags = Record<FeatureFlag, boolean>;

// ── Presets ──

export const ALL_FEATURES_ON: FeatureFlags = {
  content: true,
  creator: true,
  subscription: true,
  merch: true,
  booking: true,
  dashboard: true,
  admin: true,
  emissions: true,
  calendar: true,
};

export const PRODUCTION_DEFAULTS: FeatureFlags = {
  content: false,
  creator: false,
  subscription: false,
  merch: false,
  booking: false,
  dashboard: false,
  admin: true,
  emissions: false,
  calendar: false,
};

// ── Labels ──

export interface FeatureLabelInfo {
  readonly name: string;
  readonly description: string;
}

export const FEATURE_LABELS: Record<FeatureFlag, FeatureLabelInfo> = {
  content: {
    name: "Content",
    description: "Videos, audio, and written content from our creators.",
  },
  creator: {
    name: "Creators",
    description: "Creator profiles, portfolios, and subscription pages.",
  },
  subscription: {
    name: "Subscriptions",
    description: "Platform and creator subscription plans.",
  },
  merch: {
    name: "Merch",
    description: "Merchandise from our creators and the collective.",
  },
  booking: {
    name: "Services",
    description: "Studio and label services available for booking.",
  },
  dashboard: {
    name: "Dashboard",
    description: "Cooperative member dashboard with KPIs and analytics.",
  },
  admin: {
    name: "Admin",
    description: "Platform administration and feature management.",
  },
  emissions: {
    name: "Emissions",
    description: "Our carbon footprint — tracked, reduced, and offset.",
  },
  calendar: {
    name: "Calendar",
    description: "Cooperative calendar with events and .ics feed.",
  },
};
