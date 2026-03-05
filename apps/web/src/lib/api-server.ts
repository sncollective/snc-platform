import { createServerFn } from "@tanstack/react-start";

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

    const res = await fetch(`${baseUrl}${endpoint}`);
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      const message =
        (body as { error?: { message?: string } } | null)?.error?.message ??
        res.statusText;
      throw new Error(message);
    }
    return res.json();
  });
