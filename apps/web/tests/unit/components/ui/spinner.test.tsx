import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

import { Spinner } from "../../../../src/components/ui/spinner.js";

describe("Spinner", () => {
  it("renders with role=status", () => {
    render(<Spinner />);
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("renders default label text 'Loading' (visually hidden)", () => {
    render(<Spinner />);
    expect(screen.getByText("Loading")).toBeInTheDocument();
  });

  it("renders custom label text when provided", () => {
    render(<Spinner label="Saving changes" />);
    expect(screen.getByText("Saving changes")).toBeInTheDocument();
  });

  it("applies data-size attribute for sm", () => {
    render(<Spinner size="sm" />);
    expect(screen.getByRole("status")).toHaveAttribute("data-size", "sm");
  });

  it("applies data-size attribute for md (default)", () => {
    render(<Spinner />);
    expect(screen.getByRole("status")).toHaveAttribute("data-size", "md");
  });

  it("applies data-size attribute for lg", () => {
    render(<Spinner size="lg" />);
    expect(screen.getByRole("status")).toHaveAttribute("data-size", "lg");
  });

  it("has aria-live=polite for live region", () => {
    render(<Spinner />);
    expect(screen.getByRole("status")).toHaveAttribute("aria-live", "polite");
  });
});
