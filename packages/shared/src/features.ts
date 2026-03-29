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
  "federation",
  "streaming",
] as const;

/** A toggleable platform capability (content, creator, merch, etc.). */
export type FeatureFlag = (typeof FEATURE_FLAGS)[number];

/** Complete set of feature flags with their enabled/disabled state. */
export type FeatureFlags = Readonly<Record<FeatureFlag, boolean>>;

// ── Presets ──

/** Preset with every feature enabled — used in development and testing. */
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
  federation: true,
  streaming: true,
};

/** Preset with only production-ready features enabled. */
export const PRODUCTION_DEFAULTS: FeatureFlags = {
  content: true,
  creator: true,
  subscription: false,
  merch: false,
  booking: false,
  dashboard: false,
  admin: true,
  emissions: false,
  calendar: true,
  federation: false,
  streaming: true,
};

// ── Labels ──

/** Human-readable name and description for a feature flag. */
export interface FeatureLabelInfo {
  readonly name: string;
  readonly description: string;
}

/** Display labels and descriptions for each feature flag, used in the admin UI. */
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
    name: "Studio",
    description: "Recording studio, podcast production, practice space, and venue hire.",
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
  federation: {
    name: "Federation",
    description: "ActivityPub federation — discover S/NC creators from the Fediverse.",
  },
  streaming: {
    name: "Streaming",
    description:
      "Live streaming powered by SRS — watch creators perform live.",
  },
};
