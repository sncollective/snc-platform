import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";

import { makeMockFeedItem } from "../../helpers/content-fixtures.js";

// ── Hoisted Mocks ──

const { mockVideoDetail, mockAudioDetail, mockWrittenDetail } = vi.hoisted(() => ({
  mockVideoDetail: vi.fn(),
  mockAudioDetail: vi.fn(),
  mockWrittenDetail: vi.fn(),
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

afterEach(() => {
  vi.restoreAllMocks();
});

// ── Tests ──

describe("ContentDetail", () => {
  it("renders VideoDetail for video type", () => {
    const item = makeMockFeedItem({ type: "video" });
    render(<ContentDetail item={item} />);
    expect(screen.getByTestId("video-detail")).toBeInTheDocument();
  });

  it("renders AudioDetail for audio type", () => {
    const item = makeMockFeedItem({ type: "audio" });
    render(<ContentDetail item={item} />);
    expect(screen.getByTestId("audio-detail")).toBeInTheDocument();
  });

  it("renders WrittenDetail for written type", () => {
    const item = makeMockFeedItem({ type: "written" });
    render(<ContentDetail item={item} />);
    expect(screen.getByTestId("written-detail")).toBeInTheDocument();
  });

  it("wraps content in an article element", () => {
    const item = makeMockFeedItem();
    const { container } = render(<ContentDetail item={item} />);
    expect(container.querySelector("article")).not.toBeNull();
  });

  it("passes locked=true to VideoDetail when content is subscribers-only and gated", () => {
    const item = makeMockFeedItem({
      type: "video",
      visibility: "subscribers",
      mediaUrl: null,
      body: null,
    });
    render(<ContentDetail item={item} />);
    expect(mockVideoDetail).toHaveBeenCalledWith(
      expect.objectContaining({ locked: true }),
    );
  });

  it("passes locked=false to VideoDetail when content is public", () => {
    const item = makeMockFeedItem({ type: "video", visibility: "public" });
    render(<ContentDetail item={item} />);
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
    render(<ContentDetail item={item} />);
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
    render(<ContentDetail item={item} />);
    expect(mockAudioDetail).toHaveBeenCalledWith(
      expect.objectContaining({ locked: true }),
    );
  });

  it("passes locked=false to AudioDetail when content is public", () => {
    const item = makeMockFeedItem({ type: "audio", visibility: "public" });
    render(<ContentDetail item={item} />);
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
    render(<ContentDetail item={item} />);
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
    render(<ContentDetail item={item} />);
    expect(mockWrittenDetail).toHaveBeenCalledWith(
      expect.objectContaining({ locked: true }),
    );
  });

  it("passes locked=false to WrittenDetail when content is public", () => {
    const item = makeMockFeedItem({ type: "written", visibility: "public" });
    render(<ContentDetail item={item} />);
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
    render(<ContentDetail item={item} />);
    expect(mockWrittenDetail).toHaveBeenCalledWith(
      expect.objectContaining({ locked: false }),
    );
  });
});
