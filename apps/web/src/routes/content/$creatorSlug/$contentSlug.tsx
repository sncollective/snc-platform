import type React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { CREATOR_ROLE_PERMISSIONS } from "@snc/shared";
import type { FeedItem, SubscriptionPlan } from "@snc/shared";

import { RouteErrorBoundary } from "../../../components/error/route-error-boundary.js";
import { ComingSoon } from "../../../components/coming-soon/coming-soon.js";
import { ContentDetail } from "../../../components/content/content-detail.js";
import { fetchApiServer } from "../../../lib/api-server.js";
import { isFeatureEnabled } from "../../../lib/config.js";

// ── Private Types ──

export interface SlugContentDetailLoaderData {
  readonly item: FeedItem | null;
  readonly plans: readonly SubscriptionPlan[];
  readonly canManage: boolean;
}

// ── Private Helpers ──

function isContentLocked(item: FeedItem): boolean {
  return item.visibility === "subscribers" && item.mediaUrl === null && item.body === null;
}

// ── Route ──

export const Route = createFileRoute("/content/$creatorSlug/$contentSlug")({
  errorComponent: RouteErrorBoundary,
  validateSearch: (search: Record<string, unknown>) => ({
    edit: search["edit"] === "true" || search["edit"] === true,
  }),
  loader: async ({ params }): Promise<SlugContentDetailLoaderData> => {
    if (!isFeatureEnabled("content")) return { item: null, plans: [], canManage: false };

    const item = (await fetchApiServer({
      data: `/api/content/by-creator/${encodeURIComponent(params.creatorSlug)}/${encodeURIComponent(params.contentSlug)}`,
    })) as FeedItem;

    let plans: SubscriptionPlan[] = [];
    if (isContentLocked(item)) {
      try {
        const plansData = (await fetchApiServer({
          data: `/api/subscriptions/plans?creatorId=${encodeURIComponent(item.creatorId)}`,
        })) as { plans: SubscriptionPlan[] };
        plans = plansData.plans;
      } catch {
        // Plans fetch failure is non-fatal — SubscribeCta will show
        // the platform subscription fallback link instead
      }
    }

    let canManage = false;
    try {
      const me = (await fetchApiServer({
        data: "/api/me",
      })) as { user: { id: string }; roles: string[] } | null;
      if (me?.user) {
        if (me.roles.includes("admin")) {
          canManage = true;
        } else {
          try {
            const membersRes = (await fetchApiServer({
              data: `/api/creators/${encodeURIComponent(item.creatorId)}/members`,
            })) as { members: Array<{ userId: string; role: string }> };
            const membership = membersRes.members.find((m) => m.userId === me.user.id);
            if (membership) {
              const role = membership.role as "owner" | "editor" | "viewer";
              canManage = CREATOR_ROLE_PERMISSIONS[role].manageContent === true;
            }
          } catch {
            // Not a member — can't manage
          }
        }
      }
    } catch {
      // Not logged in
    }

    return { item, plans, canManage };
  },
  component: SlugContentDetailPage,
});

// ── Component ──

function SlugContentDetailPage(): React.ReactElement {
  const { item, plans, canManage } = Route.useLoaderData();
  const { edit } = Route.useSearch();
  if (!isFeatureEnabled("content") || item === null) return <ComingSoon feature="content" />;
  return <ContentDetail item={item} plans={plans} canManage={canManage} initialEdit={edit && canManage} />;
}
