import { createFileRoute, Link, getRouteApi } from "@tanstack/react-router";
import type React from "react";

import { CREATOR_ROLE_PERMISSIONS } from "@snc/shared";

import styles from "./overview.module.css";

// ── Parent Route Reference ──

const parentRoute = getRouteApi("/creators/$creatorId/manage");

// ── Route ──

export const Route = createFileRoute("/creators/$creatorId/manage/")({
  component: OverviewPage,
});

// ── Component ──

function OverviewPage(): React.ReactElement {
  const { creatorId } = Route.useParams();
  const { memberRole, isAdmin } = parentRoute.useLoaderData();
  const permissions = isAdmin
    ? CREATOR_ROLE_PERMISSIONS.owner
    : CREATOR_ROLE_PERMISSIONS[memberRole];

  return (
    <div className={styles.overview}>
      <section className={styles.section}>
        <h2 className={styles.sectionHeading}>Quick Links</h2>
        <div className={styles.quickLinks}>
          {permissions.editProfile && (
            <Link
              to="/creators/$creatorId/manage/settings"
              params={{ creatorId }}
              className={styles.quickLink}
            >
              Edit Profile
            </Link>
          )}
          {permissions.manageMembers && (
            <Link
              to="/creators/$creatorId/manage/members"
              params={{ creatorId }}
              className={styles.quickLink}
            >
              Manage Team
            </Link>
          )}
          <Link
            to="/creators/$creatorId"
            params={{ creatorId }}
            className={styles.quickLink}
          >
            View Public Page
          </Link>
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionHeading}>Coming Soon</h2>
        <p className={styles.placeholder}>
          Content scheduling and merchandise management will appear here in future updates.
        </p>
      </section>
    </div>
  );
}
