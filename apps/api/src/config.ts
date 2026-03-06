import { z } from "zod";

// ── Public Types ──

export const ENV_SCHEMA = z.object({
  DATABASE_URL: z.string().min(1),
  PORT: z.coerce.number().int().default(3000),
  CORS_ORIGIN: z.string().default("http://localhost:3080"),
  BETTER_AUTH_SECRET: z.string().min(32),
  BETTER_AUTH_URL: z.string().url().default("http://localhost:3080"),
  STORAGE_TYPE: z.enum(["local"]).default("local"),
  STORAGE_LOCAL_DIR: z.string().default("./uploads"),
  // Phase 7: Stripe (optional — API returns 503 BILLING_NOT_CONFIGURED when absent)
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  // Phase 8: Shopify (optional — API returns 503 MERCH_NOT_CONFIGURED when absent)
  SHOPIFY_STORE_DOMAIN: z.string().optional(),
  SHOPIFY_STOREFRONT_TOKEN: z.string().optional(),
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
 * Validated application configuration. Crashes at import time if required
 * environment variables are missing.
 */
export const config: Config = parseConfig(process.env);
