import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";

import type { AuthState } from "./auth.js";

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
    const env =
      (globalThis as Record<string, unknown>).process as
        | { env?: Record<string, string | undefined> }
        | undefined;
    const baseUrl =
      env?.env?.API_INTERNAL_URL ??
      env?.env?.VITE_API_URL ??
      "http://localhost:3000";

    const headers: HeadersInit = {};
    try {
      const cookie = getRequestHeader("cookie");
      if (cookie) {
        headers.cookie = cookie;
      }
    } catch {
      // getRequestHeader throws outside of SSR request context (e.g. client navigation)
    }

    const res = await fetch(`${baseUrl}${endpoint}`, { headers });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      const message =
        (body as { error?: { message?: string } } | null)?.error?.message ??
        res.statusText;
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
    const env =
      (globalThis as Record<string, unknown>).process as
        | { env?: Record<string, string | undefined> }
        | undefined;
    const baseUrl =
      env?.env?.API_INTERNAL_URL ??
      env?.env?.VITE_API_URL ??
      "http://localhost:3000";

    const headers: HeadersInit = {};
    try {
      const cookie = getRequestHeader("cookie");
      if (cookie) {
        headers.cookie = cookie;
      }
    } catch {
      // getRequestHeader throws outside of SSR request context
    }

    let res: Response;
    try {
      res = await fetch(`${baseUrl}/api/me`, { headers });
    } catch {
      return { user: null, roles: [] };
    }

    if (!res.ok) {
      return { user: null, roles: [] };
    }

    const body = (await res.json()) as { user: unknown; roles?: unknown[] };
    return {
      user: (body.user ?? null) as AuthState["user"],
      roles: (body.roles ?? []) as AuthState["roles"],
    };
  });
