import type { Context } from "hono";
import { Hono } from "hono";
import { describeRoute, resolver } from "hono-openapi";
import { z } from "zod";

import { UserSchema } from "@snc/shared";

import { auth } from "../auth/auth.js";

// ── Schemas (OpenAPI documentation only) ──

const AuthSessionResponse = z.object({
  token: z.string(),
  expiresAt: z.string(),
});

const AuthResponse = z.object({
  user: UserSchema,
  session: AuthSessionResponse,
});

const AuthErrorResponse = z.object({
  message: z.string(),
});

// ── Private Helpers ──

const handleAuth = (c: Context) => auth.handler(c.req.raw);

// ── Public API ──

export const authRoutes = new Hono();

authRoutes.post(
  "/sign-up/email",
  describeRoute({
    description: "Register a new user with email and password",
    tags: ["auth"],
    requestBody: {
      content: {
        "application/json": {
          // @ts-expect-error — hono-openapi handles ResolverReturnType in requestBody at runtime (rhinobase/hono-openapi#145)
          schema: resolver(
            z.object({
              name: z.string(),
              email: z.string().email(),
              password: z.string().min(8),
            }),
          ),
        },
      },
    },
    responses: {
      200: {
        description: "User created and session established",
        content: {
          "application/json": { schema: resolver(AuthResponse) },
        },
      },
      422: {
        description: "Validation error or duplicate email",
        content: {
          "application/json": { schema: resolver(AuthErrorResponse) },
        },
      },
    },
  }),
  handleAuth,
);

authRoutes.post(
  "/sign-in/email",
  describeRoute({
    description: "Authenticate with email and password",
    tags: ["auth"],
    requestBody: {
      content: {
        "application/json": {
          // @ts-expect-error — hono-openapi handles ResolverReturnType in requestBody at runtime (rhinobase/hono-openapi#145)
          schema: resolver(
            z.object({
              email: z.string().email(),
              password: z.string(),
            }),
          ),
        },
      },
    },
    responses: {
      200: {
        description: "Authentication successful, session cookie set",
        content: {
          "application/json": { schema: resolver(AuthResponse) },
        },
      },
      401: {
        description: "Invalid credentials",
        content: {
          "application/json": { schema: resolver(AuthErrorResponse) },
        },
      },
    },
  }),
  handleAuth,
);

authRoutes.post(
  "/sign-out",
  describeRoute({
    description: "Destroy the current session",
    tags: ["auth"],
    responses: {
      200: {
        description: "Session destroyed",
        content: {
          "application/json": {
            schema: resolver(z.object({ success: z.boolean() })),
          },
        },
      },
    },
  }),
  handleAuth,
);

authRoutes.get(
  "/get-session",
  describeRoute({
    description: "Return the current session and user info",
    tags: ["auth"],
    responses: {
      200: {
        description: "Current session info (null if not authenticated)",
        content: {
          "application/json": { schema: resolver(AuthResponse.nullable()) },
        },
      },
    },
  }),
  handleAuth,
);

// Catch-all for any other Better Auth endpoints
authRoutes.all("/*", handleAuth);
