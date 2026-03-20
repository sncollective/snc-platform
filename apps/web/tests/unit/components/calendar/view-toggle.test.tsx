import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("../../../../src/components/calendar/view-toggle.module.css", () => ({
  default: {
    toggleGroup: "toggleGroup",
    toggleButton: "toggleButton",
    toggleButtonActive: "toggleButtonActive",
  },
}));

import { ViewToggle } from "../../../../src/components/calendar/view-toggle.js";

// ── Tests ──

describe("ViewToggle", () => {
  it("renders two buttons: Month, Timeline", () => {
    render(<ViewToggle activeView="month" onViewChange={vi.fn()} />);

    expect(screen.getByRole("button", { name: "Month" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Timeline" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Grid" })).not.toBeInTheDocument();
  });

  it("sets aria-pressed true on the active view button", () => {
    render(<ViewToggle activeView="timeline" onViewChange={vi.fn()} />);

    expect(screen.getByRole("button", { name: "Timeline" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Month" })).toHaveAttribute("aria-pressed", "false");
  });

  it("sets aria-pressed false on inactive view buttons", () => {
    render(<ViewToggle activeView="month" onViewChange={vi.fn()} />);

    expect(screen.getByRole("button", { name: "Month" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Timeline" })).toHaveAttribute("aria-pressed", "false");
  });

  it("calls onViewChange with the correct view when Month is clicked", async () => {
    const user = userEvent.setup();
    const onViewChange = vi.fn();
    render(<ViewToggle activeView="timeline" onViewChange={onViewChange} />);

    await user.click(screen.getByRole("button", { name: "Month" }));

    expect(onViewChange).toHaveBeenCalledWith("month");
  });

  it("calls onViewChange with 'timeline' when Timeline is clicked", async () => {
    const user = userEvent.setup();
    const onViewChange = vi.fn();
    render(<ViewToggle activeView="month" onViewChange={onViewChange} />);

    await user.click(screen.getByRole("button", { name: "Timeline" }));

    expect(onViewChange).toHaveBeenCalledWith("timeline");
  });

  it("renders with correct group role and label", () => {
    render(<ViewToggle activeView="month" onViewChange={vi.fn()} />);

    expect(screen.getByRole("group", { name: "Calendar view" })).toBeInTheDocument();
  });
});
