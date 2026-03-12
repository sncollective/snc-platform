import { FEATURE_FLAGS } from "@snc/shared";
import type { FeatureFlag, FeatureFlags } from "@snc/shared";

// ── Public API ──

export const DEMO_MODE: boolean = import.meta.env.VITE_DEMO_MODE === "true";

/** Resolved feature flags — absent env vars default to ON (dev behavior). */
export const features: FeatureFlags = Object.fromEntries(
  FEATURE_FLAGS.map((flag) => {
    const envKey = `VITE_FEATURE_${flag.toUpperCase()}` as keyof ImportMetaEnv;
    const raw = import.meta.env[envKey];
    return [flag, raw === undefined || raw === "" ? true : raw === "true"];
  }),
) as FeatureFlags;

/** Check whether a single feature flag is enabled. */
export const isFeatureEnabled = (flag: FeatureFlag): boolean => features[flag];
