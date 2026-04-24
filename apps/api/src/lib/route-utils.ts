import { config, parseOrigins } from "../config.js";

/**
 * Derive the frontend base URL from the first configured CORS origin.
 * Used to construct user-facing URLs embedded in external flows — checkout
 * redirects, OAuth callbacks, invite emails — that must land on the web app
 * rather than the API host.
 */
export const getFrontendBaseUrl = (): string => {
  const origins = parseOrigins(config.CORS_ORIGIN);
  return origins[0] ?? "http://localhost:3080";
};
