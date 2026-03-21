import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

import { AccessDeniedError } from "../../../../src/lib/errors.js";

// ── Component Under Test ──

const { RouteErrorBoundary } = await import(
  "../../../../src/components/error/route-error-boundary.js"
);

// ── Tests ──

describe("RouteErrorBoundary", () => {
  it("renders 403 for AccessDeniedError", () => {
    const error = new AccessDeniedError();
    render(<RouteErrorBoundary error={error} reset={vi.fn()} />);

    expect(screen.getByText("403")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Access denied" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("You don't have permission to view this page."),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Try again" }),
    ).not.toBeInTheDocument();
  });

  it("renders generic error with retry for other errors", () => {
    const error = new Error("Something broke");
    const reset = vi.fn();
    render(<RouteErrorBoundary error={error} reset={reset} />);

    expect(screen.getByText("500")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Something went wrong" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Something broke")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Try again" }),
    ).toBeInTheDocument();
  });

  it("shows fallback message for non-Error throws", () => {
    const error = "string error" as unknown as Error;
    render(<RouteErrorBoundary error={error} reset={vi.fn()} />);

    expect(
      screen.getByText("An unexpected error occurred. Please try again."),
    ).toBeInTheDocument();
  });
});
