import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import type React from "react";

import type { CreatorProfileResponse, CreatorMemberRole, CreatorPermission } from "@snc/shared";
import { CREATOR_ROLE_PERMISSIONS } from "@snc/shared";

import { RouteErrorBoundary } from "../../../components/error/route-error-boundary.js";
import { ContextShell } from "../../../components/layout/context-shell.js";
import { CreatorSwitcher } from "../../../components/layout/creator-switcher.js";
import type { ContextNavConfig, ContextNavItem } from "../../../config/context-nav.js";
import { fetchApiServer, fetchAuthStateServer } from "../../../lib/api-server.js";
import { AccessDeniedError } from "../../../lib/errors.js";
import { buildLoginRedirect } from "../../../lib/return-to.js";

// ── Types ──

export interface ManageLoaderData {
  readonly creator: CreatorProfileResponse;
  readonly memberRole: CreatorMemberRole;
  readonly isAdmin: boolean;
  readonly userId: string;
}

// ── Nav Config ──

const MANAGE_ITEMS: readonly ContextNavItem[] = [
  { to: "", label: "Overview" },
  { to: "/content", label: "Content", creatorPermission: "manageContent" },
  { to: "/calendar", label: "Calendar", creatorPermission: "manageScheduling" },
  { to: "/projects", label: "Projects", creatorPermission: "manageScheduling" },
  { to: "/streaming", label: "Streaming" },
  { to: "/settings", label: "Settings", creatorPermission: "editProfile" },
  { to: "/members", label: "Members" },
];

// ── Route ──

export const Route = createFileRoute("/creators/$creatorId/manage")({
  beforeLoad: async ({ location, params }) => {
    const { user, roles } = await fetchAuthStateServer();
    if (!user) throw redirect(buildLoginRedirect(location.pathname));

    if (!roles.includes("admin")) {
      // Non-admin: check team membership for this specific creator
      const [membershipsRes, creatorRes] = await Promise.all([
        fetchApiServer({ data: "/api/me/creators" }) as Promise<{
          creators: Array<{ id: string; displayName: string; handle: string; role: string; avatarUrl: string | null }>;
        }>,
        fetchApiServer({
          data: `/api/creators/${encodeURIComponent(params.creatorId)}`,
        }) as Promise<import("@snc/shared").CreatorProfileResponse>,
      ]);

      const isMember = membershipsRes.creators.some((m) => m.id === creatorRes.id);
      if (!isMember) {
        throw new AccessDeniedError();
      }

      return { userId: user.id, platformRoles: roles, resolvedCreator: creatorRes };
    }

    return { userId: user.id, platformRoles: roles, resolvedCreator: null };
  },
  errorComponent: RouteErrorBoundary,
  loader: async ({ params, context }): Promise<ManageLoaderData> => {
    const [creator, membersRes] = await Promise.all([
      context.resolvedCreator
        ? Promise.resolve(context.resolvedCreator)
        : (fetchApiServer({
            data: `/api/creators/${encodeURIComponent(params.creatorId)}`,
          }) as Promise<CreatorProfileResponse>),
      fetchApiServer({
        data: `/api/creators/${encodeURIComponent(params.creatorId)}/members`,
      }) as Promise<{ members: Array<{ userId: string; role: CreatorMemberRole }> }>,
    ]);

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
  const creatorSlug = creator.handle ?? creator.id;
  const basePath = `/creators/${creatorSlug}/manage`;

  const permissions = isAdmin
    ? CREATOR_ROLE_PERMISSIONS.owner
    : CREATOR_ROLE_PERMISSIONS[memberRole];

  const config: ContextNavConfig = {
    label: creator.displayName,
    basePath,
    backTo: `/creators/${creatorSlug}`,
    backLabel: "View public page",
    items: MANAGE_ITEMS,
  };

  const itemFilter = (item: ContextNavItem): boolean => {
    if (item.creatorPermission && !permissions[item.creatorPermission as CreatorPermission]) return false;
    // Streaming: owner-only (not in permission matrix)
    if (item.to === "/streaming" && memberRole !== "owner" && !isAdmin) return false;
    return true;
  };

  return (
    <ContextShell
      config={config}
      headerSlot={<CreatorSwitcher currentCreatorId={creator.id} currentSlug={creatorSlug} />}
      itemFilter={itemFilter}
    >
      <Outlet />
    </ContextShell>
  );
}
