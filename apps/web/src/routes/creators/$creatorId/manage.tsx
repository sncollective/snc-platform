import { createFileRoute, Link, Outlet, redirect, useRouterState } from "@tanstack/react-router";
import type React from "react";

import type { CreatorProfileResponse, CreatorMemberRole, CreatorPermission } from "@snc/shared";
import { CREATOR_ROLE_PERMISSIONS } from "@snc/shared";

import { fetchApiServer, fetchAuthStateServer } from "../../../lib/api-server.js";
import { isFeatureEnabled } from "../../../lib/config.js";
import styles from "./manage.module.css";

// ── Types ──

interface ManageLoaderData {
  readonly creator: CreatorProfileResponse;
  readonly memberRole: CreatorMemberRole;
  readonly isAdmin: boolean;
  readonly userId: string;
}

// ── Tab Config ──

interface ManageTab {
  readonly to: string;
  readonly label: string;
  readonly permission?: CreatorPermission;
}

const MANAGE_TABS: readonly ManageTab[] = [
  { to: "", label: "Overview" },
  { to: "/content", label: "Content", permission: "manageContent" },
  { to: "/settings", label: "Settings", permission: "editProfile" },
  { to: "/members", label: "Members", permission: "manageMembers" },
] as const;

// ── Route ──

export const Route = createFileRoute("/creators/$creatorId/manage")({
  beforeLoad: async () => {
    if (!isFeatureEnabled("creator")) throw redirect({ to: "/" });

    const { user, roles } = await fetchAuthStateServer();
    if (!user) throw redirect({ to: "/login" });
    if (!roles.includes("stakeholder") && !roles.includes("admin")) {
      throw redirect({ to: "/creators" });
    }

    return { userId: user.id, platformRoles: roles };
  },
  loader: async ({ params, context }): Promise<ManageLoaderData> => {
    const creator = (await fetchApiServer({
      data: `/api/creators/${encodeURIComponent(params.creatorId)}`,
    })) as CreatorProfileResponse;

    const membersRes = (await fetchApiServer({
      data: `/api/creators/${encodeURIComponent(params.creatorId)}/members`,
    })) as { members: Array<{ userId: string; role: CreatorMemberRole }> };

    const membership = membersRes.members.find((m) => m.userId === context.userId);
    const isAdmin = context.platformRoles.includes("admin");

    return {
      creator,
      memberRole: membership?.role ?? "viewer",
      isAdmin,
      userId: context.userId,
    };
  },
  component: ManageLayout,
});

// ── Component ──

function ManageLayout(): React.ReactElement {
  const { creator, memberRole, isAdmin } = Route.useLoaderData();
  const { creatorId } = Route.useParams();
  const routerState = useRouterState();
  const currentPath = routerState.location.pathname;
  const basePath = `/creators/${creatorId}/manage`;

  const permissions = isAdmin
    ? CREATOR_ROLE_PERMISSIONS.owner
    : CREATOR_ROLE_PERMISSIONS[memberRole];

  return (
    <div className={styles.layout}>
      <header className={styles.header}>
        <h1 className={styles.heading}>{creator.displayName}</h1>
        <Link
          to="/creators/$creatorId"
          params={{ creatorId }}
          className={styles.viewPublic}
        >
          View public page
        </Link>
      </header>

      <nav className={styles.tabs} aria-label="Creator management">
        {MANAGE_TABS.map((tab) => {
          if (tab.permission && !permissions[tab.permission]) return null;

          const tabPath = `${basePath}${tab.to}`;
          const isActive =
            tab.to === ""
              ? currentPath === basePath || currentPath === `${basePath}/`
              : currentPath.startsWith(tabPath);

          return (
            <Link
              key={tab.to}
              to={tabPath}
              className={`${styles.tab} ${isActive ? styles.tabActive : ""}`}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>

      <div className={styles.content}>
        <Outlet />
      </div>
    </div>
  );
}
