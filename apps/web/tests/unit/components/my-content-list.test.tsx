import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

import type { FeedItem } from "@snc/shared";

import { createRouterMock } from "../../helpers/router-mock.js";
import { makeMockFeedItem } from "../../helpers/content-fixtures.js";

// ── Hoisted Mocks ──

const {
  mockUseCursorPagination,
  mockDeleteContent,
  mockFormatRelativeDate,
} = vi.hoisted(() => ({
  mockUseCursorPagination: vi.fn(),
  mockDeleteContent: vi.fn(),
  mockFormatRelativeDate: vi.fn(),
}));

vi.mock("@tanstack/react-router", () => createRouterMock());

vi.mock("../../../src/hooks/use-cursor-pagination.js", () => ({
  useCursorPagination: mockUseCursorPagination,
}));

vi.mock("../../../src/lib/content.js", () => ({
  deleteContent: mockDeleteContent,
}));

vi.mock("../../../src/lib/format.js", () => ({
  formatRelativeDate: mockFormatRelativeDate,
}));

vi.mock("../../../src/components/ui/optional-image.js", () => ({
  OptionalImage: ({ alt }: { alt: string }) => <img alt={alt} />,
}));

// ── Component Under Test ──

import { MyContentList } from "../../../src/components/content/my-content-list.js";

// ── Helpers ──

function makePaginationResult(
  items: FeedItem[],
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

// ── Lifecycle ──

beforeEach(() => {
  mockUseCursorPagination.mockReset();
  mockDeleteContent.mockReset();
  mockFormatRelativeDate.mockReturnValue("1d ago");
});

// ── Tests ──

describe("MyContentList", () => {
  it("renders content cards", () => {
    mockUseCursorPagination.mockReturnValue(
      makePaginationResult([
        makeMockFeedItem({ title: "Post One" }),
        makeMockFeedItem({ id: "content-2", title: "Post Two" }),
      ]),
    );

    render(<MyContentList creatorId="creator-1" refreshKey={0} />);

    expect(screen.getByText("Post One")).toBeInTheDocument();
    expect(screen.getByText("Post Two")).toBeInTheDocument();
  });

  it("shows empty state when no content", () => {
    mockUseCursorPagination.mockReturnValue(makePaginationResult([]));

    render(<MyContentList creatorId="creator-1" refreshKey={0} />);

    expect(
      screen.getByText("No content yet. Create your first piece above."),
    ).toBeInTheDocument();
  });

  it("shows loading state", () => {
    mockUseCursorPagination.mockReturnValue({
      items: [],
      nextCursor: null,
      isLoading: true,
      error: null,
      loadMore: vi.fn(),
    });

    render(<MyContentList creatorId="creator-1" refreshKey={0} />);

    expect(screen.getByText("Loading...")).toBeInTheDocument();
  });

  it("shows error state", () => {
    mockUseCursorPagination.mockReturnValue({
      items: [],
      nextCursor: null,
      isLoading: false,
      error: "Failed to load",
      loadMore: vi.fn(),
    });

    render(<MyContentList creatorId="creator-1" refreshKey={0} />);

    expect(screen.getByText("Failed to load")).toBeInTheDocument();
  });

  it("renders a Delete button for each item", () => {
    mockUseCursorPagination.mockReturnValue(
      makePaginationResult([
        makeMockFeedItem({ title: "Post One" }),
        makeMockFeedItem({ id: "content-2", title: "Post Two" }),
      ]),
    );

    render(<MyContentList creatorId="creator-1" refreshKey={0} />);

    const deleteButtons = screen.getAllByRole("button", { name: "Delete" });
    expect(deleteButtons).toHaveLength(2);
  });

  it("calls deleteContent and onDeleted when Delete confirmed", async () => {
    mockUseCursorPagination.mockReturnValue(
      makePaginationResult([makeMockFeedItem({ id: "content-1" })]),
    );
    mockDeleteContent.mockResolvedValue(undefined);
    vi.stubGlobal("confirm", () => true);

    const onDeleted = vi.fn();
    render(<MyContentList creatorId="creator-1" refreshKey={0} onDeleted={onDeleted} />);

    fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    await waitFor(() => {
      expect(mockDeleteContent).toHaveBeenCalledWith("content-1");
      expect(onDeleted).toHaveBeenCalled();
    });

    vi.unstubAllGlobals();
  });

  it("does not call deleteContent when user cancels confirm", () => {
    mockUseCursorPagination.mockReturnValue(
      makePaginationResult([makeMockFeedItem({ id: "content-1" })]),
    );
    vi.stubGlobal("confirm", () => false);

    render(<MyContentList creatorId="creator-1" refreshKey={0} />);

    fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    expect(mockDeleteContent).not.toHaveBeenCalled();

    vi.unstubAllGlobals();
  });

  it("shows load more button when nextCursor is present", () => {
    mockUseCursorPagination.mockReturnValue(
      makePaginationResult([makeMockFeedItem()], "next-cursor-token"),
    );

    render(<MyContentList creatorId="creator-1" refreshKey={0} />);

    expect(screen.getByRole("button", { name: "Load more" })).toBeInTheDocument();
  });
});
