const SKIP_RETURN_TO = new Set(["/", "/login", "/register"]);

/** Build a login redirect object, attaching a returnTo param unless the current path is trivial. */
export function buildLoginRedirect(currentPath: string): {
  to: string;
  search?: { returnTo: string };
} {
  if (SKIP_RETURN_TO.has(currentPath)) {
    return { to: "/login" };
  }

  return { to: "/login", search: { returnTo: currentPath } };
}

/** Sanitize a returnTo value, rejecting non-relative paths and falling back to "/feed". */
export function getValidReturnTo(returnTo: unknown): string {
  if (typeof returnTo !== "string" || returnTo.length === 0) return "/feed";

  if (
    !returnTo.startsWith("/") ||
    returnTo.startsWith("//") ||
    returnTo.includes("://")
  ) {
    return "/feed";
  }

  return returnTo;
}
