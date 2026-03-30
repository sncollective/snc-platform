import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/governance/")({
  beforeLoad: () => {
    throw redirect({ to: "/governance/calendar", statusCode: 301 });
  },
});
