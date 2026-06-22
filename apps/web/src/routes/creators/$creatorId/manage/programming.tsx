import { createFileRoute, getRouteApi, Link } from "@tanstack/react-router";
import type React from "react";

import { EditorialSurface } from "../../../../components/playout/editorial-surface.js";
import {
  EditorialApiProvider,
  CREATOR_EDITORIAL_API,
} from "../../../../components/playout/editorial-api.js";
import { RouteErrorBoundary } from "../../../../components/error/route-error-boundary.js";
import { SpineProvider } from "../../../../contexts/spine-context.js";
import { fetchApiServer } from "../../../../lib/api-server.js";

import pageHeadingStyles from "../../../../styles/page-heading.module.css";
import listingStyles from "../../../../styles/listing-page.module.css";
import styles from "./programming-manage.module.css";

// ── Parent Route Reference ──

const parentRoute = getRouteApi("/creators/$creatorId/manage");

// ── Types ──

interface ProgrammingLoaderData {
  /** The creator's persistent channel id, or null when not yet provisioned. */
  readonly channelId: string | null;
}

// ── Route ──

export const Route = createFileRoute("/creators/$creatorId/manage/programming")({
  // Resolve the creator's channel id server-side. Null means the channel hasn't been
  // provisioned yet (no stream key created) — the component shows setup guidance, not
  // an error. Uses the SSR-safe server fetch (the client `fetchCreatorChannel` lib hits
  // the same `/api/creators/:id/channel` endpoint from the browser).
  loader: async ({ params }): Promise<ProgrammingLoaderData> => {
    const res = (await fetchApiServer({
      data: `/api/creators/${encodeURIComponent(params.creatorId)}/channel`,
    }).catch(() => ({ channelId: null }))) as { channelId: string | null };
    return { channelId: res.channelId ?? null };
  },
  head: () => ({ meta: [{ title: "Programming — S/NC" }] }),
  errorComponent: RouteErrorBoundary,
  component: ProgrammingPage,
});

// ── Spine Topics ──

// Creator editorial rides the `content` topic; `playout` is admin-only.
const CONTENT_TOPICS = ["content"] as const;

// ── Component ──

/**
 * Creator "Programming" tab — the shared `<EditorialSurface>` wired to the creator's own
 * channel via the creator-scoped editorial data layer (`/api/creator/playout/*`). When
 * the channel isn't provisioned yet, shows setup guidance linking to the Streaming tab
 * (creating the first stream key provisions the channel). Owner-only — the nav item is
 * gated on `manageStreaming`, which only the owner role carries.
 */
function ProgrammingPage(): React.ReactElement {
  const { channelId } = Route.useLoaderData();
  const { creator } = parentRoute.useLoaderData();
  const creatorSlug = creator.handle ?? creator.id;

  if (channelId === null) {
    return (
      <div className={styles.page}>
        <h1 className={pageHeadingStyles.heading}>Programming</h1>
        <div className={styles.setupCard}>
          <p className={styles.setupHeading}>Set up streaming to start programming</p>
          <p className={listingStyles.status}>
            Your channel is created the first time you add a stream key. Once it exists,
            you can build a queue and content pool here.
          </p>
          <Link
            to="/creators/$creatorId/manage/streaming"
            params={{ creatorId: creatorSlug }}
            className={styles.setupLink}
          >
            Go to Streaming
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <h1 className={pageHeadingStyles.heading}>Programming</h1>
      <SpineProvider topics={CONTENT_TOPICS}>
        <EditorialApiProvider api={CREATOR_EDITORIAL_API}>
          <EditorialSurface
            key={channelId}
            channelId={channelId}
            spineTopic="content"
            capabilities={{ channelCrud: false, broadcastBanner: false, channelTabs: false }}
          />
        </EditorialApiProvider>
      </SpineProvider>
    </div>
  );
}
