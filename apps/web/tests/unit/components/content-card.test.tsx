import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

import { createRouterMock } from "../../helpers/router-mock.js";
import { createFormatMock } from "../../helpers/format-mock.js";

// ── Hoisted Mocks ──

const { mockFormatRelativeDate } = vi.hoisted(() => ({
  mockFormatRelativeDate: vi.fn(),
}));

vi.mock("@tanstack/react-router", () => createRouterMock());

vi.mock("../../../src/lib/format.js", () =>
  createFormatMock({ formatRelativeDate: mockFormatRelativeDate }),
);

// ── Import component under test (after mocks) ──

import { ContentCard } from "../../../src/components/content/content-card.js";
import { makeMockFeedItem } from "../../helpers/content-fixtures.js";

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

  it("renders lock icon when visibility is 'subscribers' and content is gated", () => {
    mockFormatRelativeDate.mockReturnValue("1d ago");
    const item = makeMockFeedItem({
      visibility: "subscribers",
      mediaUrl: null,
      body: null,
    });

    render(<ContentCard item={item} />);

    expect(screen.getByLabelText("Subscribers only")).toBeInTheDocument();
  });

  it("does not render lock icon when visibility is 'public'", () => {
    mockFormatRelativeDate.mockReturnValue("1d ago");
    const item = makeMockFeedItem({ visibility: "public" });

    render(<ContentCard item={item} />);

    expect(screen.queryByLabelText("Subscribers only")).toBeNull();
  });

  it("does not render lock icon when subscriber content has mediaUrl (user has access)", () => {
    mockFormatRelativeDate.mockReturnValue("1d ago");
    const item = makeMockFeedItem({
      visibility: "subscribers",
      mediaUrl: "/api/content/1/media",
      body: null,
    });

    render(<ContentCard item={item} />);

    expect(screen.queryByLabelText("Subscribers only")).toBeNull();
  });

  it("does not render lock icon when subscriber written content has body (user has access)", () => {
    mockFormatRelativeDate.mockReturnValue("1d ago");
    const item = makeMockFeedItem({
      visibility: "subscribers",
      mediaUrl: null,
      body: "Full article text",
    });

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
      "/api/content/1/thumbnail",
    );
  });

  it("shows no image for audio items without thumbnailUrl", () => {
    mockFormatRelativeDate.mockReturnValue("1d ago");
    const item = makeMockFeedItem({
      title: "Audio Track",
      type: "audio",
      thumbnailUrl: null,
    });

    const { container } = render(<ContentCard item={item} />);

    expect(container.querySelector("img")).toBeNull();
  });

  it("links to slug URL when slug and creatorHandle are present", () => {
    mockFormatRelativeDate.mockReturnValue("1d ago");
    const item = makeMockFeedItem({
      id: "content-42",
      slug: "my-post",
      creatorHandle: "alice",
    });

    render(<ContentCard item={item} />);

    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "/content/alice/my-post?edit=false");
  });

  it("falls back to UUID URL when slug is null", () => {
    mockFormatRelativeDate.mockReturnValue("1d ago");
    const item = makeMockFeedItem({ id: "content-42", slug: null, creatorHandle: "alice" });

    render(<ContentCard item={item} />);

    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "/content/content-42?edit=false");
  });

  it("falls back to UUID URL when creatorHandle is null", () => {
    mockFormatRelativeDate.mockReturnValue("1d ago");
    const item = makeMockFeedItem({ id: "content-42", slug: "my-post", creatorHandle: null });

    render(<ContentCard item={item} />);

    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "/content/content-42?edit=false");
  });

  it("renders thumbnailWrapper when thumbnailUrl is present", () => {
    mockFormatRelativeDate.mockReturnValue("1d ago");
    const item = makeMockFeedItem({
      title: "Has Thumbnail",
      thumbnailUrl: "/api/content/1/thumbnail",
    });

    const { container } = render(<ContentCard item={item} />);

    expect(container.querySelector("img")).not.toBeNull();
  });

  it("does not render img when no thumbnail", () => {
    mockFormatRelativeDate.mockReturnValue("1d ago");
    const item = makeMockFeedItem({
      title: "No Thumbnail",
      type: "written",
      thumbnailUrl: null,
    });

    const { container } = render(<ContentCard item={item} />);

    expect(container.querySelector("img")).toBeNull();
    expect(screen.getByText("POST")).toBeInTheDocument();
  });

  it("renders type badge in no-thumbnail card", () => {
    mockFormatRelativeDate.mockReturnValue("1d ago");
    const item = makeMockFeedItem({
      type: "written",
      thumbnailUrl: null,
    });

    render(<ContentCard item={item} />);

    expect(screen.getByText("POST")).toBeInTheDocument();
  });
});
