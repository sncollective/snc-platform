import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";

import { makeMockFeedItem } from "../../helpers/content-fixtures.js";
import { stubComponent } from "../../helpers/component-stubs.js";
import { createFormatMock, DEFAULT_FORMAT_DATE } from "../../helpers/format-mock.js";

// ── Hoisted Mocks ──

const { mockAudioPlayer, mockContentFooter } = vi.hoisted(() => ({
  mockAudioPlayer: vi.fn(),
  mockContentFooter: vi.fn(),
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

// ── Component Under Test ──

import { AudioDetail } from "../../../src/components/content/audio-detail.js";

// ── Lifecycle ──

afterEach(() => {
  vi.restoreAllMocks();
});

// ── Tests ──

describe("AudioDetail", () => {
  it("renders cover art image when coverArtUrl is present", () => {
    const item = makeMockFeedItem({
      type: "audio",
      coverArtUrl: "/api/content/c1/cover-art",
    });
    render(<AudioDetail item={item} />);
    const img = screen.getByRole("img");
    expect(img).toHaveAttribute("src", "/api/content/c1/cover-art");
    expect(img).toHaveAttribute("alt", expect.stringContaining(item.title));
  });

  it("renders placeholder when no cover art", () => {
    const item = makeMockFeedItem({ type: "audio", coverArtUrl: null });
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
      coverArtUrl: "/api/content/audio-1/cover-art",
    });
    render(<AudioDetail item={item} />);

    expect(mockAudioPlayer).toHaveBeenCalledWith(
      expect.objectContaining({
        src: "/api/content/audio-1/media",
        title: "Track One",
        creator: "Artist A",
        coverArtUrl: "/api/content/audio-1/cover-art",
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

  it("renders cover art when locked and coverArtUrl exists", () => {
    const item = makeMockFeedItem({
      type: "audio",
      visibility: "subscribers",
      mediaUrl: null,
      coverArtUrl: "/api/content/c1/cover-art",
    });
    render(<AudioDetail item={item} locked={true} />);
    const img = screen.getByRole("img");
    expect(img).toHaveAttribute(
      "src",
      "/api/content/c1/cover-art",
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
});
