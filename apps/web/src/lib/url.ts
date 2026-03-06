// ── Public API ──

export function buildMediaUrl(relativePath: string | null): string | null {
  if (!relativePath) {
    return null;
  }
  return relativePath;
}
