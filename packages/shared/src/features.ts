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
};
