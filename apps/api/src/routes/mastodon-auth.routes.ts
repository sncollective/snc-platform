import { Hono } from "hono";
import { describeRoute, resolver, validator } from "hono-openapi";
import { z } from "zod";

import { config } from "../config.js";
import {
  startMastodonAuth,
  handleMastodonCallback,
} from "../services/mastodon-auth.js";
import type { AuthEnv } from "../middleware/auth-env.js";
import { ERROR_400, ERROR_502 } from "../lib/openapi-errors.js";

// ── Schemas ──

/**
 * Validate a Mastodon instance hostname. Rejects localhost, private IP
 * ranges, container service names, and embedded protocol/paths to prevent
 * SSRF via the app-registration fetch at `getOrRegisterApp`.
 */
const isPublicHostname = (value: string): boolean => {
  // Must be a plain hostname — no protocol, no path, no userinfo, no port override.
  if (/[\s:/?#@]/.test(value)) return false;
  const lower = value.toLowerCase();
  // Reject literal IPv4 (any address — we don't probe raw IPs).
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(lower)) return false;
  // Reject localhost + common internal-only TLDs + container / k8s service names.
  const forbiddenExact = new Set(["localhost", "localhost.localdomain"]);
  if (forbiddenExact.has(lower)) return false;
  const forbiddenSuffixes = [".local", ".internal", ".docker.internal", ".svc", ".svc.cluster.local"];
  if (forbiddenSuffixes.some((suffix) => lower.endsWith(suffix))) return false;
  // Must contain at least one dot (single-label names like `snc-postgres` or `mailpit` are reject-worthy).
  if (!lower.includes(".")) return false;
  // Length sanity per DNS RFC.
  if (lower.length > 253) return false;
  return true;
};

const StartMastodonAuthBody = z.object({
  instanceDomain: z.string().min(1).refine(isPublicHostname, {
    message: "instanceDomain must be a public hostname (no IPs, localhost, or internal TLDs)",
  }),
});

const MastodonCallbackQuery = z.object({
  code: z.string().min(1),
  state: z.string().min(1),
});

const MastodonStartResponseSchema = z.object({
  authorizationUrl: z.string().url(),
});

// ── Router ──

/** Mastodon OAuth login routes — start flow and handle callback. */
export const mastodonAuthRoutes = new Hono<AuthEnv>();

// ── POST /start ──

mastodonAuthRoutes.post(
  "/start",
  describeRoute({
    description: "Initiate Mastodon OAuth login for a given instance domain",
    tags: ["auth-mastodon"],
    responses: {
      200: {
        description: "Authorization URL to redirect the user to",
        content: {
          "application/json": { schema: resolver(MastodonStartResponseSchema) },
        },
      },
      400: ERROR_400,
      502: ERROR_502,
    },
  }),
  validator("json", StartMastodonAuthBody),
  async (c) => {
    const { instanceDomain } = c.req.valid("json" as never) as z.infer<typeof StartMastodonAuthBody>;
    const result = await startMastodonAuth(instanceDomain);
    if (!result.ok) throw result.error;
    return c.json({ authorizationUrl: result.value.authorizationUrl });
  },
);

// ── GET /callback ──

mastodonAuthRoutes.get(
  "/callback",
  describeRoute({
    description: "Handle Mastodon OAuth callback, create session, and redirect",
    tags: ["auth-mastodon"],
    responses: {
      302: { description: "Redirect to app after successful login" },
      400: ERROR_400,
      502: ERROR_502,
    },
  }),
  validator("query", MastodonCallbackQuery),
  async (c) => {
    const { code, state } = c.req.valid("query" as never) as z.infer<typeof MastodonCallbackQuery>;
    const result = await handleMastodonCallback(code, state);
    if (!result.ok) throw result.error;

    const { sessionToken, expiresAt } = result.value;

    // Set the session cookie in the same format Better Auth uses
    const cookieDomain = new URL(config.BETTER_AUTH_URL).hostname;
    const isSecure = config.BETTER_AUTH_URL.startsWith("https://");
    const cookieValue = `better-auth.session_token=${sessionToken}; Path=/; HttpOnly; SameSite=Lax; Expires=${expiresAt.toUTCString()}${isSecure ? "; Secure" : ""}${cookieDomain !== "localhost" ? `; Domain=${cookieDomain}` : ""}`;

    c.header("Set-Cookie", cookieValue);
    return c.redirect(config.BETTER_AUTH_URL, 302);
  },
);
