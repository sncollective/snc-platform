import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

import { StudioHero } from "../../../../src/components/studio/studio-hero.js";

describe("StudioHero", () => {
  it("renders the heading 'S/NC Studio'", () => {
    render(<StudioHero />);

    expect(
      screen.getByRole("heading", { level: 1, name: "S/NC Studio" }),
    ).toBeInTheDocument();
  });

  it("renders the subheading describing the studio", () => {
    render(<StudioHero />);

    expect(
      screen.getByText(/tracking, mixing, mastering, podcast/i),
    ).toBeInTheDocument();
  });
});
