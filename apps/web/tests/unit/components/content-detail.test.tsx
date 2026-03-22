import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

import { makeMockFeedItem } from "../../helpers/content-fixtures.js";
import { createRouterMock } from "../../helpers/router-mock.js";

// ── Hoisted Mocks ──

const {
  mockVideoDetail,
  mockAudioDetail,
  mockWrittenDetail,
  mockNavigate,
  mockDeleteContent,
  mockUpdateContent,
  mockPublishContent,
  mockUnpublishContent,
  mockStartUpload,
  mockUseUpload,
} = vi.hoisted(() => ({
  mockVideoDetail: vi.fn(),
  mockAudioDetail: vi.fn(),
  mockWrittenDetail: vi.fn(),
  mockNavigate: vi.fn(),
  mockDeleteContent: vi.fn(),
  mockUpdateContent: vi.fn(),
  mockPublishContent: vi.fn(),
  mockUnpublishContent: vi.fn(),
  mockStartUpload: vi.fn(),
  mockUseUpload: vi.fn(),
}));

vi.mock("@tanstack/react-router", () =>
  createRouterMock({ useNavigate: () => mockNavigate }),
);

vi.mock("../../../src/lib/content.js", () => ({
  deleteContent: mockDeleteContent,
  updateContent: mockUpdateContent,
  publishContent: mockPublishContent,
  unpublishContent: mockUnpublishContent,
}));

vi.mock("../../../src/contexts/upload-context.js", () => ({
  useUpload: mockUseUpload,
}));

vi.mock("../../../src/components/content/video-detail.js", () => ({
  VideoDetail: (props: Record<string, unknown>) => {
    mockVideoDetail(props);
    return <div data-testid="video-detail" />;
  },
}));

vi.mock("../../../src/components/content/audio-detail.js", () => ({
  AudioDetail: (props: Record<string, unknown>) => {
    mockAudioDetail(props);
    return <div data-testid="audio-detail" />;
  },
}));

vi.mock("../../../src/components/content/written-detail.js", () => ({
  WrittenDetail: (props: Record<string, unknown>) => {
    mockWrittenDetail(props);
    return <div data-testid="written-detail" />;
  },
}));

// ── Component Under Test ──

import { ContentDetail } from "../../../src/components/content/content-detail.js";

// ── Lifecycle ──

beforeEach(() => {
  mockNavigate.mockReset();
  mockDeleteContent.mockReset();
  mockUpdateContent.mockReset();
  mockPublishContent.mockReset();
  mockUnpublishContent.mockReset();
  mockStartUpload.mockReset();
  mockVideoDetail.mockReset();
  mockAudioDetail.mockReset();
  mockWrittenDetail.mockReset();
  mockUseUpload.mockReturnValue({
    state: { activeUploads: [], isUploading: false, isExpanded: false },
    actions: {
      startUpload: mockStartUpload,
      cancelUpload: vi.fn(),
      cancelAll: vi.fn(),
      dismissCompleted: vi.fn(),
      toggleExpanded: vi.fn(),
    },
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// ── Tests ──

describe("ContentDetail", () => {
  it("renders VideoDetail for video type", () => {
    const item = makeMockFeedItem({ type: "video" });
    render(<ContentDetail item={item} plans={[]} />);
    expect(screen.getByTestId("video-detail")).toBeInTheDocument();
  });

  it("renders AudioDetail for audio type", () => {
    const item = makeMockFeedItem({ type: "audio" });
    render(<ContentDetail item={item} plans={[]} />);
    expect(screen.getByTestId("audio-detail")).toBeInTheDocument();
  });

  it("renders WrittenDetail for written type", () => {
    const item = makeMockFeedItem({ type: "written" });
    render(<ContentDetail item={item} plans={[]} />);
    expect(screen.getByTestId("written-detail")).toBeInTheDocument();
  });

  it("wraps content in an article element", () => {
    const item = makeMockFeedItem();
    const { container } = render(<ContentDetail item={item} plans={[]} />);
    expect(container.querySelector("article")).not.toBeNull();
  });

  it("passes locked=true to VideoDetail when content is subscribers-only and gated", () => {
    const item = makeMockFeedItem({
      type: "video",
      visibility: "subscribers",
      mediaUrl: null,
      body: null,
    });
    render(<ContentDetail item={item} plans={[]} />);
    expect(mockVideoDetail).toHaveBeenCalledWith(
      expect.objectContaining({ locked: true }),
    );
  });

  it("passes locked=false to VideoDetail when content is public", () => {
    const item = makeMockFeedItem({ type: "video", visibility: "public" });
    render(<ContentDetail item={item} plans={[]} />);
    expect(mockVideoDetail).toHaveBeenCalledWith(
      expect.objectContaining({ locked: false }),
    );
  });

  it("passes locked=false when subscribers content has mediaUrl (user has access)", () => {
    const item = makeMockFeedItem({
      type: "video",
      visibility: "subscribers",
      mediaUrl: "/api/content/1/media",
    });
    render(<ContentDetail item={item} plans={[]} />);
    expect(mockVideoDetail).toHaveBeenCalledWith(
      expect.objectContaining({ locked: false }),
    );
  });

  it("passes locked=true to AudioDetail when subscribers-only and gated", () => {
    const item = makeMockFeedItem({
      type: "audio",
      visibility: "subscribers",
      mediaUrl: null,
      body: null,
    });
    render(<ContentDetail item={item} plans={[]} />);
    expect(mockAudioDetail).toHaveBeenCalledWith(
      expect.objectContaining({ locked: true }),
    );
  });

  it("passes locked=false to AudioDetail when content is public", () => {
    const item = makeMockFeedItem({ type: "audio", visibility: "public" });
    render(<ContentDetail item={item} plans={[]} />);
    expect(mockAudioDetail).toHaveBeenCalledWith(
      expect.objectContaining({ locked: false }),
    );
  });

  it("passes locked=false to AudioDetail when subscribers content has mediaUrl", () => {
    const item = makeMockFeedItem({
      type: "audio",
      visibility: "subscribers",
      mediaUrl: "/api/content/1/media",
    });
    render(<ContentDetail item={item} plans={[]} />);
    expect(mockAudioDetail).toHaveBeenCalledWith(
      expect.objectContaining({ locked: false }),
    );
  });

  it("passes locked=true to WrittenDetail when subscribers-only and gated", () => {
    const item = makeMockFeedItem({
      type: "written",
      visibility: "subscribers",
      mediaUrl: null,
      body: null,
    });
    render(<ContentDetail item={item} plans={[]} />);
    expect(mockWrittenDetail).toHaveBeenCalledWith(
      expect.objectContaining({ locked: true }),
    );
  });

  it("passes locked=false to WrittenDetail when content is public", () => {
    const item = makeMockFeedItem({ type: "written", visibility: "public" });
    render(<ContentDetail item={item} plans={[]} />);
    expect(mockWrittenDetail).toHaveBeenCalledWith(
      expect.objectContaining({ locked: false }),
    );
  });

  it("passes locked=false to WrittenDetail when subscribers content has mediaUrl", () => {
    const item = makeMockFeedItem({
      type: "written",
      visibility: "subscribers",
      mediaUrl: "/api/content/1/media",
    });
    render(<ContentDetail item={item} plans={[]} />);
    expect(mockWrittenDetail).toHaveBeenCalledWith(
      expect.objectContaining({ locked: false }),
    );
  });

  it("passes plans to variant detail components", () => {
    const item = makeMockFeedItem({ type: "video" });
    render(<ContentDetail item={item} plans={[]} />);
    expect(mockVideoDetail).toHaveBeenCalledWith(
      expect.objectContaining({ plans: [] }),
    );
  });

  it("does not show owner actions when canManage is false", () => {
    const item = makeMockFeedItem();
    render(<ContentDetail item={item} plans={[]} canManage={false} />);
    expect(screen.queryByRole("button", { name: "Edit" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Delete" })).toBeNull();
  });

  it("does not show owner actions when canManage is omitted", () => {
    const item = makeMockFeedItem();
    render(<ContentDetail item={item} plans={[]} />);
    expect(screen.queryByRole("button", { name: "Edit" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Delete" })).toBeNull();
  });

  it("shows Edit button, back link, and Delete when canManage is true", () => {
    const item = makeMockFeedItem({ creatorId: "creator-uuid" });
    render(<ContentDetail item={item} plans={[]} canManage />);
    expect(screen.getByRole("button", { name: "Edit" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "← Manage" })).toBeInTheDocument();
  });

  it("back link points to manage content page using creator handle", () => {
    const item = makeMockFeedItem({ creatorHandle: "my-creator", creatorId: "creator-uuid" });
    render(<ContentDetail item={item} plans={[]} canManage />);
    const backLink = screen.getByRole("link", { name: "← Manage" });
    expect(backLink).toHaveAttribute("href", "/creators/my-creator/manage/content");
  });

  it("Edit button toggles edit mode showing Save and Cancel", () => {
    const item = makeMockFeedItem({ type: "written" });
    render(<ContentDetail item={item} plans={[]} canManage />);

    fireEvent.click(screen.getByRole("button", { name: "Edit" }));

    expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Edit" })).toBeNull();
  });

  it("Cancel reverts edit mode and hides Save/Cancel buttons", () => {
    const item = makeMockFeedItem({ type: "written" });
    render(<ContentDetail item={item} plans={[]} canManage />);

    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.getByRole("button", { name: "Edit" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Save" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Cancel" })).toBeNull();
  });

  it("Save calls updateContent with edited values", async () => {
    mockUpdateContent.mockResolvedValue({});
    vi.stubGlobal("location", { reload: vi.fn() });

    const item = makeMockFeedItem({ type: "written", id: "content-1" });
    render(<ContentDetail item={item} plans={[]} canManage />);

    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(mockUpdateContent).toHaveBeenCalledWith(
        "content-1",
        expect.objectContaining({ title: item.title }),
      );
    });
  });

  it("shows Publish button when content has no publishedAt", () => {
    const item = makeMockFeedItem({ type: "written", publishedAt: null });
    render(<ContentDetail item={item} plans={[]} canManage />);
    expect(screen.getByRole("button", { name: "Publish" })).toBeInTheDocument();
  });

  it("shows Unpublish button when content has publishedAt", () => {
    const item = makeMockFeedItem({ publishedAt: "2026-01-01T00:00:00.000Z" });
    render(<ContentDetail item={item} plans={[]} canManage />);
    expect(screen.getByRole("button", { name: "Unpublish" })).toBeInTheDocument();
  });

  it("Publish button calls publishContent", async () => {
    mockPublishContent.mockResolvedValue({});
    vi.stubGlobal("location", { reload: vi.fn() });

    const item = makeMockFeedItem({ type: "written", publishedAt: null });
    render(<ContentDetail item={item} plans={[]} canManage />);

    fireEvent.click(screen.getByRole("button", { name: "Publish" }));

    await waitFor(() => {
      expect(mockPublishContent).toHaveBeenCalledWith(item.id);
    });
  });

  it("Unpublish button calls unpublishContent", async () => {
    mockUnpublishContent.mockResolvedValue({});
    vi.stubGlobal("location", { reload: vi.fn() });

    const item = makeMockFeedItem({ publishedAt: "2026-01-01T00:00:00.000Z" });
    render(<ContentDetail item={item} plans={[]} canManage />);

    fireEvent.click(screen.getByRole("button", { name: "Unpublish" }));

    await waitFor(() => {
      expect(mockUnpublishContent).toHaveBeenCalledWith(item.id);
    });
  });

  it("does not show Upload Media button in the action bar for video content", () => {
    const item = makeMockFeedItem({ type: "video", mediaUrl: null });
    render(<ContentDetail item={item} plans={[]} canManage />);
    // Upload buttons are now in the detail components, not the action bar
    expect(screen.queryByRole("button", { name: "Upload Media" })).toBeNull();
  });

  it("does not show Upload Thumbnail button in the action bar for video content", () => {
    const item = makeMockFeedItem({ type: "video", thumbnailUrl: null });
    render(<ContentDetail item={item} plans={[]} canManage />);
    // Upload buttons are now in the detail components, not the action bar
    expect(screen.queryByRole("button", { name: "Upload Thumbnail" })).toBeNull();
  });

  it("does not show Upload Cover Art button in the action bar for audio content", () => {
    const item = makeMockFeedItem({ type: "audio", thumbnailUrl: null });
    render(<ContentDetail item={item} plans={[]} canManage />);
    // Upload buttons are now in the detail components, not the action bar
    expect(screen.queryByRole("button", { name: "Upload Cover Art" })).toBeNull();
  });

  it("does not show Upload Media button for written content", () => {
    const item = makeMockFeedItem({ type: "written" });
    render(<ContentDetail item={item} plans={[]} canManage />);
    expect(screen.queryByRole("button", { name: "Upload Media" })).toBeNull();
  });

  it("calls deleteContent and navigates to feed when Delete confirmed", async () => {
    mockDeleteContent.mockResolvedValue(undefined);
    vi.stubGlobal("confirm", () => true);

    const item = makeMockFeedItem({ id: "content-1", creatorId: "creator-uuid" });
    render(<ContentDetail item={item} plans={[]} canManage />);

    fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    await waitFor(() => {
      expect(mockDeleteContent).toHaveBeenCalledWith("content-1");
      expect(mockNavigate).toHaveBeenCalledWith({ to: "/feed" });
    });
  });

  it("does not call deleteContent when user cancels confirm", () => {
    vi.stubGlobal("confirm", () => false);

    const item = makeMockFeedItem();
    render(<ContentDetail item={item} plans={[]} canManage />);

    fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    expect(mockDeleteContent).not.toHaveBeenCalled();
  });

  it("passes isEditing=true and editCallbacks to WrittenDetail when editing", () => {
    const item = makeMockFeedItem({ type: "written" });
    render(<ContentDetail item={item} plans={[]} canManage />);

    fireEvent.click(screen.getByRole("button", { name: "Edit" }));

    expect(mockWrittenDetail).toHaveBeenLastCalledWith(
      expect.objectContaining({
        isEditing: true,
        editCallbacks: expect.objectContaining({
          onTitleChange: expect.any(Function),
          onDescriptionChange: expect.any(Function),
          onVisibilityChange: expect.any(Function),
          onBodyChange: expect.any(Function),
        }),
      }),
    );
  });

  it("passes isEditing=true and editCallbacks to VideoDetail when editing", () => {
    const item = makeMockFeedItem({ type: "video" });
    render(<ContentDetail item={item} plans={[]} canManage />);

    fireEvent.click(screen.getByRole("button", { name: "Edit" }));

    expect(mockVideoDetail).toHaveBeenLastCalledWith(
      expect.objectContaining({
        isEditing: true,
        editCallbacks: expect.objectContaining({
          onTitleChange: expect.any(Function),
          onDescriptionChange: expect.any(Function),
          onVisibilityChange: expect.any(Function),
        }),
      }),
    );
  });

  it("passes isEditing=false when not in edit mode", () => {
    const item = makeMockFeedItem({ type: "written" });
    render(<ContentDetail item={item} plans={[]} canManage />);

    expect(mockWrittenDetail).toHaveBeenCalledWith(
      expect.objectContaining({ isEditing: false }),
    );
  });

  it("starts in edit mode when initialEdit is true", () => {
    const item = makeMockFeedItem({ type: "written" });
    render(<ContentDetail item={item} plans={[]} canManage initialEdit={true} />);

    expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Edit" })).toBeNull();
  });

  it("stays in view mode when initialEdit is false", () => {
    const item = makeMockFeedItem({ type: "written" });
    render(<ContentDetail item={item} plans={[]} canManage initialEdit={false} />);

    expect(screen.getByRole("button", { name: "Edit" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Save" })).toBeNull();
  });

  it("passes onMediaUpload and onThumbnailUpload callbacks in editCallbacks when editing", () => {
    const item = makeMockFeedItem({ type: "video" });
    render(<ContentDetail item={item} plans={[]} canManage />);

    fireEvent.click(screen.getByRole("button", { name: "Edit" }));

    expect(mockVideoDetail).toHaveBeenLastCalledWith(
      expect.objectContaining({
        isEditing: true,
        editCallbacks: expect.objectContaining({
          onMediaUpload: expect.any(Function),
          onThumbnailUpload: expect.any(Function),
        }),
      }),
    );
  });

  it("passes onThumbnailRemove and onMediaRemove callbacks in editCallbacks when editing", () => {
    const item = makeMockFeedItem({ type: "video" });
    render(<ContentDetail item={item} plans={[]} canManage />);

    fireEvent.click(screen.getByRole("button", { name: "Edit" }));

    expect(mockVideoDetail).toHaveBeenLastCalledWith(
      expect.objectContaining({
        isEditing: true,
        editCallbacks: expect.objectContaining({
          onThumbnailRemove: expect.any(Function),
          onMediaRemove: expect.any(Function),
        }),
      }),
    );
  });

  it("onThumbnailRemove calls updateContent with clearThumbnail: true and reloads", async () => {
    mockUpdateContent.mockResolvedValue({});
    vi.stubGlobal("location", { reload: vi.fn() });

    const item = makeMockFeedItem({ type: "video", id: "content-1" });
    render(<ContentDetail item={item} plans={[]} canManage />);
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));

    const callbacks = mockVideoDetail.mock.lastCall?.[0] as { editCallbacks: { onThumbnailRemove: () => Promise<void> } };
    await callbacks.editCallbacks.onThumbnailRemove();

    expect(mockUpdateContent).toHaveBeenCalledWith("content-1", { clearThumbnail: true });
  });

  it("onMediaRemove calls updateContent with clearMedia: true after confirmation", async () => {
    mockUpdateContent.mockResolvedValue({});
    vi.stubGlobal("confirm", () => true);
    vi.stubGlobal("location", { reload: vi.fn() });

    const item = makeMockFeedItem({ type: "video", id: "content-1" });
    render(<ContentDetail item={item} plans={[]} canManage />);
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));

    const callbacks = mockVideoDetail.mock.lastCall?.[0] as { editCallbacks: { onMediaRemove: () => Promise<void> } };
    await callbacks.editCallbacks.onMediaRemove();

    expect(mockUpdateContent).toHaveBeenCalledWith("content-1", { clearMedia: true });
  });

  it("onMediaRemove does not call updateContent when confirmation is declined", async () => {
    vi.stubGlobal("confirm", () => false);

    const item = makeMockFeedItem({ type: "video", id: "content-1" });
    render(<ContentDetail item={item} plans={[]} canManage />);
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));

    const callbacks = mockVideoDetail.mock.lastCall?.[0] as { editCallbacks: { onMediaRemove: () => Promise<void> } };
    await callbacks.editCallbacks.onMediaRemove();

    expect(mockUpdateContent).not.toHaveBeenCalled();
  });
});
