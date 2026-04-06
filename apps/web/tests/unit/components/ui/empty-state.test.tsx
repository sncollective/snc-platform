import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

import { EmptyState } from "../../../../src/components/ui/empty-state.js";

describe("EmptyState", () => {
  it("renders the message", () => {
    render(<EmptyState message="No content yet." />);
    expect(screen.getByText("No content yet.")).toBeInTheDocument();
  });

  it("has role=status for assistive tech", () => {
    render(<EmptyState message="Nothing here." />);
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("renders optional title as h3 when provided", () => {
    render(<EmptyState message="Nothing here." title="Empty feed" />);
    const heading = screen.getByRole("heading", { level: 3, name: "Empty feed" });
    expect(heading).toBeInTheDocument();
  });

  it("does not render a heading when title is not provided", () => {
    render(<EmptyState message="Nothing here." />);
    expect(screen.queryByRole("heading")).toBeNull();
  });

  it("renders optional icon when provided", () => {
    render(
      <EmptyState
        message="Nothing here."
        icon={<svg data-testid="icon" />}
      />,
    );
    expect(screen.getByTestId("icon")).toBeInTheDocument();
  });

  it("does not render icon slot when icon is not provided", () => {
    const { container } = render(<EmptyState message="Nothing here." />);
    // No icon span should exist
    expect(container.querySelector("svg")).toBeNull();
  });

  it("renders optional action when provided", () => {
    render(
      <EmptyState
        message="Nothing here."
        action={<button>Create one</button>}
      />,
    );
    expect(screen.getByRole("button", { name: "Create one" })).toBeInTheDocument();
  });

  it("does not render action area when action is not provided", () => {
    render(<EmptyState message="Nothing here." />);
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("merges custom className with emptyState class", () => {
    render(<EmptyState message="Nothing here." className="custom" />);
    const el = screen.getByRole("status");
    expect(el.className).toContain("emptyState");
    expect(el.className).toContain("custom");
  });
});
