import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { PlayoutQueueEntry } from "@snc/shared";

import { QueueItemRow } from "../../../../src/components/admin/queue-item-row.js";

// ── Fixtures ──

function makeEntry(overrides?: Partial<PlayoutQueueEntry>): PlayoutQueueEntry {
  return {
    id: "entry_001",
    channelId: "ch_playout_1",
    playoutItemId: "item_001",
    contentId: null,
    sourceType: "playout",
    position: 1,
    status: "queued",
    pushedToLiquidsoap: false,
    createdAt: "2026-01-01T00:00:00Z",
    title: "Metropolis",
    duration: 6000,
    ...overrides,
  };
}

// ── Tests ──

describe("QueueItemRow — estimateLabel", () => {
  it("shows 'Up next' when estimatedStart is 0 (first in queue)", () => {
    render(
      <QueueItemRow entry={makeEntry()} estimatedStart={0} onRemove={vi.fn()} />,
    );
    expect(screen.getByText("Up next")).toBeInTheDocument();
  });

  it("shows formatted estimate when estimatedStart is positive", () => {
    render(
      // 5400 seconds = 1:30:00
      <QueueItemRow entry={makeEntry()} estimatedStart={5400} onRemove={vi.fn()} />,
    );
    expect(screen.getByText("est. 1:30:00")).toBeInTheDocument();
  });

  it("shows '—' when estimatedStart is null (unknown duration in chain)", () => {
    render(
      <QueueItemRow entry={makeEntry()} estimatedStart={null} onRemove={vi.fn()} />,
    );
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("shows 'est. 00:00' for a small positive estimatedStart (not confused with zero)", () => {
    render(
      <QueueItemRow entry={makeEntry()} estimatedStart={1} onRemove={vi.fn()} />,
    );
    // 1 second → "est. 00:01", NOT "Up next"
    expect(screen.getByText("est. 00:01")).toBeInTheDocument();
    expect(screen.queryByText("Up next")).not.toBeInTheDocument();
  });
});
