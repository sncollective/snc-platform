import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import type { ChannelContent } from "@snc/shared";

import { ContentPoolTable } from "../../../../src/components/admin/content-pool-table.js";

// ── Fixtures ──

function makeChannelContent(overrides?: Partial<ChannelContent>): ChannelContent {
  return {
    id: "cc_001",
    channelId: "ch_001",
    playoutItemId: "pi_001",
    contentId: null,
    sourceType: "playout",
    processingStatus: "ready",
    title: "Test Film",
    duration: 5400, // 1:30:00
    lastPlayedAt: null,
    playCount: 3,
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

// ── Lifecycle ──

let mockOnRemove: ReturnType<typeof vi.fn<(item: ChannelContent) => void>>;
let mockOnRetry: ReturnType<typeof vi.fn<(item: ChannelContent) => void>>;

beforeEach(() => {
  mockOnRemove = vi.fn<(item: ChannelContent) => void>();
  mockOnRetry = vi.fn<(item: ChannelContent) => void>();
});

// ── Tests ──

describe("ContentPoolTable", () => {
  describe("empty state", () => {
    it("renders the action-prompt empty message when items is empty", () => {
      render(
        <ContentPoolTable items={[]} onRemove={mockOnRemove} />,
      );

      expect(
        screen.getByText("No content in pool. Add content using the buttons above."),
      ).toBeInTheDocument();
    });

    it("does not render a table or card list when items is empty", () => {
      render(
        <ContentPoolTable items={[]} onRemove={mockOnRemove} />,
      );

      expect(screen.queryByRole("table")).not.toBeInTheDocument();
      expect(screen.queryByRole("list")).not.toBeInTheDocument();
    });
  });

  describe("table view (mode=auto, both views in DOM)", () => {
    it("renders column headers in the table", () => {
      const items = [makeChannelContent()];
      render(
        <ContentPoolTable items={items} onRemove={mockOnRemove} />,
      );

      // Both views are always in DOM; getAllByRole finds them in table headers
      const columnHeaders = screen.getAllByRole("columnheader");
      const headerTexts = columnHeaders.map((h) => h.textContent ?? "");
      expect(headerTexts).toContain("Title");
      expect(headerTexts).toContain("Duration");
      expect(headerTexts).toContain("Source");
      expect(headerTexts).toContain("Last Played");
      expect(headerTexts).toContain("Plays");
    });

    it("renders item data in table cells", () => {
      const items = [
        makeChannelContent({
          id: "cc_001",
          title: "Midnight Run",
          duration: 90 * 60, // 1:30:00
          sourceType: "playout",
          lastPlayedAt: null,
          playCount: 7,
        }),
      ];
      render(
        <ContentPoolTable items={items} onRemove={mockOnRemove} />,
      );

      // Title appears (may appear twice — table + card)
      expect(screen.getAllByText("Midnight Run").length).toBeGreaterThanOrEqual(1);
      // Duration formatted
      expect(screen.getAllByText("1:30:00").length).toBeGreaterThanOrEqual(1);
      // Source badge
      expect(screen.getAllByText("Playout").length).toBeGreaterThanOrEqual(1);
      // Last played — null → "Never"
      expect(screen.getAllByText("Never").length).toBeGreaterThanOrEqual(1);
      // Play count
      expect(screen.getAllByText("7").length).toBeGreaterThanOrEqual(1);
    });

    it("renders Creator source badge for content-sourced items", () => {
      const items = [
        makeChannelContent({ sourceType: "content", processingStatus: null }),
      ];
      render(
        <ContentPoolTable items={items} onRemove={mockOnRemove} />,
      );

      expect(screen.getAllByText("Creator").length).toBeGreaterThanOrEqual(1);
    });

    it("renders a null-title item with em dash", () => {
      const items = [makeChannelContent({ title: null })];
      render(
        <ContentPoolTable items={items} onRemove={mockOnRemove} />,
      );

      // "—" appears in title cell; there may be multiple (table + card)
      expect(screen.getAllByText("—").length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("card view (mode=auto, both views in DOM)", () => {
    it("renders a card list alongside the table", () => {
      const items = [makeChannelContent()];
      render(
        <ContentPoolTable items={items} onRemove={mockOnRemove} />,
      );

      // ResponsiveTable renders a <ul> for cards
      expect(screen.getByRole("list", { name: "Content pool" })).toBeInTheDocument();
    });

    it("applies the cardAriaLabel to each list item", () => {
      const items = [makeChannelContent({ id: "cc_a", title: "Alpha" })];
      render(
        <ContentPoolTable items={items} onRemove={mockOnRemove} />,
      );

      expect(screen.getByRole("listitem", { name: "Alpha" })).toBeInTheDocument();
    });
  });

  describe("actions", () => {
    it("renders a Remove button for each item", () => {
      const items = [
        makeChannelContent({ id: "cc_001", title: "Film A" }),
        makeChannelContent({ id: "cc_002", title: "Film B" }),
      ];
      render(
        <ContentPoolTable items={items} onRemove={mockOnRemove} />,
      );

      // Each item appears in table + card → 2 Remove buttons per item = 4 total
      expect(
        screen.getAllByRole("button", { name: "Remove Film A from pool" }),
      ).toHaveLength(2); // table + card
      expect(
        screen.getAllByRole("button", { name: "Remove Film B from pool" }),
      ).toHaveLength(2);
    });

    it("calls onRemove with the correct item when Remove is clicked", async () => {
      const item = makeChannelContent({ id: "cc_001", title: "Film A" });
      const userSetup = userEvent.setup();

      render(
        <ContentPoolTable items={[item]} onRemove={mockOnRemove} />,
      );

      // Click any one of the Remove buttons (table or card)
      const removeButtons = screen.getAllByRole("button", {
        name: "Remove Film A from pool",
      });
      await userSetup.click(removeButtons[0]!);

      expect(mockOnRemove).toHaveBeenCalledWith(item);
    });

    it("renders a Retry button only for failed playout items when onRetry is provided", () => {
      const items = [
        makeChannelContent({
          id: "cc_fail",
          title: "Failed Film",
          sourceType: "playout",
          processingStatus: "failed",
        }),
        makeChannelContent({
          id: "cc_ready",
          title: "Ready Film",
          sourceType: "playout",
          processingStatus: "ready",
        }),
        makeChannelContent({
          id: "cc_content",
          title: "Creator Film",
          sourceType: "content",
          processingStatus: null,
        }),
      ];
      render(
        <ContentPoolTable
          items={items}
          onRemove={mockOnRemove}
          onRetry={mockOnRetry}
        />,
      );

      // Only the failed playout item has a Retry button (×2 for table+card)
      expect(
        screen.getAllByRole("button", { name: "Retry ingest for Failed Film" }),
      ).toHaveLength(2);
      expect(
        screen.queryByRole("button", { name: "Retry ingest for Ready Film" }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: "Retry ingest for Creator Film" }),
      ).not.toBeInTheDocument();
    });

    it("does not render Retry button when onRetry is undefined, even for failed items", () => {
      const items = [
        makeChannelContent({
          id: "cc_fail",
          title: "Failed Film",
          sourceType: "playout",
          processingStatus: "failed",
        }),
      ];
      render(
        <ContentPoolTable items={items} onRemove={mockOnRemove} />,
      );

      expect(
        screen.queryByRole("button", { name: "Retry ingest for Failed Film" }),
      ).not.toBeInTheDocument();
    });

    it("calls onRetry with the correct item when Retry is clicked", async () => {
      const item = makeChannelContent({
        id: "cc_fail",
        title: "Failed Film",
        sourceType: "playout",
        processingStatus: "failed",
      });
      const userSetup = userEvent.setup();

      render(
        <ContentPoolTable
          items={[item]}
          onRemove={mockOnRemove}
          onRetry={mockOnRetry}
        />,
      );

      const retryButtons = screen.getAllByRole("button", {
        name: "Retry ingest for Failed Film",
      });
      await userSetup.click(retryButtons[0]!);

      expect(mockOnRetry).toHaveBeenCalledWith(item);
    });
  });

  describe("multiple items", () => {
    it("renders all items in the table body", () => {
      const items = [
        makeChannelContent({ id: "cc_001", title: "Alpha" }),
        makeChannelContent({ id: "cc_002", title: "Beta" }),
        makeChannelContent({ id: "cc_003", title: "Gamma" }),
      ];
      render(
        <ContentPoolTable items={items} onRemove={mockOnRemove} />,
      );

      expect(screen.getAllByText("Alpha").length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText("Beta").length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText("Gamma").length).toBeGreaterThanOrEqual(1);
    });
  });
});
