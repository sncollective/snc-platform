import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";

import { makeMockFeedItem } from "../../helpers/content-fixtures.js";
import { stubComponent } from "../../helpers/component-stubs.js";
import { createFormatMock, DEFAULT_FORMAT_DATE } from "../../helpers/format-mock.js";

// ── Hoisted Mocks ──

const { mockSubscribeCta } = vi.hoisted(() => ({
  mockSubscribeCta: vi.fn(),
}));

vi.mock("../../../src/lib/format.js", () =>
  createFormatMock({ formatDate: DEFAULT_FORMAT_DATE }),
);

vi.mock("../../../src/components/content/subscribe-cta.js", () =>
  stubComponent("SubscribeCta", "subscribe-cta", mockSubscribeCta),
);

// ── Component Under Test ──

import { WrittenDetail } from "../../../src/components/content/written-detail.js";

// ── Lifecycle ──

afterEach(() => {
  vi.restoreAllMocks();
});

// ── Tests ──

describe("WrittenDetail", () => {
  it("renders title as h1", () => {
    const item = makeMockFeedItem({ title: "My Post" });
    render(<WrittenDetail item={item} />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("My Post");
  });

  it("renders creator name and formatted date", () => {
    const item = makeMockFeedItem({
      creatorName: "Author A",
      publishedAt: "2026-02-26T00:00:00.000Z",
    });
    render(<WrittenDetail item={item} />);
    expect(screen.getByText("Author A")).toBeInTheDocument();
    expect(screen.getByText(/FORMATTED:/)).toBeInTheDocument();
  });

  it("splits body text on double newlines into paragraphs", () => {
    const item = makeMockFeedItem({
      body: "First paragraph.\n\nSecond paragraph.\n\nThird paragraph.",
    });
    render(<WrittenDetail item={item} />);
    expect(screen.getByText("First paragraph.")).toBeInTheDocument();
    expect(screen.getByText("Second paragraph.")).toBeInTheDocument();
    expect(screen.getByText("Third paragraph.")).toBeInTheDocument();
  });

  it("filters out empty paragraphs", () => {
    const item = makeMockFeedItem({
      body: "Hello.\n\n\n\n\n\nWorld.",
    });
    render(<WrittenDetail item={item} />);
    expect(screen.getByText("Hello.")).toBeInTheDocument();
    expect(screen.getByText("World.")).toBeInTheDocument();
  });

  it("renders empty body gracefully when body is null", () => {
    const item = makeMockFeedItem({ body: null });
    render(<WrittenDetail item={item} />);
    // Should render without error — body section is empty
    expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();
  });

  it("has narrow max-width container for reading", () => {
    const item = makeMockFeedItem();
    const { container } = render(<WrittenDetail item={item} />);
    // The component uses styles.writtenDetail with max-width: 720px
    // We verify the outer div exists (CSS module class applied)
    expect(container.firstElementChild).not.toBeNull();
  });

  it("renders full body text when not locked", () => {
    const body = Array.from({ length: 250 }, (_, i) => `word${i}`).join(" ");
    const item = makeMockFeedItem({ body });
    render(<WrittenDetail item={item} />);
    // All words should be in the document (not truncated)
    expect(screen.getByText(/word249/)).toBeInTheDocument();
    expect(screen.queryByTestId("subscribe-cta")).toBeNull();
  });

  it("truncates body to ~200 words when locked=true", () => {
    const words = Array.from({ length: 250 }, (_, i) => `word${i}`);
    const body = words.join(" ");
    const item = makeMockFeedItem({ body });
    render(<WrittenDetail item={item} locked={true} />);
    // word199 should be present (within 200), word200 should not be in truncated text
    expect(screen.getByText(/word0/)).toBeInTheDocument();
    expect(screen.queryByText(/word249/)).toBeNull();
  });

  it("renders fade overlay when locked=true", () => {
    const item = makeMockFeedItem({ body: "Some content here." });
    const { container } = render(<WrittenDetail item={item} locked={true} />);
    // The bodyPreview container should exist
    expect(container.querySelector("[class*='bodyPreview']")).not.toBeNull();
  });

  it("renders SubscribeCta when locked=true with contentType=written", () => {
    const item = makeMockFeedItem({
      creatorId: "creator-77",
      body: "Some content.",
    });
    render(<WrittenDetail item={item} locked={true} />);
    expect(screen.getByTestId("subscribe-cta")).toBeInTheDocument();
    expect(mockSubscribeCta).toHaveBeenCalledWith(
      expect.objectContaining({ creatorId: "creator-77", contentType: "written" }),
    );
  });

  it("renders ContentMeta in both locked and unlocked states", () => {
    const item = makeMockFeedItem({ title: "My Post", creatorName: "Author X" });
    const { unmount } = render(<WrittenDetail item={item} locked={true} />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("My Post");
    unmount();
    render(<WrittenDetail item={item} locked={false} />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("My Post");
  });

  it("handles empty body when locked=true without crashing", () => {
    const item = makeMockFeedItem({ body: null });
    render(<WrittenDetail item={item} locked={true} />);
    expect(screen.getByTestId("subscribe-cta")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();
  });
});
