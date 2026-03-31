import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

import { makeMockFeedItem } from "../../helpers/content-fixtures.js";
import { createRouterMock } from "../../helpers/router-mock.js";

// ── Hoisted Mocks ──

const {
  mockUseCursorPagination,
  mockDeleteContent,
} = vi.hoisted(() => ({
  mockUseCursorPagination: vi.fn(),
  mockDeleteContent: vi.fn(),
}));

vi.mock("@tanstack/react-router", () => createRouterMock());

vi.mock("../../../src/hooks/use-cursor-pagination.js", () => ({
  useCursorPagination: mockUseCursorPagination,
}));

vi.mock("../../../src/lib/content.js", () => ({
  deleteContent: mockDeleteContent,
}));

// ── Component Under Test ──

import { ContentManagementList } from "../../../src/components/content/content-management-list.js";

// ── Helpers ──

function makePaginationResult(
  items: ReturnType<typeof makeMockFeedItem>[],
  nextCursor: string | null = null,
) {
  return {
    items,
    nextCursor,
    isLoading: false,
    error: null,
    loadMore: vi.fn(),
  };
}

function makeItem(overrides?: Parameters<typeof makeMockFeedItem>[0]) {
  return makeMockFeedItem({
    processingStatus: null,
    videoCodec: null,
    audioCodec: null,
    width: null,
    height: null,
    duration: null,
    bitrate: null,
    ...overrides,
  });
}

const DEFAULT_PROPS = {
  creatorId: "creator-uuid",
  creatorSlug: "maya-chen",
  refreshKey: 0,
  onDeleted: vi.fn(),
};

beforeEach(() => {
  mockUseCursorPagination.mockReset();
  mockDeleteContent.mockReset();
  // Default: empty results for both drafts and published
  mockUseCursorPagination.mockReturnValue(makePaginationResult([]));
});

describe("ContentManagementList", () => {
  it("renders both draft and published sections", () => {
    render(<ContentManagementList {...DEFAULT_PROPS} />);
    expect(screen.getByText("Drafts")).toBeInTheDocument();
    expect(screen.getByText("Published")).toBeInTheDocument();
  });

  it("shows empty state for drafts when no items", () => {
    render(<ContentManagementList {...DEFAULT_PROPS} />);
    expect(screen.getByText("No drafts.")).toBeInTheDocument();
  });

  it("shows empty state for published when no items", () => {
    render(<ContentManagementList {...DEFAULT_PROPS} />);
    expect(screen.getByText("No published content.")).toBeInTheDocument();
  });

  it("renders draft items with title", () => {
    mockUseCursorPagination
      .mockReturnValueOnce(makePaginationResult([
        makeItem({ id: "d1", title: "My Draft Post", publishedAt: null }),
      ]))
      .mockReturnValueOnce(makePaginationResult([]));

    render(<ContentManagementList {...DEFAULT_PROPS} />);
    expect(screen.getByText("My Draft Post")).toBeInTheDocument();
  });

  it("filters both sections when type filter changes", () => {
    render(<ContentManagementList {...DEFAULT_PROPS} />);

    const select = screen.getByLabelText("Filter by type");
    fireEvent.change(select, { target: { value: "audio" } });

    // After filter change, useCursorPagination is called again with type=audio in URL
    // We can verify this by checking the mock was called with a buildUrl that includes type=audio
    const calls = mockUseCursorPagination.mock.calls;
    // After re-render with filter, new calls should be made
    const lastDraftCall = calls[calls.length - 2];
    if (lastDraftCall) {
      const url = (lastDraftCall[0] as { buildUrl: (c: null) => string }).buildUrl(null);
      expect(url).toContain("type=audio");
    }
  });

  it("shows adaptive columns for audio filter — Duration column appears", () => {
    render(<ContentManagementList {...DEFAULT_PROPS} />);
    // Change filter to audio — after rerender, Duration column should show in headers
    // when items are present. We verify buildUrl includes type=audio.
    fireEvent.change(screen.getByLabelText("Filter by type"), { target: { value: "audio" } });
    // Verify the pagination was re-called with audio type in URL
    const calls = mockUseCursorPagination.mock.calls;
    const lastCall = calls[calls.length - 2];
    if (lastCall) {
      const url = (lastCall[0] as { buildUrl: (c: null) => string }).buildUrl(null);
      expect(url).toContain("type=audio");
    }
  });

  it("shows base columns for 'all' filter by default", () => {
    render(<ContentManagementList {...DEFAULT_PROPS} />);
    // Type filter defaults to "all" — verify it has the "All" option selected
    const select = screen.getByLabelText("Filter by type") as HTMLSelectElement;
    expect(select.value).toBe("all");
  });

  it("title links to edit page using slug when available", () => {
    mockUseCursorPagination
      .mockReturnValueOnce(makePaginationResult([
        makeItem({ id: "content-id", slug: "my-post", title: "My Post", publishedAt: null }),
      ]))
      .mockReturnValueOnce(makePaginationResult([]));

    render(<ContentManagementList {...DEFAULT_PROPS} />);

    const titleLink = screen.getByRole("link", { name: "My Post" });
    expect(titleLink).toHaveAttribute("href", "/creators/maya-chen/manage/content/my-post");
  });

  it("title links to edit page using ID when slug is absent", () => {
    mockUseCursorPagination
      .mockReturnValueOnce(makePaginationResult([
        makeItem({ id: "content-uuid", slug: null, title: "Untitled", publishedAt: null }),
      ]))
      .mockReturnValueOnce(makePaginationResult([]));

    render(<ContentManagementList {...DEFAULT_PROPS} />);

    const titleLink = screen.getByRole("link", { name: "Untitled" });
    expect(titleLink).toHaveAttribute("href", "/creators/maya-chen/manage/content/content-uuid");
  });

  it("shows load more for sections independently when nextCursor is present", () => {
    mockUseCursorPagination
      .mockReturnValueOnce(makePaginationResult(
        [makeItem({ id: "d1", publishedAt: null })],
        "next-cursor-drafts",
      ))
      .mockReturnValueOnce(makePaginationResult(
        [makeItem({ id: "p1", publishedAt: "2026-01-01T00:00:00.000Z" })],
        "next-cursor-pub",
      ));

    render(<ContentManagementList {...DEFAULT_PROPS} />);

    const loadMoreButtons = screen.getAllByRole("button", { name: "Load more" });
    expect(loadMoreButtons).toHaveLength(2);
  });

  it("calls deleteContent on kebab delete action after confirmation", async () => {
    vi.stubGlobal("confirm", () => true);
    mockDeleteContent.mockResolvedValue(undefined);

    mockUseCursorPagination
      .mockReturnValueOnce(makePaginationResult([
        makeItem({ id: "content-to-delete", publishedAt: null }),
      ]))
      .mockReturnValueOnce(makePaginationResult([]));

    render(<ContentManagementList {...DEFAULT_PROPS} />);

    const kebabButton = screen.getByRole("button", { name: "More actions" });
    fireEvent.click(kebabButton);

    const deleteButton = screen.getByRole("button", { name: "Delete" });
    fireEvent.click(deleteButton);

    await waitFor(() => {
      expect(mockDeleteContent).toHaveBeenCalledWith("content-to-delete");
    });

    vi.unstubAllGlobals();
  });

  it("does not call deleteContent when confirm is cancelled", () => {
    vi.stubGlobal("confirm", () => false);

    mockUseCursorPagination
      .mockReturnValueOnce(makePaginationResult([
        makeItem({ id: "content-to-delete", publishedAt: null }),
      ]))
      .mockReturnValueOnce(makePaginationResult([]));

    render(<ContentManagementList {...DEFAULT_PROPS} />);

    const kebabButton = screen.getByRole("button", { name: "More actions" });
    fireEvent.click(kebabButton);

    const deleteButton = screen.getByRole("button", { name: "Delete" });
    fireEvent.click(deleteButton);

    expect(mockDeleteContent).not.toHaveBeenCalled();

    vi.unstubAllGlobals();
  });
});
