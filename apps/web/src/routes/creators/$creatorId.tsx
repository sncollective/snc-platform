import { createFileRoute, Outlet } from "@tanstack/react-router";
import type React from "react";
import type { CreatorProfileResponse } from "@snc/shared";

import { RouteErrorBoundary } from "../../components/error/route-error-boundary.js";
import { fetchApiServer } from "../../lib/api-server.js";
import { buildCreatorJsonLd } from "../../lib/json-ld.js";

// ── Route ──

export const Route = createFileRoute("/creators/$creatorId")({
  errorComponent: RouteErrorBoundary,
  loader: async ({ params }): Promise<CreatorProfileResponse | null> => {
    return fetchApiServer({
      data: `/api/creators/${encodeURIComponent(params.creatorId)}`,
    }) as Promise<CreatorProfileResponse>;
  },
  head: ({ loaderData }) => {
    if (!loaderData) return {};
    const siteUrl = import.meta.env.VITE_SITE_URL ?? "";
    const canonicalSlug = loaderData.handle ?? loaderData.id;
    return {
      meta: [
        { title: `${loaderData.displayName} — S/NC` },
        { name: "description", content: loaderData.bio ?? "" },
        { property: "og:title", content: loaderData.displayName },
        { property: "og:description", content: loaderData.bio ?? "" },
        { property: "og:type", content: "profile" },
        { property: "og:url", content: `${siteUrl}/creators/${canonicalSlug}` },
        ...(loaderData.avatarUrl
          ? [{ property: "og:image", content: `${siteUrl}${loaderData.avatarUrl}` }]
          : []),
      ],
      links: [
        { rel: "canonical", href: `${siteUrl}/creators/${canonicalSlug}` },
      ],
      scripts: [
        {
          type: "application/ld+json",
          children: JSON.stringify(buildCreatorJsonLd(loaderData, siteUrl)),
        },
      ],
    };
  },
  component: CreatorLayout,
});

// ── Component ──

function CreatorLayout(): React.ReactElement {
  return <Outlet />;
}
