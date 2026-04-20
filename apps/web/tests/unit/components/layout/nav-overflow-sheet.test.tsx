import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { createRouterMock } from "../../../helpers/router-mock.js";

// ── Hoisted Mocks ──

vi.mock("@tanstack/react-router", () => createRouterMock());

// ── Import component under test (after mocks) ──

import { NavOverflowSheet } from "../../../../src/components/layout/nav-overflow-sheet.js";

// ── Tests ──

describe("NavOverflowSheet", () => {
  it("does not render content when closed (lazyMount + unmountOnExit)", () => {
    render(<NavOverflowSheet open={false} onOpenChange={vi.fn()} />);

    expect(screen.queryByRole("link", { name: /Studio/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Merch/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Emissions/i })).not.toBeInTheDocument();
  });

  it("renders Studio, Merch, Emissions links when open", () => {
    render(<NavOverflowSheet open={true} onOpenChange={vi.fn()} />);

    expect(screen.getByRole("link", { name: /Studio/i })).toHaveAttribute("href", "/studio");
    expect(screen.getByRole("link", { name: /Merch/i })).toHaveAttribute("href", "/merch");
    expect(screen.getByRole("link", { name: /Emissions/i })).toHaveAttribute("href", "/emissions");
  });

  it("has an accessible title for screen readers", () => {
    render(<NavOverflowSheet open={true} onOpenChange={vi.fn()} />);

    expect(screen.getByText("More navigation")).toBeInTheDocument();
  });

  it("calls onOpenChange(false) when a link is clicked", async () => {
    const onOpenChange = vi.fn();
    const user = userEvent.setup();

    render(<NavOverflowSheet open={true} onOpenChange={onOpenChange} />);

    await user.click(screen.getByRole("link", { name: /Studio/i }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
