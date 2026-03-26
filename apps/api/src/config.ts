import { z } from "zod";
import type { FeatureFlags } from "@snc/shared";

// ── Private Helpers ──

const booleanFlag = z
  .string()
  .default("true")
  .transform((v) => v === "true");

// ── Public Types ──

export const ENV_SCHEMA = z.object({
  DATABASE_URL: z.string().min(1),
  PORT: z.coerce.number().int().default(3000),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),
  CORS_ORIGIN: z.string().default("http://localhost:3080"),
  BETTER_AUTH_SECRET: z.string().min(32),
  BETTER_AUTH_URL: z.string().url().default("http://localhost:3080"),
  STORAGE_TYPE: z.enum(["local", "s3"]).default("local"),
  STORAGE_LOCAL_DIR: z.string().default("./uploads"),
  // S3-compatible storage (required when STORAGE_TYPE is "s3")
  S3_ENDPOINT: z.string().url().optional(),
  S3_REGION: z.string().default("garage"),
  S3_BUCKET: z.string().optional(),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),
  // Phase 7: Stripe (optional — API returns 503 BILLING_NOT_CONFIGURED when absent)
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  // Phase 8: Shopify (optional — API returns 503 MERCH_NOT_CONFIGURED when absent)
  SHOPIFY_STORE_DOMAIN: z.string().optional(),
  SHOPIFY_STOREFRONT_TOKEN: z.string().optional(),
  // Seafile OIDC (optional — OIDC provider inactive when absent)
  SEAFILE_OIDC_CLIENT_ID: z.string().optional(),
  SEAFILE_OIDC_CLIENT_SECRET: z.string().min(32).optional(),
  // SMTP (optional — email features degrade gracefully when absent)
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().default(587),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  EMAIL_FROM: z.string().default("S/NC <noreply@s-nc.org>"),
  STUDIO_INQUIRY_EMAIL: z.string().email().optional(),
  // Feature flags (default ON — set "false" to disable a domain)
  FEATURE_CONTENT: booleanFlag,
  FEATURE_CREATOR: booleanFlag,
  FEATURE_SUBSCRIPTION: booleanFlag,
  FEATURE_MERCH: booleanFlag,
  FEATURE_BOOKING: booleanFlag,
  FEATURE_DASHBOARD: booleanFlag,
  FEATURE_ADMIN: booleanFlag,
  FEATURE_EMISSIONS: booleanFlag,
  FEATURE_CALENDAR: booleanFlag,
  // SRS streaming server (optional — API returns 503 STREAMING_NOT_CONFIGURED when absent)
  SRS_API_URL: z.string().url().optional(),
  SRS_HLS_URL: z.string().url().optional(),
  SRS_STREAM_KEY: z.string().min(1).optional(),
  // Phase 11: ActivityPub federation (off by default — domain must be configured)
  FEDERATION_DOMAIN: z.string().min(1).default("s-nc.org"),
  FEATURE_FEDERATION: z
    .string()
    .default("false")
    .transform((v) => v === "true"),
  FEATURE_STREAMING: z
    .string()
    .default("false")
    .transform((v) => v === "true"),
});

export type Config = z.infer<typeof ENV_SCHEMA>;

// ── Public API ──

/**
 * Parse a CORS_ORIGIN config string into an array of origin strings.
 * Supports a single origin or comma-separated list.
 */
export const parseOrigins = (raw: string): string[] =>
  raw
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);

/**
 * Parse and validate an environment variable record against the config schema.
 * Throws a ZodError if required variables are missing or invalid.
 *
 * Exported for testability — call with a custom env object in tests.
 */
export const parseConfig = (
  env: Record<string, string | undefined>,
): Config => {
  return ENV_SCHEMA.parse(env);
};

/**
 * Extract feature flags from a parsed Config object.
 */
export const getFeatureFlags = (cfg: Config): FeatureFlags => ({
  content: cfg.FEATURE_CONTENT,
  creator: cfg.FEATURE_CREATOR,
  subscription: cfg.FEATURE_SUBSCRIPTION,
  merch: cfg.FEATURE_MERCH,
  booking: cfg.FEATURE_BOOKING,
  dashboard: cfg.FEATURE_DASHBOARD,
  admin: cfg.FEATURE_ADMIN,
  emissions: cfg.FEATURE_EMISSIONS,
  calendar: cfg.FEATURE_CALENDAR,
  federation: cfg.FEATURE_FEDERATION,
  streaming: cfg.FEATURE_STREAMING,
});

/**
 * Validated application configuration. Crashes at import time if required
 * environment variables are missing.
 */
export const config: Config = parseConfig(process.env);

/** Resolved feature flags for the running environment. */
export const features: FeatureFlags = getFeatureFlags(config);
