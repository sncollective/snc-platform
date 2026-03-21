import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

import type { ContentResponse } from "@snc/shared";

// ── Hoisted Mocks ──

const {
  mockUseCursorPagination,
  mockPublishContent,
  mockUpdateContent,
  mockStartUpload,
  mockUseUpload,
} = vi.hoisted(() => ({
  mockUseCursorPagination: vi.fn(),
  mockPublishContent: vi.fn(),
  mockUpdateContent: vi.fn(),
  mockStartUpload: vi.fn(),
  mockUseUpload: vi.fn(),
}));

vi.mock("../../../src/hooks/use-cursor-pagination.js", () => ({
  useCursorPagination: mockUseCursorPagination,
}));

vi.mock("../../../src/lib/content.js", () => ({
  publishContent: mockPublishContent,
  updateContent: mockUpdateContent,
}));

vi.mock("../../../src/contexts/upload-context.js", () => ({
  useUpload: mockUseUpload,
}));

// ── Component Under Test ──

import { DraftContentList } from "../../../src/components/content/draft-content-list.js";

// ── Fixtures ──

function makeMockDraft(overrides?: Partial<ContentResponse>): ContentResponse {
  return {
    id: "draft-1",
    creatorId: "creator-1",
    type: "video",
    title: "My Draft Video",
    body: null,
    description: null,
    visibility: "public",
    sourceType: "upload",
    thumbnailUrl: null,
    mediaUrl: null,
    coverArtUrl: null,
    publishedAt: null,
    createdAt: "2026-03-01T00:00:00.000Z",
    updatedAt: "2026-03-01T00:00:00.000Z",
    ...overrides,
  };
}

function makePaginationResult(
  items: ContentResponse[],
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
  mockPublishContent.mockReset();
  mockUpdateContent.mockReset();
  mockStartUpload.mockReset();
  mockUseUpload.mockReturnValue({
    state: { activeUploads: [], isUploading: false, isExpanded: false },
    actions: { startUpload: mockStartUpload, cancelUpload: vi.fn(), cancelAll: vi.fn(), dismissCompleted: vi.fn(), toggleExpanded: vi.fn() },
  });
});

const defaultProps = {
  creatorId: "creator-1",
  refreshKey: 0,
  onPublished: vi.fn(),
};

// ── Tests ──

describe("DraftContentList", () => {
  it("renders draft items with title and type badge", () => {
    mockUseCursorPagination.mockReturnValue(
      makePaginationResult([
        makeMockDraft({ title: "Draft Video 1", type: "video" }),
        makeMockDraft({ id: "draft-2", title: "Draft Audio", type: "audio" }),
      ]),
    );

    render(<DraftContentList {...defaultProps} />);

    expect(screen.getByText("Draft Video 1")).toBeInTheDocument();
    expect(screen.getByText("Draft Audio")).toBeInTheDocument();
    expect(screen.getAllByText("video")[0]).toBeInTheDocument();
    expect(screen.getAllByText("audio")[0]).toBeInTheDocument();
  });

  it("shows 'No media' status when mediaUrl is null", () => {
    mockUseCursorPagination.mockReturnValue(
      makePaginationResult([makeMockDraft({ mediaUrl: null })]),
    );

    render(<DraftContentList {...defaultProps} />);

    expect(screen.getByText("No media")).toBeInTheDocument();
  });

  it("shows 'Media ready' status when mediaUrl is present", () => {
    mockUseCursorPagination.mockReturnValue(
      makePaginationResult([
        makeMockDraft({ mediaUrl: "/api/content/draft-1/media" }),
      ]),
    );

    render(<DraftContentList {...defaultProps} />);

    expect(screen.getByText("Media ready")).toBeInTheDocument();
  });

  it("publish button is disabled for video without media", () => {
    mockUseCursorPagination.mockReturnValue(
      makePaginationResult([makeMockDraft({ type: "video", mediaUrl: null })]),
    );

    render(<DraftContentList {...defaultProps} />);

    const publishBtn = screen.getByRole("button", { name: "Publish" });
    expect(publishBtn).toBeDisabled();
  });

  it("publish button is disabled for audio without media", () => {
    mockUseCursorPagination.mockReturnValue(
      makePaginationResult([makeMockDraft({ type: "audio", mediaUrl: null })]),
    );

    render(<DraftContentList {...defaultProps} />);

    const publishBtn = screen.getByRole("button", { name: "Publish" });
    expect(publishBtn).toBeDisabled();
  });

  it("publish button is enabled for written content (no media required)", () => {
    mockUseCursorPagination.mockReturnValue(
      makePaginationResult([makeMockDraft({ type: "written", mediaUrl: null })]),
    );

    render(<DraftContentList {...defaultProps} />);

    const publishBtn = screen.getByRole("button", { name: "Publish" });
    expect(publishBtn).not.toBeDisabled();
  });

  it("publish button is enabled for video with media", () => {
    mockUseCursorPagination.mockReturnValue(
      makePaginationResult([
        makeMockDraft({ type: "video", mediaUrl: "/api/content/draft-1/media" }),
      ]),
    );

    render(<DraftContentList {...defaultProps} />);

    const publishBtn = screen.getByRole("button", { name: "Publish" });
    expect(publishBtn).not.toBeDisabled();
  });

  it("shows empty state when no drafts", () => {
    mockUseCursorPagination.mockReturnValue(makePaginationResult([]));

    render(<DraftContentList {...defaultProps} />);

    expect(screen.getByText("No drafts.")).toBeInTheDocument();
  });

  it("shows loading state", () => {
    mockUseCursorPagination.mockReturnValue({
      items: [],
      nextCursor: null,
      isLoading: true,
      error: null,
      loadMore: vi.fn(),
    });

    render(<DraftContentList {...defaultProps} />);

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

    render(<DraftContentList {...defaultProps} />);

    expect(screen.getByText("Failed to load")).toBeInTheDocument();
  });

  it("shows upload button for video draft without media", () => {
    mockUseCursorPagination.mockReturnValue(
      makePaginationResult([makeMockDraft({ type: "video", mediaUrl: null })]),
    );

    render(<DraftContentList {...defaultProps} />);

    expect(screen.getByRole("button", { name: "Upload Media" })).toBeInTheDocument();
  });

  it("does not show upload button for video draft with media", () => {
    mockUseCursorPagination.mockReturnValue(
      makePaginationResult([
        makeMockDraft({ type: "video", mediaUrl: "/api/content/draft-1/media" }),
      ]),
    );

    render(<DraftContentList {...defaultProps} />);

    expect(screen.queryByRole("button", { name: "Upload Media" })).toBeNull();
  });

  it("calls publishContent when publish button clicked", async () => {
    mockUseCursorPagination.mockReturnValue(
      makePaginationResult([makeMockDraft({ type: "written", mediaUrl: null })]),
    );
    mockPublishContent.mockResolvedValue({ id: "draft-1", publishedAt: "2026-03-01T00:00:00.000Z" });

    render(<DraftContentList {...defaultProps} />);

    const publishBtn = screen.getByRole("button", { name: "Publish" });
    fireEvent.click(publishBtn);

    await waitFor(() => {
      expect(mockPublishContent).toHaveBeenCalledWith("draft-1");
    });
  });

  it("shows load more button when nextCursor is present", () => {
    mockUseCursorPagination.mockReturnValue(
      makePaginationResult([makeMockDraft()], "next-cursor-token"),
    );

    render(<DraftContentList {...defaultProps} />);

    expect(screen.getByRole("button", { name: "Load more" })).toBeInTheDocument();
  });

  it("shows Edit button for draft items", () => {
    mockUseCursorPagination.mockReturnValue(
      makePaginationResult([makeMockDraft({ type: "written", mediaUrl: null })]),
    );

    render(<DraftContentList {...defaultProps} />);

    expect(screen.getByRole("button", { name: "Edit" })).toBeInTheDocument();
  });

  it("clicking Edit shows inline edit form with fields", () => {
    mockUseCursorPagination.mockReturnValue(
      makePaginationResult([makeMockDraft({ title: "My Draft", type: "written", mediaUrl: null })]),
    );

    render(<DraftContentList {...defaultProps} />);

    fireEvent.click(screen.getByRole("button", { name: "Edit" }));

    expect(screen.getByLabelText(/title/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/description/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/visibility/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
  });

  it("clicking Cancel in edit mode reverts state", () => {
    mockUseCursorPagination.mockReturnValue(
      makePaginationResult([makeMockDraft({ title: "My Draft", type: "written", mediaUrl: null })]),
    );

    render(<DraftContentList {...defaultProps} />);

    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.queryByRole("button", { name: "Save" })).toBeNull();
    expect(screen.getByRole("button", { name: "Edit" })).toBeInTheDocument();
  });

  it("clicking Save calls updateContent with correct args", async () => {
    mockUseCursorPagination.mockReturnValue(
      makePaginationResult([makeMockDraft({ id: "draft-1", title: "My Draft", type: "written", mediaUrl: null })]),
    );
    mockUpdateContent.mockResolvedValue({ id: "draft-1", title: "Updated Title" });

    render(<DraftContentList {...defaultProps} />);

    fireEvent.click(screen.getByRole("button", { name: "Edit" }));

    const titleInput = screen.getByLabelText(/title/i);
    fireEvent.change(titleInput, { target: { value: "Updated Title" } });

    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(mockUpdateContent).toHaveBeenCalledWith(
        "draft-1",
        expect.objectContaining({ title: "Updated Title" }),
      );
    });
  });

  it("Save button disabled when title is empty", () => {
    mockUseCursorPagination.mockReturnValue(
      makePaginationResult([makeMockDraft({ type: "written", mediaUrl: null })]),
    );

    render(<DraftContentList {...defaultProps} />);

    fireEvent.click(screen.getByRole("button", { name: "Edit" }));

    const titleInput = screen.getByLabelText(/title/i);
    fireEvent.change(titleInput, { target: { value: "" } });

    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
  });

  it("upload calls startUpload with purpose content-media for video", () => {
    mockUseCursorPagination.mockReturnValue(
      makePaginationResult([makeMockDraft({ type: "video", mediaUrl: null })]),
    );

    render(<DraftContentList {...defaultProps} />);

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(["data"], "video.mp4", { type: "video/mp4" });
    fireEvent.change(fileInput, { target: { files: [file] } });

    expect(mockStartUpload).toHaveBeenCalledWith(
      expect.objectContaining({
        file,
        purpose: "content-media",
        resourceId: "draft-1",
      }),
    );
  });

  it("upload calls startUpload with purpose content-media for audio (not content-cover-art)", () => {
    mockUseCursorPagination.mockReturnValue(
      makePaginationResult([makeMockDraft({ id: "draft-audio", type: "audio", mediaUrl: null })]),
    );

    render(<DraftContentList {...defaultProps} />);

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(["data"], "audio.mp3", { type: "audio/mpeg" });
    fireEvent.change(fileInput, { target: { files: [file] } });

    expect(mockStartUpload).toHaveBeenCalledWith(
      expect.objectContaining({
        file,
        purpose: "content-media",
        resourceId: "draft-audio",
      }),
    );
  });
});
