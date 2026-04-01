import type { FeatureFlag, FeatureFlags } from "@snc/shared";

// ── Helpers ──

/** Parse a single env value: absent/empty → true (dev default), otherwise "true"/"false". */
const parseFlag = (raw: string | undefined): boolean =>
  raw === undefined || raw === "" ? true : raw === "true";

// ── Public API ──

export const DEMO_MODE: boolean = import.meta.env.VITE_DEMO_MODE === "true";

/**
 * Resolved feature flags — absent env vars default to ON (dev behavior).
 * Each key is read via a static `import.meta.env.VITE_FEATURE_*` access
 * so Vite can replace them at build time.
 */
export const features: FeatureFlags = {
  subscription: parseFlag(import.meta.env.VITE_FEATURE_SUBSCRIPTION),
  merch: parseFlag(import.meta.env.VITE_FEATURE_MERCH),
  booking: parseFlag(import.meta.env.VITE_FEATURE_BOOKING),
  emissions: parseFlag(import.meta.env.VITE_FEATURE_EMISSIONS),
  federation: parseFlag(import.meta.env.VITE_FEATURE_FEDERATION),
};

/** Check whether a single feature flag is enabled. */
export const isFeatureEnabled = (flag: FeatureFlag): boolean => features[flag];
