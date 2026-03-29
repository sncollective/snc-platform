import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";

import type { AuthState } from "./auth.js";
import { GUEST_AUTH_STATE } from "./auth.js";
import { extractErrorMessage } from "./fetch-utils.js";
import { ssrLogger } from "./logger.js";

/** Resolve the API base URL from server-only env vars with fallback. */
function getServerBaseUrl(): string {
  const env =
    (globalThis as Record<string, unknown>).process as
      | { env?: Record<string, string | undefined> }
      | undefined;
  return (
    env?.env?.API_INTERNAL_URL ??
    env?.env?.VITE_API_URL ??
    "http://localhost:3000"
  );
}

/**
 * Build a headers object forwarding the incoming request's cookie.
 * Returns empty headers when called outside an SSR request context
 * (e.g. during client-side navigation RPC).
 */
function forwardCookies(): HeadersInit {
  const headers: HeadersInit = {};
  try {
    const cookie = getRequestHeader("cookie");
    if (cookie) {
      headers.cookie = cookie;
    }
  } catch {
    // getRequestHeader throws outside of SSR request context
  }
  return headers;
}

/**
 * Server-side API fetch. Runs exclusively on the server — during SSR it
 * executes directly; during client navigation TanStack Start calls it
 * via an RPC endpoint.
 *
 * Uses API_INTERNAL_URL (non-VITE_, server-only) so the SSR process can
 * reach the API without routing through the public domain / reverse proxy.
 */
export const fetchApiServer = createServerFn({ method: "GET" })
  .inputValidator((endpoint: string) => endpoint)
  .handler(async ({ data: endpoint }) => {
    const res = await fetch(`${getServerBaseUrl()}${endpoint}`, {
      headers: forwardCookies(),
    });
    if (!res.ok) {
      const message = await extractErrorMessage(res);
      ssrLogger.warn(
        { endpoint, statusCode: res.status, error: message },
        "SSR API fetch failed",
      );
      throw new Error(message);
    }
    return res.json();
  });

/**
 * Server-side auth state fetch. Same cookie-forwarding approach as
 * fetchApiServer but hardcoded to /api/me and returns AuthState with
 * graceful degradation (never throws).
 */
export const fetchAuthStateServer = createServerFn({ method: "GET" })
  .handler(async (): Promise<AuthState> => {
    let res: Response;
    try {
      res = await fetch(`${getServerBaseUrl()}/api/me`, {
        headers: forwardCookies(),
      });
    } catch (e) {
      ssrLogger.warn(
        { error: e instanceof Error ? e.message : String(e) },
        "SSR auth state fetch failed — network error",
      );
      return GUEST_AUTH_STATE;
    }

    if (!res.ok) {
      return GUEST_AUTH_STATE;
    }

    const body = (await res.json()) as { user: unknown; roles?: unknown[]; isPatron?: boolean };
    return {
      user: (body.user ?? null) as AuthState["user"],
      roles: (body.roles ?? []) as AuthState["roles"],
      isPatron: body.isPatron ?? false,
    };
  });
