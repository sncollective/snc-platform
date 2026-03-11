import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

import { makeMockFeedItem } from "../../helpers/content-fixtures.js";
import { stubComponent } from "../../helpers/component-stubs.js";
import { createFormatMock, DEFAULT_FORMAT_DATE } from "../../helpers/format-mock.js";

// ── Hoisted Mocks ──

const { mockVideoPlayer, mockContentFooter } = vi.hoisted(() => ({
  mockVideoPlayer: vi.fn(),
  mockContentFooter: vi.fn(),
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

// ── Component Under Test ──

import { VideoDetail } from "../../../src/components/content/video-detail.js";

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
});
