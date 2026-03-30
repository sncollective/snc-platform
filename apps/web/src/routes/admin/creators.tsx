import { createFileRoute, Link } from "@tanstack/react-router";
import type React from "react";

import type { CreatorListItem } from "@snc/shared";

import { RouteErrorBoundary } from "../../components/error/route-error-boundary.js";
import { fetchApiServer } from "../../lib/api-server.js";
import listingStyles from "../../styles/listing-page.module.css";

// ── Private Types ──

interface AdminCreatorsLoaderData {
  readonly creators: readonly CreatorListItem[];
}

// ── Route ──

export const Route = createFileRoute("/admin/creators")({
  head: () => ({ meta: [{ title: "Creators — Admin — S/NC" }] }),
  errorComponent: RouteErrorBoundary,
  loader: async (): Promise<AdminCreatorsLoaderData> => {
    const data = await fetchApiServer({ data: "/api/creators" }) as { items: CreatorListItem[] };
    return { creators: data.items };
  },
  component: AdminCreatorsPage,
});

// ── Component ──

function AdminCreatorsPage(): React.ReactElement {
  const { creators } = Route.useLoaderData();

  return (
    <div>
      <h1 className={listingStyles.heading}>Creators</h1>
      {creators.length === 0 ? (
        <p className={listingStyles.status}>No creators found.</p>
      ) : (
        <ul>
          {creators.map((c) => (
            <li key={c.id}>
              <Link to="/creators/$creatorId/manage" params={{ creatorId: c.handle ?? c.id }}>
                {c.displayName}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
