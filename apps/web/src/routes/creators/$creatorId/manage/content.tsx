import { createFileRoute } from "@tanstack/react-router";
import type React from "react";

// ── Route ──

export const Route = createFileRoute("/creators/$creatorId/manage/content")({
  component: ManageContentPage,
});

// ── Component ──

function ManageContentPage(): React.ReactElement {
  return (
    <div>
      <h2>Content</h2>
      <p>Content management for this creator will be available in a future update.</p>
    </div>
  );
}
