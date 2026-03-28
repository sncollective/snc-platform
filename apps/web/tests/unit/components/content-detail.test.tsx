import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

import { makeMockFeedItem } from "../../helpers/content-fixtures.js";
import { createRouterMock } from "../../helpers/router-mock.js";

// ── Hoisted Mocks ──

const { mockVideoDetail, mockAudioDetail, mockWrittenDetail } = vi.hoisted(() => ({
  mockVideoDetail: vi.fn(),
  mockAudioDetail: vi.fn(),
  mockWrittenDetail: vi.fn(),
}));

vi.mock("@tanstack/react-router", () => createRouterMock());

vi.mock("../../../src/components/content/video-detail-view.js", () => ({
  VideoDetailView: (props: Record<string, unknown>) => {
    mockVideoDetail(props);
    return <div data-testid="video-detail" />;
  },
}));

vi.mock("../../../src/components/content/audio-detail-view.js", () => ({
  AudioDetailView: (props: Record<string, unknown>) => {
    mockAudioDetail(props);
    return <div data-testid="audio-detail" />;
  },
}));

vi.mock("../../../src/components/content/written-detail-view.js", () => ({
  WrittenDetailView: (props: Record<string, unknown>) => {
    mockWrittenDetail(props);
    return <div data-testid="written-detail" />;
  },
}));

// ── Component Under Test ──

import { ContentDetail } from "../../../src/components/content/content-detail.js";

// ── Lifecycle ──

beforeEach(() => {
  mockVideoDetail.mockReset();
  mockAudioDetail.mockReset();
  mockWrittenDetail.mockReset();
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

  it("does not show Manage link when canManage is false", () => {
    const item = makeMockFeedItem();
    render(<ContentDetail item={item} plans={[]} canManage={false} />);
    expect(screen.queryByRole("link", { name: "Manage" })).toBeNull();
  });

  it("does not show Manage link when canManage is omitted", () => {
    const item = makeMockFeedItem();
    render(<ContentDetail item={item} plans={[]} />);
    expect(screen.queryByRole("link", { name: "Manage" })).toBeNull();
  });

  it("shows Manage link when canManage is true", () => {
    const item = makeMockFeedItem({ creatorId: "creator-uuid" });
    render(<ContentDetail item={item} plans={[]} canManage />);
    expect(screen.getByRole("link", { name: "Manage" })).toBeInTheDocument();
  });

  it("Manage link points to edit route using creator handle when available", () => {
    const item = makeMockFeedItem({
      creatorHandle: "my-creator",
      creatorId: "creator-uuid",
      id: "content-1",
    });
    render(<ContentDetail item={item} plans={[]} canManage />);
    const manageLink = screen.getByRole("link", { name: "Manage" });
    expect(manageLink).toHaveAttribute(
      "href",
      "/creators/my-creator/manage/content/content-1",
    );
  });

  it("Manage link falls back to creatorId when handle is null", () => {
    const item = makeMockFeedItem({
      creatorHandle: null,
      creatorId: "creator-uuid",
      id: "content-1",
    });
    render(<ContentDetail item={item} plans={[]} canManage />);
    const manageLink = screen.getByRole("link", { name: "Manage" });
    expect(manageLink).toHaveAttribute(
      "href",
      "/creators/creator-uuid/manage/content/content-1",
    );
  });

  it("does not render edit/save/cancel/publish/delete buttons", () => {
    const item = makeMockFeedItem({ type: "written" });
    render(<ContentDetail item={item} plans={[]} canManage />);
    expect(screen.queryByRole("button", { name: "Edit" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Save" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Cancel" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Publish" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Unpublish" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Delete" })).toBeNull();
  });

  it("does not pass isEditing or editCallbacks to detail components", () => {
    const item = makeMockFeedItem({ type: "video" });
    render(<ContentDetail item={item} plans={[]} canManage />);
    expect(mockVideoDetail).toHaveBeenCalledWith(
      expect.not.objectContaining({ isEditing: true }),
    );
    expect(mockVideoDetail).toHaveBeenCalledWith(
      expect.not.objectContaining({ editCallbacks: expect.anything() }),
    );
  });
});
