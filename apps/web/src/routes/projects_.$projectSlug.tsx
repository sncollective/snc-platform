import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/projects_/$projectSlug")({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: "/governance/projects/$projectSlug",
      params: { projectSlug: params.projectSlug },
      statusCode: 301,
    });
  },
});
