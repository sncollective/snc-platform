import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

import { makeMockFeedItem } from "../../helpers/content-fixtures.js";

// ── Hoisted Mocks ──

vi.mock("@tanstack/react-router", () => ({
  Link: ({ to, children, ...rest }: { to: string; children: React.ReactNode; [key: string]: unknown }) => (
    <a href={to as string} {...rest}>{children}</a>
  ),
}));

// ── Component Under Test ──

import { ContentSettingsSidebar } from "../../../src/components/content/content-settings-sidebar.js";
import type { ContentSettingsSidebarProps } from "../../../src/components/content/content-settings-sidebar.js";
import type { ContentDisplayState } from "../../../src/hooks/use-content-display-state.js";

// ── Helpers ──

const noMediaState: ContentDisplayState = { phase: "no-media" };
const readyState: ContentDisplayState = { phase: "ready" };

function makeDefaultProps(overrides?: Partial<ContentSettingsSidebarProps>): ContentSettingsSidebarProps {
  return {
    item: makeMockFeedItem({ processingStatus: null, videoCodec: null, audioCodec: null, width: null, height: null, duration: null, bitrate: null }),
    displayState: noMediaState,
    isEditing: true,
    onTitleChange: vi.fn(),
    onDescriptionChange: vi.fn(),
    onVisibilityChange: vi.fn(),
    onPublish: vi.fn().mockResolvedValue(undefined),
    onUnpublish: vi.fn().mockResolvedValue(undefined),
    isPublishing: false,
    canPublish: true,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("ContentSettingsSidebar", () => {
  it("renders title and description fields", () => {
    render(<ContentSettingsSidebar {...makeDefaultProps()} />);
    expect(screen.getByLabelText("Title")).toBeInTheDocument();
    expect(screen.getByLabelText("Description")).toBeInTheDocument();
  });

  it("calls onTitleChange when title edited", () => {
    const onTitleChange = vi.fn();
    render(<ContentSettingsSidebar {...makeDefaultProps({ onTitleChange })} />);
    const titleInput = screen.getByLabelText("Title");
    fireEvent.change(titleInput, { target: { value: "New Title" } });
    expect(onTitleChange).toHaveBeenCalledWith("New Title");
  });

  it("calls onVisibilityChange when visibility changed", () => {
    const onVisibilityChange = vi.fn();
    render(<ContentSettingsSidebar {...makeDefaultProps({ onVisibilityChange })} />);
    const select = screen.getByLabelText("Visibility");
    fireEvent.change(select, { target: { value: "subscribers" } });
    expect(onVisibilityChange).toHaveBeenCalledWith("subscribers");
  });

  it("shows slug as read-only text when item has a slug", () => {
    const item = makeMockFeedItem({
      slug: "my-test-post",
      processingStatus: null,
      videoCodec: null,
      audioCodec: null,
      width: null,
      height: null,
      duration: null,
      bitrate: null,
    });
    render(<ContentSettingsSidebar {...makeDefaultProps({ item })} />);
    expect(screen.getByText("/my-test-post")).toBeInTheDocument();
  });

  it("does not show slug display when slug is null", () => {
    const item = makeMockFeedItem({
      slug: null,
      processingStatus: null,
      videoCodec: null,
      audioCodec: null,
      width: null,
      height: null,
      duration: null,
      bitrate: null,
    });
    render(<ContentSettingsSidebar {...makeDefaultProps({ item })} />);
    expect(screen.queryByText("URL")).not.toBeInTheDocument();
  });

  it("shows publish button for drafts (no publishedAt)", () => {
    const item = makeMockFeedItem({
      publishedAt: null,
      processingStatus: null,
      videoCodec: null,
      audioCodec: null,
      width: null,
      height: null,
      duration: null,
      bitrate: null,
    });
    render(<ContentSettingsSidebar {...makeDefaultProps({ item, canPublish: true })} />);
    expect(screen.getByRole("button", { name: "Publish" })).toBeInTheDocument();
  });

  it("shows unpublish button for published content", () => {
    const item = makeMockFeedItem({
      publishedAt: "2026-03-01T00:00:00.000Z",
      processingStatus: null,
      videoCodec: null,
      audioCodec: null,
      width: null,
      height: null,
      duration: null,
      bitrate: null,
    });
    render(<ContentSettingsSidebar {...makeDefaultProps({ item })} />);
    expect(screen.getByRole("button", { name: "Revert to Draft" })).toBeInTheDocument();
  });

  it("disables publish when canPublish is false", () => {
    const item = makeMockFeedItem({
      publishedAt: null,
      processingStatus: null,
      videoCodec: null,
      audioCodec: null,
      width: null,
      height: null,
      duration: null,
      bitrate: null,
    });
    render(<ContentSettingsSidebar {...makeDefaultProps({ item, canPublish: false })} />);
    expect(screen.getByRole("button", { name: "Publish" })).toBeDisabled();
  });

  it("shows publish confirmation on publish click", () => {
    const item = makeMockFeedItem({
      publishedAt: null,
      processingStatus: null,
      videoCodec: null,
      audioCodec: null,
      width: null,
      height: null,
      duration: null,
      bitrate: null,
    });
    render(<ContentSettingsSidebar {...makeDefaultProps({ item, canPublish: true })} />);
    fireEvent.click(screen.getByRole("button", { name: "Publish" }));
    expect(screen.getByRole("button", { name: "Confirm" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
  });

  it("calls onPublish when confirmation confirmed", () => {
    const onPublish = vi.fn().mockResolvedValue(undefined);
    const item = makeMockFeedItem({
      publishedAt: null,
      processingStatus: null,
      videoCodec: null,
      audioCodec: null,
      width: null,
      height: null,
      duration: null,
      bitrate: null,
    });
    render(<ContentSettingsSidebar {...makeDefaultProps({ item, canPublish: true, onPublish })} />);
    fireEvent.click(screen.getByRole("button", { name: "Publish" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
    expect(onPublish).toHaveBeenCalled();
  });

  it("shows processing indicator for active processing", () => {
    const item = makeMockFeedItem({
      type: "video",
      processingStatus: "processing",
      videoCodec: null,
      audioCodec: null,
      width: null,
      height: null,
      duration: null,
      bitrate: null,
    });
    const displayState: ContentDisplayState = { phase: "processing", status: "processing" };
    render(<ContentSettingsSidebar {...makeDefaultProps({ item, displayState })} />);
    // ProcessingIndicator renders for non-ready statuses
    expect(screen.getByText("Processing media...")).toBeInTheDocument();
  });

  it("shows media status section for audio/video only", () => {
    const audioItem = makeMockFeedItem({
      type: "audio",
      processingStatus: null,
      videoCodec: null,
      audioCodec: null,
      width: null,
      height: null,
      duration: null,
      bitrate: null,
    });
    const { rerender } = render(<ContentSettingsSidebar {...makeDefaultProps({ item: audioItem })} />);
    expect(screen.getByText("Media")).toBeInTheDocument();

    const writtenItem = makeMockFeedItem({
      type: "written",
      processingStatus: null,
      videoCodec: null,
      audioCodec: null,
      width: null,
      height: null,
      duration: null,
      bitrate: null,
    });
    rerender(<ContentSettingsSidebar {...makeDefaultProps({ item: writtenItem })} />);
    expect(screen.queryByText("Media")).not.toBeInTheDocument();
  });

  it("shows 'Media uploaded' when displayState.phase is ready", () => {
    const item = makeMockFeedItem({
      type: "video",
      mediaUrl: "/api/content/c1/media",
      processingStatus: "ready",
    });
    render(<ContentSettingsSidebar {...makeDefaultProps({ item, displayState: readyState })} />);
    expect(screen.getByText("Media uploaded")).toBeInTheDocument();
  });

  it("shows 'No media uploaded' when displayState.phase is no-media", () => {
    const item = makeMockFeedItem({
      type: "video",
      mediaUrl: null,
      processingStatus: null,
    });
    render(<ContentSettingsSidebar {...makeDefaultProps({ item, displayState: noMediaState })} />);
    expect(screen.getByText("No media uploaded")).toBeInTheDocument();
  });

  it("shows 'Uploading...' when displayState.phase is uploading", () => {
    const item = makeMockFeedItem({ type: "video", mediaUrl: null });
    const displayState: ContentDisplayState = {
      phase: "uploading",
      upload: {
        id: "uppy-1",
        filename: "video.mp4",
        progress: 50,
        status: "uploading",
        resourceId: item.id,
        purpose: "content-media",
      },
    };
    render(<ContentSettingsSidebar {...makeDefaultProps({ item, displayState })} />);
    expect(screen.getByText("Uploading...")).toBeInTheDocument();
  });

  it("shows 'Processing failed' when displayState.phase is failed", () => {
    const item = makeMockFeedItem({ type: "video", mediaUrl: null, processingStatus: "failed" });
    const displayState: ContentDisplayState = { phase: "failed" };
    render(<ContentSettingsSidebar {...makeDefaultProps({ item, displayState })} />);
    expect(screen.getByText("Processing failed")).toBeInTheDocument();
  });
});
