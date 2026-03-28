import type React from "react";
import { createFileRoute, Link, getRouteApi } from "@tanstack/react-router";
import type { FeedItem } from "@snc/shared";

import { RouteErrorBoundary } from "../../../../../components/error/route-error-boundary.js";
import { ContentEditor } from "../../../../../components/content/content-editor.js";
import { fetchApiServer } from "../../../../../lib/api-server.js";

import styles from "../content-manage.module.css";

// ── Types ──

interface ContentEditLoaderData {
  readonly item: FeedItem;
}

// ── Route ──

const manageRoute = getRouteApi("/creators/$creatorId/manage");

export const Route = createFileRoute(
  "/creators/$creatorId/manage/content/$contentId",
)({
  errorComponent: RouteErrorBoundary,
  loader: async ({ params }): Promise<ContentEditLoaderData> => {
    const item = (await fetchApiServer({
      data: `/api/content/${encodeURIComponent(params.contentId)}`,
    })) as FeedItem;
    return { item };
  },
  head: ({ loaderData }) => ({
    meta: [
      {
        title: loaderData?.item
          ? `Edit: ${loaderData.item.title} — S/NC`
          : "Edit Content — S/NC",
      },
    ],
  }),
  component: ContentEditPage,
});

// ── Component ──

function ContentEditPage(): React.ReactElement {
  const { item } = Route.useLoaderData();
  const { creator } = manageRoute.useLoaderData();

  return (
    <div>
      <div className={styles.sectionHeader}>
        <Link
          to="/creators/$creatorId/manage/content"
          params={{ creatorId: creator.handle ?? creator.id }}
          className={styles.backLink}
        >
          ← Back to Content
        </Link>
        <h2 className={styles.sectionTitle}>Edit: {item.title}</h2>
      </div>
      <ContentEditor item={item} />
    </div>
  );
}
