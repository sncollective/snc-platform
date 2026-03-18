import type { FeatureFlag, FeatureFlags } from "@snc/shared";

// ── Helpers ──

/** Parse a single env value: absent/empty → true (dev default), otherwise "true"/"false". */
const flag = (raw: string | undefined): boolean =>
  raw === undefined || raw === "" ? true : raw === "true";

// ── Public API ──

export const DEMO_MODE: boolean = import.meta.env.VITE_DEMO_MODE === "true";

/**
 * Resolved feature flags — absent env vars default to ON (dev behavior).
 * Each key is read via a static `import.meta.env.VITE_FEATURE_*` access
 * so Vite can replace them at build time.
 */
export const features: FeatureFlags = {
  content: flag(import.meta.env.VITE_FEATURE_CONTENT),
  creator: flag(import.meta.env.VITE_FEATURE_CREATOR),
  subscription: flag(import.meta.env.VITE_FEATURE_SUBSCRIPTION),
  merch: flag(import.meta.env.VITE_FEATURE_MERCH),
  booking: flag(import.meta.env.VITE_FEATURE_BOOKING),
  dashboard: flag(import.meta.env.VITE_FEATURE_DASHBOARD),
  admin: flag(import.meta.env.VITE_FEATURE_ADMIN),
  emissions: flag(import.meta.env.VITE_FEATURE_EMISSIONS),
  calendar: flag(import.meta.env.VITE_FEATURE_CALENDAR),
  federation: flag(import.meta.env.VITE_FEATURE_FEDERATION),
  streaming: flag(import.meta.env.VITE_FEATURE_STREAMING),
};

/** Check whether a single feature flag is enabled. */
export const isFeatureEnabled = (flag: FeatureFlag): boolean => features[flag];
