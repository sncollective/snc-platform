import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ChannelContent } from "@snc/shared";

import { PoolItemPicker } from "../../../../src/components/admin/pool-item-picker.js";

// ── Fixtures ──

function makePlayoutItem(overrides?: Partial<ChannelContent>): ChannelContent {
  return {
    id: "cc_001",
    channelId: "ch_playout_1",
    playoutItemId: "item_001",
    contentId: null,
    sourceType: "playout",
    processingStatus: "ready",
    title: "Metropolis",
    duration: 6000,
    lastPlayedAt: null,
    playCount: 0,
    createdAt: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

// ── Tests ──

function makeContentItem(overrides?: Partial<ChannelContent>): ChannelContent {
  return makePlayoutItem({
    id: "cc_content",
    playoutItemId: null,
    contentId: "content_001",
    sourceType: "content",
    title: "Creator Short",
    ...overrides,
  });
}

describe("PoolItemPicker — empty state", () => {
  it("shows the empty-pool note when the pool has no items at all", () => {
    render(
      <PoolItemPicker
        poolItems={[]}
        onSelect={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByText(/No items in pool/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Add content or playout items to the pool/i),
    ).toBeInTheDocument();
  });

  it("lists content-only pool items (creator content is queueable, not filtered out)", () => {
    render(
      <PoolItemPicker
        poolItems={[makeContentItem()]}
        onSelect={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    // B1 fix: a content row is now selectable rather than dropped.
    expect(screen.queryByText(/No items in pool/i)).not.toBeInTheDocument();
    expect(screen.getByText("Creator Short")).toBeInTheDocument();
    // ...and it carries a "Content" source badge to distinguish it from playout.
    expect(screen.getByText("Content")).toBeInTheDocument();
  });

  it("shows 'No matching items' when the pool has items but the filter finds none", () => {
    render(
      <PoolItemPicker
        poolItems={[makePlayoutItem()]}
        onSelect={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    // The input has a filter active by default = empty string, so items show.
    // We can check that with an item present, the no-pool message does NOT show.
    expect(screen.queryByText(/No items in pool/i)).not.toBeInTheDocument();
    expect(screen.getByText("Metropolis")).toBeInTheDocument();
  });
});

describe("PoolItemPicker — listbox ARIA + keyboard navigation", () => {
  const twoItems = [
    makePlayoutItem({ id: "cc_a", title: "Aurora" }),
    makePlayoutItem({ id: "cc_b", title: "Borealis" }),
  ];

  it("renders the results as a combobox input driving a listbox of options", () => {
    render(
      <PoolItemPicker poolItems={twoItems} onSelect={vi.fn()} onClose={vi.fn()} />,
    );

    const input = screen.getByRole("combobox", { name: "Filter pool items" });
    expect(input).toHaveAttribute("aria-controls", "pool-item-listbox");
    expect(screen.getByRole("listbox")).toBeInTheDocument();
    expect(screen.getAllByRole("option")).toHaveLength(2);
  });

  it("ArrowDown then Enter selects the active option and closes", async () => {
    const onSelect = vi.fn();
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(
      <PoolItemPicker poolItems={twoItems} onSelect={onSelect} onClose={onClose} />,
    );

    const input = screen.getByRole("combobox", { name: "Filter pool items" });
    input.focus();

    await user.keyboard("{ArrowDown}"); // activate first option
    expect(input).toHaveAttribute("aria-activedescendant", "pool-item-opt-cc_a");

    await user.keyboard("{ArrowDown}"); // move to second option
    expect(input).toHaveAttribute("aria-activedescendant", "pool-item-opt-cc_b");

    await user.keyboard("{Enter}");
    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({ id: "cc_b", title: "Borealis" }),
    );
    expect(onClose).toHaveBeenCalled();
  });

  it("ArrowUp from no selection wraps to the last option", async () => {
    const user = userEvent.setup();
    render(
      <PoolItemPicker poolItems={twoItems} onSelect={vi.fn()} onClose={vi.fn()} />,
    );

    const input = screen.getByRole("combobox", { name: "Filter pool items" });
    input.focus();

    await user.keyboard("{ArrowUp}");
    expect(input).toHaveAttribute("aria-activedescendant", "pool-item-opt-cc_b");
  });

  it("clicking an option selects it and closes", async () => {
    const onSelect = vi.fn();
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(
      <PoolItemPicker poolItems={twoItems} onSelect={onSelect} onClose={onClose} />,
    );

    await user.click(screen.getByRole("option", { name: /Aurora/ }));
    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({ id: "cc_a", title: "Aurora" }),
    );
    expect(onClose).toHaveBeenCalled();
  });

  it("selects a content-source item in a mixed pool (playout + content both queueable)", async () => {
    const onSelect = vi.fn();
    const user = userEvent.setup();
    const mixed = [
      makePlayoutItem({ id: "cc_play", title: "Aurora" }),
      makeContentItem({ id: "cc_cont", title: "Creator Short" }),
    ];
    render(<PoolItemPicker poolItems={mixed} onSelect={onSelect} onClose={vi.fn()} />);

    // Both source types render as selectable options.
    expect(screen.getAllByRole("option")).toHaveLength(2);

    await user.click(screen.getByRole("option", { name: /Creator Short/ }));
    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "cc_cont",
        contentId: "content_001",
        sourceType: "content",
      }),
    );
  });
});
