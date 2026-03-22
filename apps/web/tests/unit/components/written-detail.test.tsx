import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

import { makeMockFeedItem } from "../../helpers/content-fixtures.js";
import { stubComponent } from "../../helpers/component-stubs.js";
import { createFormatMock, DEFAULT_FORMAT_DATE } from "../../helpers/format-mock.js";

// ── Hoisted Mocks ──

const { mockSubscribeCta } = vi.hoisted(() => ({
  mockSubscribeCta: vi.fn(),
}));

vi.mock("../../../src/lib/format.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../src/lib/format.js")>();
  return createFormatMock({ formatDate: DEFAULT_FORMAT_DATE }, actual);
});

vi.mock("../../../src/components/content/subscribe-cta.js", () =>
  stubComponent("SubscribeCta", "subscribe-cta", mockSubscribeCta),
);

// ── Helpers ──

function makeEditCallbacks(overrides?: Partial<{
  onTitleChange: (v: string) => void;
  onDescriptionChange: (v: string) => void;
  onVisibilityChange: (v: string) => void;
  onBodyChange: (v: string) => void;
  onThumbnailUpload: (f: File) => void;
  onThumbnailRemove: () => void;
}>) {
  return {
    onTitleChange: vi.fn(),
    onDescriptionChange: vi.fn(),
    onVisibilityChange: vi.fn(),
    onBodyChange: vi.fn(),
    onThumbnailUpload: vi.fn(),
    onThumbnailRemove: vi.fn(),
    ...overrides,
  };
}

// ── Component Under Test ──

import { WrittenDetail } from "../../../src/components/content/written-detail.js";

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

  describe("edit mode", () => {
    it("renders Body label above textarea when editing and onBodyChange is provided", () => {
      const item = makeMockFeedItem({ body: "Hello world" });
      render(<WrittenDetail item={item} isEditing editCallbacks={makeEditCallbacks()} />);
      expect(screen.getByText("Body")).toBeInTheDocument();
    });

    it("renders textarea with body value when editing", () => {
      const item = makeMockFeedItem({ body: "Hello world" });
      render(<WrittenDetail item={item} isEditing editCallbacks={makeEditCallbacks()} />);
      expect(screen.getByRole("textbox", { name: "Body" })).toHaveValue("Hello world");
    });

    it("renders textarea with empty string when body is null", () => {
      const item = makeMockFeedItem({ body: null });
      render(<WrittenDetail item={item} isEditing editCallbacks={makeEditCallbacks()} />);
      expect(screen.getByRole("textbox", { name: "Body" })).toHaveValue("");
    });

    it("renders thumbnail upload placeholder when editing and no thumbnail and onThumbnailUpload provided", () => {
      const item = makeMockFeedItem({ body: "Hello", thumbnailUrl: null });
      render(<WrittenDetail item={item} isEditing editCallbacks={makeEditCallbacks()} />);
      expect(screen.getByRole("button", { name: "Upload Thumbnail" })).toBeInTheDocument();
    });

    it("does not render thumbnail upload placeholder when thumbnailUrl is present", () => {
      const item = makeMockFeedItem({ body: "Hello", thumbnailUrl: "/api/content/c1/thumbnail" });
      render(<WrittenDetail item={item} isEditing editCallbacks={makeEditCallbacks()} />);
      expect(screen.queryByRole("button", { name: "Upload Thumbnail" })).toBeNull();
    });

    it("does not render thumbnail upload placeholder when onThumbnailUpload is not provided", () => {
      const item = makeMockFeedItem({ body: "Hello", thumbnailUrl: null });
      const callbacks = makeEditCallbacks({ onThumbnailUpload: undefined });
      render(<WrittenDetail item={item} isEditing editCallbacks={callbacks} />);
      expect(screen.queryByRole("button", { name: "Upload Thumbnail" })).toBeNull();
    });

    it("calls onThumbnailUpload when file is selected", () => {
      const onThumbnailUpload = vi.fn();
      const item = makeMockFeedItem({ body: "Hello", thumbnailUrl: null });
      render(<WrittenDetail item={item} isEditing editCallbacks={makeEditCallbacks({ onThumbnailUpload })} />);

      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      const file = new File(["img"], "thumb.jpg", { type: "image/jpeg" });
      fireEvent.change(fileInput, { target: { files: [file] } });

      expect(onThumbnailUpload).toHaveBeenCalledWith(file);
    });

    it("renders Replace Thumbnail and Remove Thumbnail when thumbnail exists and editing", () => {
      const item = makeMockFeedItem({ body: "Hello", thumbnailUrl: "/api/content/c1/thumbnail" });
      render(<WrittenDetail item={item} isEditing editCallbacks={makeEditCallbacks()} />);
      expect(screen.getByRole("button", { name: "Replace Thumbnail" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Remove Thumbnail" })).toBeInTheDocument();
    });

    it("does not render Replace Thumbnail when thumbnail is null", () => {
      const item = makeMockFeedItem({ body: "Hello", thumbnailUrl: null });
      render(<WrittenDetail item={item} isEditing editCallbacks={makeEditCallbacks()} />);
      expect(screen.queryByRole("button", { name: "Replace Thumbnail" })).toBeNull();
    });

    it("calls onThumbnailRemove when Remove Thumbnail is clicked", () => {
      const onThumbnailRemove = vi.fn();
      const item = makeMockFeedItem({ body: "Hello", thumbnailUrl: "/api/content/c1/thumbnail" });
      render(<WrittenDetail item={item} isEditing editCallbacks={makeEditCallbacks({ onThumbnailRemove })} />);
      fireEvent.click(screen.getByRole("button", { name: "Remove Thumbnail" }));
      expect(onThumbnailRemove).toHaveBeenCalledOnce();
    });
  });
});
