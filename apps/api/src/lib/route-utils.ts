import { config, parseOrigins } from "../config.js";

/**
 * Derive the frontend base URL from the CORS_ORIGIN config.
 * Used to construct redirect URLs for external checkout flows.
 */
export const getFrontendBaseUrl = (): string => {
  const origins = parseOrigins(config.CORS_ORIGIN);
  return origins[0] ?? "http://localhost:3001";
};
