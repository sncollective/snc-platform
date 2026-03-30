import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/dashboard")({
  beforeLoad: () => {
    throw redirect({ to: "/governance/calendar", statusCode: 301 });
  },
});
