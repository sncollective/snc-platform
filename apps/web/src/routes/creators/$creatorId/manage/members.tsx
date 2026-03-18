import { createFileRoute, getRouteApi } from "@tanstack/react-router";
import type React from "react";

import { TeamSection } from "../../../../components/creator/team-section.js";

// ── Parent Route Reference ──

const parentRoute = getRouteApi("/creators/$creatorId/manage");

// ── Route ──

export const Route = createFileRoute("/creators/$creatorId/manage/members")({
  component: ManageMembersPage,
});

// ── Component ──

function ManageMembersPage(): React.ReactElement {
  const { creatorId } = Route.useParams();
  const { userId } = parentRoute.useLoaderData();

  return <TeamSection creatorId={creatorId} currentUserId={userId} />;
}
