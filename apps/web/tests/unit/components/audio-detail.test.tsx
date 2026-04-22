import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

import { makeMockFeedItem } from "../../helpers/content-fixtures.js";
import { stubComponent } from "../../helpers/component-stubs.js";
import { createFormatMock, DEFAULT_FORMAT_DATE } from "../../helpers/format-mock.js";
import { deriveContentDisplayState } from "../../../src/hooks/use-content-display-state.js";
import type { FeedItem } from "@snc/shared";

// ── Hoisted Mocks ──

const { mockAudioPlayer, mockContentFooter, mockUseContentDisplayState } = vi.hoisted(() => ({
  mockAudioPlayer: vi.fn(),
  mockContentFooter: vi.fn(),
  mockUseContentDisplayState: vi.fn(),
}));

vi.mock("../../../src/components/media/audio-player.js", () =>
  stubComponent("AudioPlayer", "audio-player", mockAudioPlayer),
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

import { AudioDetail } from "../../../src/components/content/audio-detail.js";

// ── Setup ──

beforeEach(() => {
  // Default: derive state from item alone (no active upload), matching pre-hook behavior
  mockUseContentDisplayState.mockImplementation((item: FeedItem) =>
    deriveContentDisplayState({ mediaUrl: item.mediaUrl, processingStatus: item.processingStatus, activeUpload: undefined }),
  );
});

// ── Tests ──

describe("AudioDetail", () => {
  it("renders cover art image when thumbnailUrl is present", () => {
    const item = makeMockFeedItem({
      type: "audio",
      mediaUrl: "/api/content/c1/media",
      thumbnailUrl: "/api/content/c1/thumbnail",
    });
    render(<AudioDetail item={item} />);
    const img = screen.getByRole("img");
    expect(img).toHaveAttribute("src", "/api/content/c1/thumbnail");
    expect(img).toHaveAttribute("alt", expect.stringContaining(item.title));
  });

  it("renders placeholder when no thumbnail", () => {
    const item = makeMockFeedItem({ type: "audio", mediaUrl: "/api/content/c1/media", thumbnailUrl: null });
    const { container } = render(<AudioDetail item={item} />);
    expect(screen.queryByRole("img")).toBeNull();
    // Placeholder div should exist (check for the CSS class)
    expect(container.querySelector("div")).not.toBeNull();
  });

  it("renders AudioPlayer with correct props", () => {
    const item = makeMockFeedItem({
      id: "audio-1",
      type: "audio",
      title: "Track One",
      creatorName: "Artist A",
      mediaUrl: "/api/content/audio-1/media",
      thumbnailUrl: "/api/content/audio-1/thumbnail",
    });
    render(<AudioDetail item={item} />);

    expect(mockAudioPlayer).toHaveBeenCalledWith(
      expect.objectContaining({
        src: "/api/content/audio-1/media",
        title: "Track One",
        creator: "Artist A",
        coverArtUrl: "/api/content/audio-1/thumbnail",
        contentId: "audio-1",
      }),
    );
  });

  it("renders title as h1", () => {
    const item = makeMockFeedItem({ type: "audio", title: "My Track" });
    render(<AudioDetail item={item} />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("My Track");
  });

  it("renders creator name and formatted date", () => {
    const item = makeMockFeedItem({
      type: "audio",
      creatorName: "DJ Test",
      publishedAt: "2026-01-15T00:00:00.000Z",
    });
    render(<AudioDetail item={item} />);
    expect(screen.getByText("DJ Test")).toBeInTheDocument();
    expect(screen.getByText(/FORMATTED:/)).toBeInTheDocument();
  });

  it("passes description to ContentFooter when present", () => {
    const item = makeMockFeedItem({
      type: "audio",
      description: "Liner notes here",
    });
    render(<AudioDetail item={item} />);
    expect(mockContentFooter).toHaveBeenCalledWith(
      expect.objectContaining({ description: "Liner notes here" }),
    );
  });

  it("passes null description to ContentFooter when null", () => {
    const item = makeMockFeedItem({ type: "audio", description: null });
    render(<AudioDetail item={item} />);
    expect(mockContentFooter).toHaveBeenCalledWith(
      expect.objectContaining({ description: null }),
    );
  });

  it("renders AudioPlayer when not locked", () => {
    const item = makeMockFeedItem({
      type: "audio",
      mediaUrl: "/api/content/c1/media",
    });
    render(<AudioDetail item={item} />);
    expect(screen.getByTestId("audio-player")).toBeInTheDocument();
  });

  it("does not render AudioPlayer when locked=true", () => {
    const item = makeMockFeedItem({
      type: "audio",
      visibility: "subscribers",
      mediaUrl: null,
    });
    render(<AudioDetail item={item} locked={true} />);
    expect(screen.queryByTestId("audio-player")).toBeNull();
  });

  it('renders "Subscribe to listen" text when locked=true', () => {
    const item = makeMockFeedItem({
      type: "audio",
      visibility: "subscribers",
      mediaUrl: null,
    });
    render(<AudioDetail item={item} locked={true} />);
    expect(screen.getByText("Subscribe to listen")).toBeInTheDocument();
  });

  it("renders ContentFooter with locked props when locked=true", () => {
    const item = makeMockFeedItem({
      type: "audio",
      creatorId: "creator-99",
      visibility: "subscribers",
      mediaUrl: null,
    });
    render(<AudioDetail item={item} locked={true} />);
    expect(screen.getByTestId("content-footer")).toBeInTheDocument();
    expect(mockContentFooter).toHaveBeenCalledWith(
      expect.objectContaining({
        creatorId: "creator-99",
        contentType: "audio",
        locked: true,
      }),
    );
  });

  it("renders cover art when locked and thumbnailUrl exists", () => {
    const item = makeMockFeedItem({
      type: "audio",
      visibility: "subscribers",
      mediaUrl: null,
      thumbnailUrl: "/api/content/c1/thumbnail",
    });
    render(<AudioDetail item={item} locked={true} />);
    const img = screen.getByRole("img");
    expect(img).toHaveAttribute(
      "src",
      "/api/content/c1/thumbnail",
    );
  });

  it("renders ContentMeta in both locked and unlocked states", () => {
    const item = makeMockFeedItem({
      type: "audio",
      title: "My Track",
      creatorName: "DJ Test",
    });
    const { unmount } = render(<AudioDetail item={item} locked={true} />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "My Track",
    );
    unmount();
    render(<AudioDetail item={item} locked={false} />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "My Track",
    );
  });

  it('renders "Media not yet available" when mediaUrl is null and not locked', () => {
    const item = makeMockFeedItem({
      type: "audio",
      mediaUrl: null,
    });
    render(<AudioDetail item={item} />);
    expect(screen.getByText("Media not yet available")).toBeInTheDocument();
    expect(screen.queryByTestId("audio-player")).toBeNull();
  });

  it("does not render media unavailable when mediaUrl is present", () => {
    const item = makeMockFeedItem({
      type: "audio",
      mediaUrl: "/api/content/c1/media",
    });
    render(<AudioDetail item={item} />);
    expect(screen.queryByText("Media not yet available")).toBeNull();
    expect(screen.getByTestId("audio-player")).toBeInTheDocument();
  });

  it("renders ContentMeta in media unavailable state", () => {
    const item = makeMockFeedItem({
      type: "audio",
      title: "Draft Track",
      mediaUrl: null,
    });
    render(<AudioDetail item={item} />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Draft Track");
  });

  describe("uploading phase", () => {
    it("renders InlineUploadProgress when displayState.phase is uploading", () => {
      const item = makeMockFeedItem({ type: "audio", mediaUrl: null });
      mockUseContentDisplayState.mockReturnValue({
        phase: "uploading",
        upload: {
          id: "uppy-1",
          filename: "track.mp3",
          progress: 60,
          status: "uploading",
          resourceId: item.id,
          purpose: "content-media" as const,
        },
      });
      render(<AudioDetail item={item} />);
      expect(screen.getByText("track.mp3")).toBeInTheDocument();
      expect(screen.getByText("60%")).toBeInTheDocument();
    });
  });

  describe("processing phase", () => {
    it("renders ProcessingIndicator when displayState.phase is processing", () => {
      const item = makeMockFeedItem({ type: "audio", mediaUrl: null, processingStatus: "processing" });
      render(<AudioDetail item={item} />);
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

    it("renders Upload Audio placeholder when editing and mediaUrl is null", () => {
      const item = makeMockFeedItem({ type: "audio", mediaUrl: null, thumbnailUrl: null });
      render(<AudioDetail item={item} isEditing editCallbacks={makeEditCallbacks()} />);
      expect(screen.getByRole("button", { name: "Upload Audio" })).toBeInTheDocument();
    });

    it("does not render media unavailable text when editing and onMediaUpload provided", () => {
      const item = makeMockFeedItem({ type: "audio", mediaUrl: null, thumbnailUrl: null });
      render(<AudioDetail item={item} isEditing editCallbacks={makeEditCallbacks()} />);
      expect(screen.queryByText("Media not yet available")).toBeNull();
    });

    it("renders Upload Thumbnail placeholder when editing and thumbnailUrl is null", () => {
      const item = makeMockFeedItem({ type: "audio", mediaUrl: null, thumbnailUrl: null });
      render(<AudioDetail item={item} isEditing editCallbacks={makeEditCallbacks()} />);
      expect(screen.getByRole("button", { name: "Upload Thumbnail" })).toBeInTheDocument();
    });

    it("does not render Upload Thumbnail when thumbnailUrl is present", () => {
      const item = makeMockFeedItem({
        type: "audio",
        mediaUrl: "/api/content/c1/media",
        thumbnailUrl: "/api/content/c1/thumbnail",
      });
      render(<AudioDetail item={item} isEditing editCallbacks={makeEditCallbacks()} />);
      expect(screen.queryByRole("button", { name: "Upload Thumbnail" })).toBeNull();
    });

    it("calls onMediaUpload when audio file selected", () => {
      const onMediaUpload = vi.fn();
      const item = makeMockFeedItem({ type: "audio", mediaUrl: null, thumbnailUrl: null });
      render(<AudioDetail item={item} isEditing editCallbacks={makeEditCallbacks({ onMediaUpload })} />);

      const inputs = document.querySelectorAll('input[type="file"]');
      // audio/* input
      const audioInput = Array.from(inputs).find((i) => (i as HTMLInputElement).accept === "audio/*") as HTMLInputElement;
      const file = new File(["data"], "track.mp3", { type: "audio/mpeg" });
      fireEvent.change(audioInput, { target: { files: [file] } });

      expect(onMediaUpload).toHaveBeenCalledWith(file);
    });

    it("calls onThumbnailUpload when image file selected", () => {
      const onThumbnailUpload = vi.fn();
      const item = makeMockFeedItem({ type: "audio", mediaUrl: null, thumbnailUrl: null });
      render(<AudioDetail item={item} isEditing editCallbacks={makeEditCallbacks({ onThumbnailUpload })} />);

      const inputs = document.querySelectorAll('input[type="file"]');
      const imageInput = Array.from(inputs).find((i) => (i as HTMLInputElement).accept === "image/*") as HTMLInputElement;
      const file = new File(["img"], "cover.jpg", { type: "image/jpeg" });
      fireEvent.change(imageInput, { target: { files: [file] } });

      expect(onThumbnailUpload).toHaveBeenCalledWith(file);
    });

    it("renders Replace Thumbnail and Remove Thumbnail when thumbnail exists and editing", () => {
      const item = makeMockFeedItem({
        type: "audio",
        mediaUrl: "/api/content/c1/media",
        thumbnailUrl: "/api/content/c1/thumbnail",
      });
      render(<AudioDetail item={item} isEditing editCallbacks={makeEditCallbacks()} />);
      expect(screen.getByRole("button", { name: "Replace Thumbnail" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Remove Thumbnail" })).toBeInTheDocument();
    });

    it("calls onThumbnailRemove when Remove Thumbnail is clicked", () => {
      const onThumbnailRemove = vi.fn();
      const item = makeMockFeedItem({
        type: "audio",
        mediaUrl: "/api/content/c1/media",
        thumbnailUrl: "/api/content/c1/thumbnail",
      });
      render(<AudioDetail item={item} isEditing editCallbacks={makeEditCallbacks({ onThumbnailRemove })} />);
      fireEvent.click(screen.getByRole("button", { name: "Remove Thumbnail" }));
      expect(onThumbnailRemove).toHaveBeenCalledOnce();
    });

    it("renders Replace Audio and Remove Audio buttons when media exists and editing", () => {
      const item = makeMockFeedItem({
        type: "audio",
        mediaUrl: "/api/content/c1/media",
        thumbnailUrl: null,
      });
      render(<AudioDetail item={item} isEditing editCallbacks={makeEditCallbacks()} />);
      expect(screen.getByRole("button", { name: "Replace Audio" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Remove Audio" })).toBeInTheDocument();
    });

    it("calls onMediaRemove when Remove Audio is clicked", () => {
      const onMediaRemove = vi.fn();
      const item = makeMockFeedItem({
        type: "audio",
        mediaUrl: "/api/content/c1/media",
        thumbnailUrl: null,
      });
      render(<AudioDetail item={item} isEditing editCallbacks={makeEditCallbacks({ onMediaRemove })} />);
      fireEvent.click(screen.getByRole("button", { name: "Remove Audio" }));
      expect(onMediaRemove).toHaveBeenCalledOnce();
    });

    it("renders Replace Thumbnail in no-media branch when thumbnail exists and editing", () => {
      const item = makeMockFeedItem({
        type: "audio",
        mediaUrl: null,
        thumbnailUrl: "/api/content/c1/thumbnail",
      });
      render(<AudioDetail item={item} isEditing editCallbacks={makeEditCallbacks()} />);
      expect(screen.getByRole("button", { name: "Replace Thumbnail" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Remove Thumbnail" })).toBeInTheDocument();
    });
  });
});
