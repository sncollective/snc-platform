import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

import { createRouterMock } from "../../../helpers/router-mock.js";

vi.mock("@tanstack/react-router", () => createRouterMock());

import { ComingSoon } from "../../../../src/components/coming-soon/coming-soon.js";

describe("ComingSoon", () => {
  it("renders heading with feature name", () => {
    render(<ComingSoon feature="content" />);

    expect(
      screen.getByRole("heading", { level: 1, name: "Content — Coming Soon" }),
    ).toBeInTheDocument();
  });

  it("renders feature description", () => {
    render(<ComingSoon feature="content" />);

    expect(
      screen.getByText("Videos, audio, and written content from our creators."),
    ).toBeInTheDocument();
  });

  it("renders 'Back to Home' link pointing to /", () => {
    render(<ComingSoon feature="content" />);

    const link = screen.getByRole("link", { name: "Back to Home" });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "/");
  });

  it("works for each feature flag", () => {
    const { unmount } = render(<ComingSoon feature="booking" />);

    expect(
      screen.getByRole("heading", { level: 1, name: "Services — Coming Soon" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Studio and label services available for booking."),
    ).toBeInTheDocument();

    unmount();
  });
});
