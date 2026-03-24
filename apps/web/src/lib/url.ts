// ── Public API ──

/** Navigate to an external URL via full page load. */
export function navigateExternal(url: string): void {
  window.location.href = url;
}

/**
 * Detect OIDC context from the authorize params that Better Auth puts in
 * the login page URL. Returns the authorize endpoint URL to redirect to
 * after login. Returns `null` when not in an OIDC flow or during SSR.
 */
export function getOidcAuthorizeUrl(): string | null {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  if (!params.has("client_id") || !params.has("redirect_uri")) return null;
  return `/api/auth/oauth2/authorize?${params.toString()}`;
}
