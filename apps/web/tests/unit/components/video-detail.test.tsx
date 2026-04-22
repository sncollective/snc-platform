import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

import { makeMockFeedItem } from "../../helpers/content-fixtures.js";
import { stubComponent } from "../../helpers/component-stubs.js";
import { createFormatMock, DEFAULT_FORMAT_DATE } from "../../helpers/format-mock.js";
import { deriveContentDisplayState } from "../../../src/hooks/use-content-display-state.js";
import type { FeedItem } from "@snc/shared";

// ── Hoisted Mocks ──

const { mockVideoPlayer, mockContentFooter, mockUseContentDisplayState } = vi.hoisted(() => ({
  mockVideoPlayer: vi.fn(),
  mockContentFooter: vi.fn(),
  mockUseContentDisplayState: vi.fn(),
}));

vi.mock("../../../src/components/media/video-player.js", () =>
  stubComponent("VideoPlayer", "video-player", mockVideoPlayer),
);
vi.mock("../../../src/components/content/content-footer.js", () =>
  stubComponent("ContentFooter", "content-footer", mockContentFooter),
);

vi.mock("../../../src/lib/format.js", () =>
  createFormatMock({ formatDate: DEFAULT_FORMAT_DATE }),
);

// Mock useContentDisplayState to derive state from item without upload context
vi.mock("../../../src/hooks/use-content-display-state.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../src/hooks/use-content-display-state.js")>();
  return {
    ...actual,
    useContentDisplayState: mockUseContentDisplayState,
  };
});

// ── Component Under Test ──

import { VideoDetail } from "../../../src/components/content/video-detail.js";

// ── Setup ──

beforeEach(() => {
  // Default: derive state from item alone (no active upload), matching pre-hook behavior
  mockUseContentDisplayState.mockImplementation((item: FeedItem) =>
    deriveContentDisplayState({ mediaUrl: item.mediaUrl, processingStatus: item.processingStatus, activeUpload: undefined }),
  );
});

// ── Tests ──

describe("VideoDetail", () => {
  it("renders VideoPlayer with correct src and poster", () => {
    const item = makeMockFeedItem({
      type: "video",
      mediaUrl: "/api/content/c1/media",
      thumbnailUrl: "/api/content/c1/thumbnail",
    });
    render(<VideoDetail item={item} />);

    expect(mockVideoPlayer).toHaveBeenCalledWith(
      expect.objectContaining({
        src: "/api/content/c1/media",
        poster: "/api/content/c1/thumbnail",
      }),
    );
  });

  it("omits poster prop when no thumbnailUrl", () => {
    const item = makeMockFeedItem({
      type: "video",
      mediaUrl: "/api/content/c1/media",
      thumbnailUrl: null,
    });
    render(<VideoDetail item={item} />);

    const lastCall = mockVideoPlayer.mock.lastCall as [Record<string, unknown>];
    expect(lastCall[0]).not.toHaveProperty("poster");
  });

  it("renders title as h1", () => {
    const item = makeMockFeedItem({ type: "video", title: "My Video" });
    render(<VideoDetail item={item} />);
    const heading = screen.getByRole("heading", { level: 1 });
    expect(heading).toHaveTextContent("My Video");
  });

  it("renders creator name and formatted date", () => {
    const item = makeMockFeedItem({
      type: "video",
      creatorName: "Jane",
      publishedAt: "2026-02-26T00:00:00.000Z",
    });
    render(<VideoDetail item={item} />);
    expect(screen.getByText("Jane")).toBeInTheDocument();
    expect(screen.getByText(/FORMATTED:/)).toBeInTheDocument();
  });

  it("passes description to ContentFooter when present", () => {
    const item = makeMockFeedItem({
      type: "video",
      description: "A great video",
    });
    render(<VideoDetail item={item} />);
    expect(mockContentFooter).toHaveBeenCalledWith(
      expect.objectContaining({ description: "A great video" }),
    );
  });

  it("passes null description to ContentFooter when null", () => {
    const item = makeMockFeedItem({ type: "video", description: null });
    render(<VideoDetail item={item} />);
    expect(mockContentFooter).toHaveBeenCalledWith(
      expect.objectContaining({ description: null }),
    );
  });

  it("renders VideoPlayer when not locked", () => {
    const item = makeMockFeedItem({
      type: "video",
      mediaUrl: "/api/content/c1/media",
    });
    render(<VideoDetail item={item} />);
    expect(screen.getByTestId("video-player")).toBeInTheDocument();
  });

  it("does not render VideoPlayer when locked=true", () => {
    const item = makeMockFeedItem({
      type: "video",
      visibility: "subscribers",
      mediaUrl: null,
    });
    render(<VideoDetail item={item} locked={true} />);
    expect(screen.queryByTestId("video-player")).toBeNull();
  });

  it("renders locked overlay with lock icon and text when locked=true", () => {
    const item = makeMockFeedItem({
      type: "video",
      visibility: "subscribers",
      mediaUrl: null,
    });
    render(<VideoDetail item={item} locked={true} />);
    expect(screen.getByText("Subscribe to watch")).toBeInTheDocument();
  });

  it("renders ContentFooter with locked props when locked=true", () => {
    const item = makeMockFeedItem({
      type: "video",
      creatorId: "creator-42",
      visibility: "subscribers",
      mediaUrl: null,
    });
    render(<VideoDetail item={item} locked={true} />);
    expect(screen.getByTestId("content-footer")).toBeInTheDocument();
    expect(mockContentFooter).toHaveBeenCalledWith(
      expect.objectContaining({
        creatorId: "creator-42",
        contentType: "video",
        locked: true,
      }),
    );
  });

  it("renders thumbnail image when locked and thumbnailUrl exists", () => {
    const item = makeMockFeedItem({
      type: "video",
      visibility: "subscribers",
      mediaUrl: null,
      thumbnailUrl: "/api/content/c1/thumbnail",
    });
    render(<VideoDetail item={item} locked={true} />);
    const img = screen.getByRole("img");
    expect(img).toHaveAttribute(
      "src",
      "/api/content/c1/thumbnail",
    );
  });

  it("renders placeholder when locked and no thumbnailUrl", () => {
    const item = makeMockFeedItem({
      type: "video",
      visibility: "subscribers",
      mediaUrl: null,
      thumbnailUrl: null,
    });
    render(<VideoDetail item={item} locked={true} />);
    expect(screen.queryByRole("img")).toBeNull();
  });

  it('renders "Media not yet available" when mediaUrl is null and not locked', () => {
    const item = makeMockFeedItem({
      type: "video",
      mediaUrl: null,
    });
    render(<VideoDetail item={item} />);
    expect(screen.getByText("Media not yet available")).toBeInTheDocument();
    expect(screen.queryByTestId("video-player")).toBeNull();
  });

  it("does not render media unavailable when mediaUrl is present", () => {
    const item = makeMockFeedItem({
      type: "video",
      mediaUrl: "/api/content/c1/media",
    });
    render(<VideoDetail item={item} />);
    expect(screen.queryByText("Media not yet available")).toBeNull();
    expect(screen.getByTestId("video-player")).toBeInTheDocument();
  });

  it("renders ContentMeta in media unavailable state", () => {
    const item = makeMockFeedItem({
      type: "video",
      title: "Draft Video",
      mediaUrl: null,
    });
    render(<VideoDetail item={item} />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Draft Video");
  });

  describe("uploading phase", () => {
    it("renders InlineUploadProgress when displayState.phase is uploading", () => {
      const item = makeMockFeedItem({ type: "video", mediaUrl: null });
      mockUseContentDisplayState.mockReturnValue({
        phase: "uploading",
        upload: {
          id: "uppy-1",
          filename: "video.mp4",
          progress: 42,
          status: "uploading",
          resourceId: item.id,
          purpose: "content-media" as const,
        },
      });
      render(<VideoDetail item={item} />);
      expect(screen.getByText("video.mp4")).toBeInTheDocument();
      expect(screen.getByText("42%")).toBeInTheDocument();
    });
  });

  describe("processing phase", () => {
    it("renders ProcessingIndicator when displayState.phase is processing", () => {
      const item = makeMockFeedItem({ type: "video", mediaUrl: null, processingStatus: "processing" });
      render(<VideoDetail item={item} />);
      expect(screen.getByText("Processing media...")).toBeInTheDocument();
    });
  });

  describe("edit mode upload placeholders", () => {
    const makeEditCallbacks = (overrides?: Partial<{
      onTitleChange: (v: string) => void;
      onDescriptionChange: (v: string) => void;
      onVisibilityChange: (v: string) => void;
      onMediaUpload: (f: File) => void;
      onThumbnailUpload: (f: File) => void;
      onMediaRemove: () => void;
      onThumbnailRemove: () => void;
    }>) => ({
      onTitleChange: vi.fn(),
      onDescriptionChange: vi.fn(),
      onVisibilityChange: vi.fn(),
      onMediaUpload: vi.fn(),
      onThumbnailUpload: vi.fn(),
      onMediaRemove: vi.fn(),
      onThumbnailRemove: vi.fn(),
      ...overrides,
    });

    it("renders Upload Video placeholder when editing and mediaUrl is null", () => {
      const item = makeMockFeedItem({ type: "video", mediaUrl: null });
      render(<VideoDetail item={item} isEditing editCallbacks={makeEditCallbacks()} />);
      expect(screen.getByRole("button", { name: "Upload Video" })).toBeInTheDocument();
    });

    it("does not render media unavailable text when editing and onMediaUpload provided", () => {
      const item = makeMockFeedItem({ type: "video", mediaUrl: null });
      render(<VideoDetail item={item} isEditing editCallbacks={makeEditCallbacks()} />);
      expect(screen.queryByText("Media not yet available")).toBeNull();
    });

    it("renders Upload Thumbnail placeholder when editing, media exists, and thumbnailUrl is null", () => {
      const item = makeMockFeedItem({
        type: "video",
        mediaUrl: "/api/content/c1/media",
        thumbnailUrl: null,
      });
      render(<VideoDetail item={item} isEditing editCallbacks={makeEditCallbacks()} />);
      expect(screen.getByRole("button", { name: "Upload Thumbnail" })).toBeInTheDocument();
    });

    it("does not render Upload Thumbnail when thumbnailUrl is present", () => {
      const item = makeMockFeedItem({
        type: "video",
        mediaUrl: "/api/content/c1/media",
        thumbnailUrl: "/api/content/c1/thumbnail",
      });
      render(<VideoDetail item={item} isEditing editCallbacks={makeEditCallbacks()} />);
      expect(screen.queryByRole("button", { name: "Upload Thumbnail" })).toBeNull();
    });

    it("calls onMediaUpload when video file selected", () => {
      const onMediaUpload = vi.fn();
      const item = makeMockFeedItem({ type: "video", mediaUrl: null });
      render(<VideoDetail item={item} isEditing editCallbacks={makeEditCallbacks({ onMediaUpload })} />);

      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      const file = new File(["data"], "video.mp4", { type: "video/mp4" });
      fireEvent.change(fileInput, { target: { files: [file] } });

      expect(onMediaUpload).toHaveBeenCalledWith(file);
    });

    it("calls onThumbnailUpload when image file selected for thumbnail", () => {
      const onThumbnailUpload = vi.fn();
      const item = makeMockFeedItem({
        type: "video",
        mediaUrl: "/api/content/c1/media",
        thumbnailUrl: null,
      });
      render(<VideoDetail item={item} isEditing editCallbacks={makeEditCallbacks({ onThumbnailUpload })} />);

      const inputs = document.querySelectorAll('input[type="file"]');
      const imageInput = Array.from(inputs).find((i) => (i as HTMLInputElement).accept === "image/*") as HTMLInputElement;
      const file = new File(["img"], "thumb.jpg", { type: "image/jpeg" });
      fireEvent.change(imageInput, { target: { files: [file] } });

      expect(onThumbnailUpload).toHaveBeenCalledWith(file);
    });

    it("renders Replace Video and Remove Video buttons when media exists and editing", () => {
      const item = makeMockFeedItem({
        type: "video",
        mediaUrl: "/api/content/c1/media",
        thumbnailUrl: null,
      });
      render(<VideoDetail item={item} isEditing editCallbacks={makeEditCallbacks()} />);
      expect(screen.getByRole("button", { name: "Replace Video" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Remove Video" })).toBeInTheDocument();
    });

    it("does not render Replace Video button in non-edit mode", () => {
      const item = makeMockFeedItem({ type: "video", mediaUrl: "/api/content/c1/media" });
      render(<VideoDetail item={item} />);
      expect(screen.queryByRole("button", { name: "Replace Video" })).toBeNull();
    });

    it("calls onMediaRemove when Remove Video is clicked", () => {
      const onMediaRemove = vi.fn();
      const item = makeMockFeedItem({ type: "video", mediaUrl: "/api/content/c1/media" });
      render(<VideoDetail item={item} isEditing editCallbacks={makeEditCallbacks({ onMediaRemove })} />);
      fireEvent.click(screen.getByRole("button", { name: "Remove Video" }));
      expect(onMediaRemove).toHaveBeenCalledOnce();
    });

    it("renders Replace Thumbnail and Remove Thumbnail buttons when thumbnail exists and editing", () => {
      const item = makeMockFeedItem({
        type: "video",
        mediaUrl: "/api/content/c1/media",
        thumbnailUrl: "/api/content/c1/thumbnail",
      });
      render(<VideoDetail item={item} isEditing editCallbacks={makeEditCallbacks()} />);
      expect(screen.getByRole("button", { name: "Replace Thumbnail" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Remove Thumbnail" })).toBeInTheDocument();
    });

    it("calls onThumbnailRemove when Remove Thumbnail is clicked", () => {
      const onThumbnailRemove = vi.fn();
      const item = makeMockFeedItem({
        type: "video",
        mediaUrl: "/api/content/c1/media",
        thumbnailUrl: "/api/content/c1/thumbnail",
      });
      render(<VideoDetail item={item} isEditing editCallbacks={makeEditCallbacks({ onThumbnailRemove })} />);
      fireEvent.click(screen.getByRole("button", { name: "Remove Thumbnail" }));
      expect(onThumbnailRemove).toHaveBeenCalledOnce();
    });

    it("renders Replace Thumbnail in no-media branch when thumbnail exists and editing", () => {
      const item = makeMockFeedItem({
        type: "video",
        mediaUrl: null,
        thumbnailUrl: "/api/content/c1/thumbnail",
      });
      render(<VideoDetail item={item} isEditing editCallbacks={makeEditCallbacks()} />);
      expect(screen.getByRole("button", { name: "Replace Thumbnail" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Remove Thumbnail" })).toBeInTheDocument();
    });

    it("renders Upload Thumbnail in no-media branch when no thumbnail and editing", () => {
      const item = makeMockFeedItem({
        type: "video",
        mediaUrl: null,
        thumbnailUrl: null,
      });
      render(<VideoDetail item={item} isEditing editCallbacks={makeEditCallbacks()} />);
      expect(screen.getByRole("button", { name: "Upload Thumbnail" })).toBeInTheDocument();
    });
  });
});
