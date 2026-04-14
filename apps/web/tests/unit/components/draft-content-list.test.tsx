import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

import type { ContentResponse } from "@snc/shared";

import { createRouterMock } from "../../helpers/router-mock.js";

// ── Hoisted Mocks ──

const {
  mockUseCursorPagination,
  mockPublishContent,
  mockDeleteContent,
  mockStartUpload,
  mockUseUpload,
} = vi.hoisted(() => ({
  mockUseCursorPagination: vi.fn(),
  mockPublishContent: vi.fn(),
  mockDeleteContent: vi.fn(),
  mockStartUpload: vi.fn(),
  mockUseUpload: vi.fn(),
}));

vi.mock("@tanstack/react-router", () => createRouterMock());

vi.mock("../../../src/hooks/use-cursor-pagination.js", () => ({
  useCursorPagination: mockUseCursorPagination,
}));

vi.mock("../../../src/lib/content.js", () => ({
  publishContent: mockPublishContent,
  deleteContent: mockDeleteContent,
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
    slug: null,
    type: "video",
    title: "My Draft Video",
    body: null,
    description: null,
    visibility: "public",
    sourceType: "upload",
    thumbnailUrl: null,
    thumbnail: null,
    mediaUrl: null,
    publishedAt: null,
    createdAt: "2026-03-01T00:00:00.000Z",
    updatedAt: "2026-03-01T00:00:00.000Z",
    processingStatus: null,
    videoCodec: null,
    audioCodec: null,
    width: null,
    height: null,
    duration: null,
    bitrate: null,
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
  mockDeleteContent.mockReset();
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

  it("shows Edit link for draft items linking to management edit route", () => {
    mockUseCursorPagination.mockReturnValue(
      makePaginationResult([makeMockDraft({ id: "draft-1", creatorId: "creator-1", type: "written", mediaUrl: null })]),
    );

    render(<DraftContentList {...defaultProps} />);

    const editLink = screen.getByRole("link", { name: "Edit" });
    expect(editLink).toBeInTheDocument();
    expect(editLink).toHaveAttribute("href", "/creators/creator-1/manage/content/draft-1");
  });

  it("Edit link uses item.creatorId regardless of slug", () => {
    mockUseCursorPagination.mockReturnValue(
      makePaginationResult([makeMockDraft({ id: "draft-1", creatorId: "creator-uuid", slug: null, type: "written", mediaUrl: null })]),
    );

    render(<DraftContentList {...defaultProps} />);

    const editLink = screen.getByRole("link", { name: "Edit" });
    expect(editLink).toHaveAttribute("href", "/creators/creator-uuid/manage/content/draft-1");
  });

  it("does not render Preview link for draft items", () => {
    mockUseCursorPagination.mockReturnValue(
      makePaginationResult([makeMockDraft({ id: "draft-1", slug: "my-post", type: "written", mediaUrl: null })]),
    );

    render(<DraftContentList {...defaultProps} />);

    expect(screen.getByRole("link", { name: "Edit" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Preview" })).toBeNull();
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

  it("shows Delete button for draft items", () => {
    mockUseCursorPagination.mockReturnValue(
      makePaginationResult([makeMockDraft({ type: "written", mediaUrl: null })]),
    );

    render(<DraftContentList {...defaultProps} />);

    expect(screen.getByRole("button", { name: "Delete" })).toBeInTheDocument();
  });

  it("calls deleteContent when Delete button clicked and user confirms", async () => {
    mockUseCursorPagination.mockReturnValue(
      makePaginationResult([makeMockDraft({ id: "draft-1", type: "written", mediaUrl: null })]),
    );
    mockDeleteContent.mockResolvedValue(undefined);
    vi.stubGlobal("confirm", () => true);

    render(<DraftContentList {...defaultProps} />);

    fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    await waitFor(() => {
      expect(mockDeleteContent).toHaveBeenCalledWith("draft-1");
    });

    vi.unstubAllGlobals();
  });

  it("does not call deleteContent when user cancels confirm", async () => {
    mockUseCursorPagination.mockReturnValue(
      makePaginationResult([makeMockDraft({ type: "written", mediaUrl: null })]),
    );
    vi.stubGlobal("confirm", () => false);

    render(<DraftContentList {...defaultProps} />);

    fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    expect(mockDeleteContent).not.toHaveBeenCalled();

    vi.unstubAllGlobals();
  });

  it("shows Upload Thumbnail button for audio drafts", () => {
    mockUseCursorPagination.mockReturnValue(
      makePaginationResult([makeMockDraft({ type: "audio", thumbnailUrl: null })]),
    );

    render(<DraftContentList {...defaultProps} />);

    expect(screen.getByRole("button", { name: "Upload Thumbnail" })).toBeInTheDocument();
  });

  it("shows Replace Thumbnail when audio draft already has thumbnail", () => {
    mockUseCursorPagination.mockReturnValue(
      makePaginationResult([
        makeMockDraft({ type: "audio", thumbnailUrl: "/api/content/draft-1/thumbnail" }),
      ]),
    );

    render(<DraftContentList {...defaultProps} />);

    expect(screen.getByRole("button", { name: "Replace Thumbnail" })).toBeInTheDocument();
  });

  it("shows Upload Thumbnail button for video drafts", () => {
    mockUseCursorPagination.mockReturnValue(
      makePaginationResult([
        makeMockDraft({ type: "video", mediaUrl: "/api/content/draft-1/media", thumbnailUrl: null }),
      ]),
    );

    render(<DraftContentList {...defaultProps} />);

    expect(screen.getByRole("button", { name: "Upload Thumbnail" })).toBeInTheDocument();
  });

  it("shows Replace Thumbnail when video draft already has thumbnail", () => {
    mockUseCursorPagination.mockReturnValue(
      makePaginationResult([
        makeMockDraft({
          type: "video",
          mediaUrl: "/api/content/draft-1/media",
          thumbnailUrl: "/api/content/draft-1/thumbnail",
        }),
      ]),
    );

    render(<DraftContentList {...defaultProps} />);

    expect(screen.getByRole("button", { name: "Replace Thumbnail" })).toBeInTheDocument();
  });

  it("shows Upload Thumbnail button for written drafts", () => {
    mockUseCursorPagination.mockReturnValue(
      makePaginationResult([makeMockDraft({ type: "written", thumbnailUrl: null })]),
    );

    render(<DraftContentList {...defaultProps} />);

    expect(screen.getByRole("button", { name: "Upload Thumbnail" })).toBeInTheDocument();
  });

  it("cover art upload calls startUpload with purpose content-thumbnail", () => {
    mockUseCursorPagination.mockReturnValue(
      makePaginationResult([makeMockDraft({ id: "draft-1", type: "audio", mediaUrl: null })]),
    );

    render(<DraftContentList {...defaultProps} />);

    // There are two file inputs for audio: media + cover art
    const fileInputs = document.querySelectorAll('input[type="file"]');
    // Second input is cover art
    const coverArtInput = fileInputs[1] as HTMLInputElement;
    const file = new File(["img"], "cover.jpg", { type: "image/jpeg" });
    fireEvent.change(coverArtInput, { target: { files: [file] } });

    expect(mockStartUpload).toHaveBeenCalledWith(
      expect.objectContaining({
        file,
        purpose: "content-thumbnail",
        resourceId: "draft-1",
      }),
    );
  });

});
