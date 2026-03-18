import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import type React from "react";

import type { MyCreatorItem } from "@snc/shared";

import { MyCreatorCard } from "../../components/creator/my-creator-card.js";
import { fetchApiServer, fetchAuthStateServer } from "../../lib/api-server.js";
import { isFeatureEnabled } from "../../lib/config.js";
import styles from "./creators.module.css";
import listingStyles from "../../styles/listing-page.module.css";

// ── Route ──

export const Route = createFileRoute("/creators/mine")({
  beforeLoad: async () => {
    if (!isFeatureEnabled("creator")) throw redirect({ to: "/" });

    const { user, roles } = await fetchAuthStateServer();

    if (!user) {
      throw redirect({ to: "/login" });
    }

    if (!roles.includes("stakeholder") && !roles.includes("admin")) {
      throw redirect({ to: "/creators" });
    }
  },
  loader: async (): Promise<{ items: MyCreatorItem[] }> => {
    try {
      const res = (await fetchApiServer({
        data: "/api/creators/mine",
      })) as { items: MyCreatorItem[]; nextCursor: string | null };
      return { items: res.items };
    } catch {
      return { items: [] };
    }
  },
  component: MyCreatorsPage,
});

// ── Component ──

function MyCreatorsPage(): React.ReactElement {
  const { items } = Route.useLoaderData();

  return (
    <div className={styles.creatorsPage}>
      <h1 className={listingStyles.heading}>My Creators</h1>
      {items.length === 0 ? (
        <p className={listingStyles.status}>
          You don&apos;t have any creator pages yet.{" "}
          <Link to="/creators">Browse creators</Link>
        </p>
      ) : (
        <div className="content-grid">
          {items.map((creator) => (
            <MyCreatorCard key={creator.id} creator={creator} />
          ))}
        </div>
      )}
    </div>
  );
}
