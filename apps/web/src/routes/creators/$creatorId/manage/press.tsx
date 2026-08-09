import { createFileRoute } from "@tanstack/react-router";
import type React from "react";

import { PressEditor } from "./-press-editor.js";

export const Route = createFileRoute("/creators/$creatorId/manage/press")({
  head: () => ({ meta: [{ title: "Manage Press Page — S/NC" }] }),
  component: ManagePressPage,
});

function ManagePressPage(): React.ReactElement {
  const { creatorId } = Route.useParams();
  return <PressEditor creatorId={creatorId} />;
}
