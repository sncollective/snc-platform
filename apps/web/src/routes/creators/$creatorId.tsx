import { createFileRoute, Outlet } from "@tanstack/react-router";
import type React from "react";
import type { CreatorProfileResponse } from "@snc/shared";

import { fetchApiServer } from "../../lib/api-server.js";
import { isFeatureEnabled } from "../../lib/config.js";

// ── Route ──

export const Route = createFileRoute("/creators/$creatorId")({
  loader: async ({ params }): Promise<CreatorProfileResponse | null> => {
    if (!isFeatureEnabled("creator")) return null;
    return fetchApiServer({
      data: `/api/creators/${encodeURIComponent(params.creatorId)}`,
    }) as Promise<CreatorProfileResponse>;
  },
  component: CreatorLayout,
});

// ── Component ──

function CreatorLayout(): React.ReactElement {
  return <Outlet />;
}
