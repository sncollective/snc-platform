/** Build a paginated content list API URL with optional filters. */
export function buildContentListUrl(
  endpoint: "/api/content" | "/api/content/drafts",
  params: {
    readonly creatorId: string;
    readonly limit?: number;
    readonly type?: string | null;
    readonly cursor?: string | null;
  },
): string {
  const qs = new URLSearchParams();
  qs.set("creatorId", params.creatorId);
  qs.set("limit", String(params.limit ?? 12));
  if (params.type) qs.set("type", params.type);
  if (params.cursor) qs.set("cursor", params.cursor);
  return `${endpoint}?${qs.toString()}`;
}
