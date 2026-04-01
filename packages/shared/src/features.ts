// ── Public Types ──

export const FEATURE_FLAGS = [
  "subscription",
  "merch",
  "booking",
  "emissions",
  "federation",
] as const;

/** A toggleable platform capability (subscription, merch, booking, etc.). */
export type FeatureFlag = (typeof FEATURE_FLAGS)[number];

/** Complete set of feature flags with their enabled/disabled state. */
export type FeatureFlags = Readonly<Record<FeatureFlag, boolean>>;

// ── Presets ──

/** Preset with every feature enabled — used in development and testing. */
export const ALL_FEATURES_ON: FeatureFlags = {
  subscription: true,
  merch: true,
  booking: true,
  emissions: true,
  federation: true,
};

// ── Labels ──

/** Human-readable name and description for a feature flag. */
export interface FeatureLabelInfo {
  readonly name: string;
  readonly description: string;
}

/** Display labels and descriptions for each feature flag, used in the admin UI. */
export const FEATURE_LABELS: Record<FeatureFlag, FeatureLabelInfo> = {
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
  emissions: {
    name: "Emissions",
    description: "Our carbon footprint — tracked, reduced, and offset.",
  },
  federation: {
    name: "Federation",
    description: "ActivityPub federation — discover S/NC creators from the Fediverse.",
  },
};
