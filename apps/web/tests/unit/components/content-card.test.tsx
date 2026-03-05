import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";

// ── Hoisted Mocks ──

const { mockFormatRelativeDate } = vi.hoisted(() => ({
  mockFormatRelativeDate: vi.fn(),
}));

vi.mock("@tanstack/react-router", async () => {
  const React = await import("react");
  return {
    Link: ({
      to,
      params,
      children,
      className,
    }: Record<string, unknown>) =>
      React.createElement(
        "a",
        {
          href:
            typeof params === "object" && params !== null
              ? (to as string).replace(
                  "$contentId",
                  (params as Record<string, string>).contentId!,
                )
              : (to as string),
          className,
        },
        children as React.ReactNode,
      ),
  };
});

vi.mock("../../../src/lib/format.js", () => ({
  formatRelativeDate: mockFormatRelativeDate,
}));

// ── Import component under test (after mocks) ──

import { ContentCard } from "../../../src/components/content/content-card.js";
import { makeMockFeedItem } from "../../helpers/content-fixtures.js";

afterEach(() => {
  vi.restoreAllMocks();
});

// ── Tests ──

describe("ContentCard", () => {
  it("renders title, creator name, and relative date", () => {
    mockFormatRelativeDate.mockReturnValue("2h ago");
    const item = makeMockFeedItem({
      title: "My Great Post",
      creatorName: "Alice",
      publishedAt: "2026-02-26T10:00:00.000Z",
    });

    render(<ContentCard item={item} />);

    expect(screen.getByText("My Great Post")).toBeInTheDocument();
    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("2h ago")).toBeInTheDocument();
    expect(mockFormatRelativeDate).toHaveBeenCalledWith(
      "2026-02-26T10:00:00.000Z",
    );
  });

  it("renders type badge with 'VIDEO' label for video items", () => {
    mockFormatRelativeDate.mockReturnValue("1d ago");
    const item = makeMockFeedItem({ type: "video" });

    render(<ContentCard item={item} />);

    expect(screen.getByText("VIDEO")).toBeInTheDocument();
  });

  it("renders type badge with 'AUDIO' label for audio items", () => {
    mockFormatRelativeDate.mockReturnValue("1d ago");
    const item = makeMockFeedItem({ type: "audio" });

    render(<ContentCard item={item} />);

    expect(screen.getByText("AUDIO")).toBeInTheDocument();
  });

  it("renders type badge with 'POST' label for written items", () => {
    mockFormatRelativeDate.mockReturnValue("1d ago");
    const item = makeMockFeedItem({ type: "written" });

    render(<ContentCard item={item} />);

    expect(screen.getByText("POST")).toBeInTheDocument();
  });

  it("renders lock icon when visibility is 'subscribers'", () => {
    mockFormatRelativeDate.mockReturnValue("1d ago");
    const item = makeMockFeedItem({ visibility: "subscribers" });

    render(<ContentCard item={item} />);

    expect(screen.getByLabelText("Subscribers only")).toBeInTheDocument();
  });

  it("does not render lock icon when visibility is 'public'", () => {
    mockFormatRelativeDate.mockReturnValue("1d ago");
    const item = makeMockFeedItem({ visibility: "public" });

    render(<ContentCard item={item} />);

    expect(screen.queryByLabelText("Subscribers only")).toBeNull();
  });

  it("renders thumbnail image when thumbnailUrl is present", () => {
    mockFormatRelativeDate.mockReturnValue("1d ago");
    const item = makeMockFeedItem({
      title: "Video Post",
      thumbnailUrl: "/api/content/1/thumbnail",
    });

    render(<ContentCard item={item} />);

    const img = screen.getByRole("img", { name: "Video Post" });
    expect(img).toHaveAttribute(
      "src",
      "http://localhost:3000/api/content/1/thumbnail",
    );
  });

  it("falls back to coverArtUrl for audio items without thumbnailUrl", () => {
    mockFormatRelativeDate.mockReturnValue("1d ago");
    const item = makeMockFeedItem({
      title: "Audio Track",
      type: "audio",
      thumbnailUrl: null,
      coverArtUrl: "/api/content/1/cover-art",
    });

    render(<ContentCard item={item} />);

    const img = screen.getByRole("img", { name: "Audio Track" });
    expect(img).toHaveAttribute(
      "src",
      "http://localhost:3000/api/content/1/cover-art",
    );
  });

  it("links to the content detail page", () => {
    mockFormatRelativeDate.mockReturnValue("1d ago");
    const item = makeMockFeedItem({ id: "content-42" });

    render(<ContentCard item={item} />);

    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "/content/content-42");
  });
});
