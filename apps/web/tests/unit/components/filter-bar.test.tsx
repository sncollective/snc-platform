import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { FilterBar } from "../../../src/components/content/filter-bar.js";

// ── Tests ──

describe("FilterBar", () => {
  it("renders All, Video, Audio, and Written buttons", () => {
    render(<FilterBar activeFilter={null} onFilterChange={vi.fn()} />);

    expect(screen.getByRole("button", { name: "All" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Video" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Audio" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Written" }),
    ).toBeInTheDocument();
  });

  it("marks the active filter button as pressed", () => {
    render(<FilterBar activeFilter="video" onFilterChange={vi.fn()} />);

    expect(screen.getByRole("button", { name: "Video" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "All" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    expect(screen.getByRole("button", { name: "Audio" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    expect(screen.getByRole("button", { name: "Written" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("marks 'All' as pressed when activeFilter is null", () => {
    render(<FilterBar activeFilter={null} onFilterChange={vi.fn()} />);

    expect(screen.getByRole("button", { name: "All" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("calls onFilterChange with null when 'All' is clicked", async () => {
    const user = userEvent.setup();
    const onFilterChange = vi.fn();
    render(<FilterBar activeFilter="video" onFilterChange={onFilterChange} />);

    await user.click(screen.getByRole("button", { name: "All" }));

    expect(onFilterChange).toHaveBeenCalledWith(null);
  });

  it("calls onFilterChange with 'video' when 'Video' is clicked", async () => {
    const user = userEvent.setup();
    const onFilterChange = vi.fn();
    render(<FilterBar activeFilter={null} onFilterChange={onFilterChange} />);

    await user.click(screen.getByRole("button", { name: "Video" }));

    expect(onFilterChange).toHaveBeenCalledWith("video");
  });

  it("calls onFilterChange with 'audio' when 'Audio' is clicked", async () => {
    const user = userEvent.setup();
    const onFilterChange = vi.fn();
    render(<FilterBar activeFilter={null} onFilterChange={onFilterChange} />);

    await user.click(screen.getByRole("button", { name: "Audio" }));

    expect(onFilterChange).toHaveBeenCalledWith("audio");
  });

  it("calls onFilterChange with 'written' when 'Written' is clicked", async () => {
    const user = userEvent.setup();
    const onFilterChange = vi.fn();
    render(<FilterBar activeFilter={null} onFilterChange={onFilterChange} />);

    await user.click(screen.getByRole("button", { name: "Written" }));

    expect(onFilterChange).toHaveBeenCalledWith("written");
  });
});
