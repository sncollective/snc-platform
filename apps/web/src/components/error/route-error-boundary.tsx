import type { ErrorComponentProps } from "@tanstack/react-router";

import { AccessDeniedError } from "../../lib/errors.js";
import { ErrorPage } from "./error-page.js";

export function RouteErrorBoundary({ error, reset }: ErrorComponentProps) {
  if (error instanceof AccessDeniedError) {
    return (
      <ErrorPage
        statusCode={403}
        title="Access denied"
        description="You don't have permission to view this page."
      />
    );
  }

  const message =
    error instanceof Error
      ? error.message
      : "An unexpected error occurred. Please try again.";

  return (
    <ErrorPage
      statusCode={500}
      title="Something went wrong"
      description={message}
      showRetry
      onRetry={reset}
    />
  );
}
