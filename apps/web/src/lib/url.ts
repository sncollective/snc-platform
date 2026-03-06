// ── Public API ──

export function buildMediaUrl(relativePath: string | null): string | null {
  if (!relativePath) {
    return null;
  }
  return relativePath;
}

export function navigateExternal(url: string): void {
  window.location.href = url;
}
