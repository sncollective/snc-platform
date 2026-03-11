import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// ── Component Under Test ──
// No module mocks needed — VariantSelector is a pure component with no
// external dependencies beyond React and CSS modules.

import { VariantSelector } from "../../../src/components/merch/variant-selector.js";

// ── Test Helpers ──

const VARIANTS = [
  { id: "v1", title: "S", price: 2500, available: true },
  { id: "v2", title: "M", price: 2500, available: true },
  { id: "v3", title: "L", price: 2500, available: false },
];

// ── Tests ──

describe("VariantSelector", () => {
  it("renders a chip for each variant", () => {
    render(
      <VariantSelector
        variants={VARIANTS}
        selectedId="v1"
        onSelect={vi.fn()}
      />,
    );

    expect(screen.getAllByRole("radio")).toHaveLength(3);
    expect(screen.getByText("S")).toBeInTheDocument();
    expect(screen.getByText("M")).toBeInTheDocument();
    expect(screen.getByText("L")).toBeInTheDocument();
  });

  it("marks selected chip with aria-checked=true", () => {
    render(
      <VariantSelector
        variants={VARIANTS}
        selectedId="v2"
        onSelect={vi.fn()}
      />,
    );

    expect(screen.getByText("M")).toHaveAttribute("aria-checked", "true");
    expect(screen.getByText("S")).toHaveAttribute("aria-checked", "false");
  });

  it("calls onSelect with variant id when available chip is clicked", async () => {
    const onSelect = vi.fn();
    render(
      <VariantSelector
        variants={VARIANTS}
        selectedId="v1"
        onSelect={onSelect}
      />,
    );

    await userEvent.setup().click(screen.getByText("M"));

    expect(onSelect).toHaveBeenCalledWith("v2");
  });

  it("does not call onSelect when disabled chip is clicked", async () => {
    const onSelect = vi.fn();
    render(
      <VariantSelector
        variants={VARIANTS}
        selectedId="v1"
        onSelect={onSelect}
      />,
    );

    await userEvent.setup().click(screen.getByText("L"));

    expect(onSelect).not.toHaveBeenCalled();
  });

  it("disabled chip has disabled attribute", () => {
    render(
      <VariantSelector
        variants={VARIANTS}
        selectedId="v1"
        onSelect={vi.fn()}
      />,
    );

    expect(screen.getByText("L")).toBeDisabled();
  });

  it("container has radiogroup role", () => {
    render(
      <VariantSelector
        variants={VARIANTS}
        selectedId="v1"
        onSelect={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("radiogroup", { name: /product variants/i }),
    ).toBeInTheDocument();
  });

  it("each chip has radio role", () => {
    render(
      <VariantSelector
        variants={VARIANTS}
        selectedId="v1"
        onSelect={vi.fn()}
      />,
    );

    expect(screen.getAllByRole("radio")).toHaveLength(3);
  });
});
