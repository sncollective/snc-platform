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

const StartMastodonAuthBody = z.object({
  instanceDomain: z.string().min(1),
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
