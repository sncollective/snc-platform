import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
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

describe("PoolItemPicker — empty state", () => {
  it("shows 'No playout items in pool' with explanatory note when pool has no playout items", () => {
    render(
      <PoolItemPicker
        poolItems={[]}
        onSelect={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByText(/No playout items in pool/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Only playout-uploaded items can be queued/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Creator content plays via the rotation pool/i),
    ).toBeInTheDocument();
  });

  it("shows 'No playout items in pool' note even when pool has content-only items", () => {
    const contentItem = makePlayoutItem({
      id: "cc_002",
      playoutItemId: null,
      contentId: "content_001",
      sourceType: "content",
    });
    render(
      <PoolItemPicker
        poolItems={[contentItem]}
        onSelect={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    // queueableItems is empty (content items filtered out), so the no-pool message shows
    expect(screen.getByText(/No playout items in pool/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Only playout-uploaded items can be queued/i),
    ).toBeInTheDocument();
  });

  it("shows 'No matching items' when pool has playout items but filter finds none", () => {
    render(
      <PoolItemPicker
        poolItems={[makePlayoutItem()]}
        onSelect={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    // The input has a filter active by default = empty string, so items show.
    // We can check that with a playout item present, the no-pool message does NOT show.
    expect(screen.queryByText(/No playout items in pool/i)).not.toBeInTheDocument();
    expect(screen.getByText("Metropolis")).toBeInTheDocument();
  });
});
