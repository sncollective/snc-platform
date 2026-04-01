import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

import { createRouterMock } from "../../../helpers/router-mock.js";

vi.mock("@tanstack/react-router", () => createRouterMock());

import { ComingSoon } from "../../../../src/components/coming-soon/coming-soon.js";

describe("ComingSoon", () => {
  it("renders heading with feature name", () => {
    render(<ComingSoon feature="booking" />);

    expect(
      screen.getByRole("heading", { level: 1, name: "Studio — Coming Soon" }),
    ).toBeInTheDocument();
  });

  it("renders feature description", () => {
    render(<ComingSoon feature="booking" />);

    expect(
      screen.getByText("Recording studio, podcast production, practice space, and venue hire."),
    ).toBeInTheDocument();
  });

  it("renders 'Back to Home' link pointing to /", () => {
    render(<ComingSoon feature="booking" />);

    const link = screen.getByRole("link", { name: "Back to Home" });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "/");
  });

  it("works for each remaining feature flag", () => {
    const { unmount } = render(<ComingSoon feature="merch" />);

    expect(
      screen.getByRole("heading", { level: 1, name: "Merch — Coming Soon" }),
    ).toBeInTheDocument();

    unmount();
  });
});
