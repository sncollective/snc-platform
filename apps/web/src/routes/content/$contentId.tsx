import type React from "react";
import { createFileRoute } from "@tanstack/react-router";
import type { FeedItem } from "@snc/shared";

import { ContentDetail } from "../../components/content/content-detail.js";
import { fetchApiServer } from "../../lib/api-server.js";

// ── Route ──

export const Route = createFileRoute("/content/$contentId")({
  loader: async ({ params }): Promise<FeedItem> => {
    return fetchApiServer({
      data: `/api/content/${encodeURIComponent(params.contentId)}`,
    }) as Promise<FeedItem>;
  },
  component: ContentDetailPage,
});

// ── Component ──

function ContentDetailPage(): React.ReactElement {
  const item = Route.useLoaderData();
  return <ContentDetail item={item} />;
}
