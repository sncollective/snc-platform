import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

import { StudioEquipment } from "../../../../src/components/studio/studio-equipment.js";

describe("StudioEquipment", () => {
  it("renders the Equipment heading", () => {
    render(<StudioEquipment />);

    expect(
      screen.getByRole("heading", { level: 2, name: "Equipment" }),
    ).toBeInTheDocument();
  });

  it("renders all 4 equipment category headings", () => {
    render(<StudioEquipment />);

    expect(
      screen.getByRole("heading", { level: 3, name: "Microphones" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 3, name: "Recording" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 3, name: "Backline" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 3, name: "PA & Live" }),
    ).toBeInTheDocument();
  });

  it("renders items within each category", () => {
    render(<StudioEquipment />);

    expect(screen.getByText("Condenser microphones")).toBeInTheDocument();
    expect(screen.getByText("Studio monitors")).toBeInTheDocument();
    expect(screen.getByText("Drum kit")).toBeInTheDocument();
    expect(screen.getByText("PA system")).toBeInTheDocument();
  });
});
