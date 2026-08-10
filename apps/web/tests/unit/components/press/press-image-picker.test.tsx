import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { PressImagePicker } from "../../../../src/components/press/press-image-picker.js";

const { mockFetchImages, mockUploadImage } = vi.hoisted(() => ({
  mockFetchImages: vi.fn(),
  mockUploadImage: vi.fn(),
}));

vi.mock("../../../../src/lib/content-library.js", () => ({
  fetchContentLibraryImages: mockFetchImages,
  uploadContentLibraryImage: mockUploadImage,
  contentLibraryThumbnailUrl: (key: string) => `/raw/${key}`,
}));

vi.mock("../../../../src/components/press/press-crop-editor.js", () => ({
  PressCropEditor: ({ slot, onApply, onCancel }: {
    slot: string;
    onApply: (crop: { x: number; y: number; width: number; height: number }) => void;
    onCancel: () => void;
  }) => (
    <div role="dialog" aria-label={`${slot} crop mock`}>
      <button type="button" onClick={() => onApply({ x: 0.1, y: 0.2, width: 0.8, height: 0.6 })}>Confirm crop</button>
      <button type="button" onClick={onCancel}>Cancel crop</button>
    </div>
  ),
}));

const asset = (overrides: Record<string, unknown> = {}) => ({
  id: "00000000-0000-4000-a000-000000000001",
  creatorId: "creator-1",
  blobSha256: "a".repeat(64),
  sharing: "private",
  originalFilename: "own.jpg",
  createdAt: "2026-08-08T00:00:00.000Z",
  storageKey: `library/aa/${"a".repeat(64)}.jpg`,
  mimeType: "image/jpeg",
  size: 100,
  width: 1600,
  height: 1200,
  canUse: true,
  useStatus: "own",
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
  mockFetchImages.mockResolvedValue({ items: [asset()], nextCursor: null });
});

describe("PressImagePicker", () => {
  it("selects an own asset, requires alt, and applies per-reference credit and crop", async () => {
    const user = userEvent.setup();
    const onApply = vi.fn();
    render(
      <PressImagePicker creatorId="creator-1" slot="gallery" onApply={onApply} onCancel={vi.fn()} />,
    );

    await user.click(await screen.findByRole("button", { name: "Use own.jpg" }));
    expect(screen.getByRole("dialog", { name: "gallery crop mock" })).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Confirm crop" }));
    await user.click(screen.getByRole("button", { name: "Apply image" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Alternative text is required");

    await user.type(screen.getByLabelText(/Alternative text/), "  Live at the venue  ");
    await user.type(screen.getByLabelText("Photo credit (optional)"), "  Alex Photo  ");
    await user.click(screen.getByRole("button", { name: "Apply image" }));

    expect(onApply).toHaveBeenCalledWith({
      key: `library/aa/${"a".repeat(64)}.jpg`,
      alt: "Live at the venue",
      credit: "Alex Photo",
      crop: { x: 0.1, y: 0.2, width: 0.8, height: 0.6 },
    });
  });

  it("shows shared use status and disables requestable assets without grants", async () => {
    const user = userEvent.setup();
    mockFetchImages.mockResolvedValue({
      items: [
        asset({
          id: "00000000-0000-4000-a000-000000000002",
          creatorId: "creator-2",
          originalFilename: "open.jpg",
          sharing: "open",
          useStatus: "open",
        }),
        asset({
          id: "00000000-0000-4000-a000-000000000003",
          creatorId: "creator-3",
          originalFilename: "granted.jpg",
          sharing: "requestable",
          useStatus: "granted",
        }),
        asset({
          id: "00000000-0000-4000-a000-000000000004",
          creatorId: "creator-4",
          originalFilename: "requestable.jpg",
          sharing: "requestable",
          canUse: false,
          useStatus: "requestable-needs-grant",
        }),
      ],
      nextCursor: null,
    });
    render(
      <PressImagePicker creatorId="creator-1" slot="banner" onApply={vi.fn()} onCancel={vi.fn()} />,
    );

    await user.click(await screen.findByRole("tab", { name: "Shared pool" }));
    expect(screen.getByRole("button", { name: "Use open.jpg" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Use granted.jpg" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Cannot use requestable.jpg" })).toBeDisabled();
    expect(screen.getByText("Access requests are not available yet.")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Request access in library" })).not.toBeInTheDocument();
  });

  it("places foreign admin-visible assets in the shared pool", async () => {
    const user = userEvent.setup();
    mockFetchImages.mockResolvedValue({
      items: [
        asset(),
        asset({
          id: "00000000-0000-4000-a000-000000000006",
          creatorId: "creator-2",
          originalFilename: "admin-visible.jpg",
          useStatus: "admin",
        }),
      ],
      nextCursor: null,
    });
    render(
      <PressImagePicker creatorId="creator-1" slot="gallery" onApply={vi.fn()} onCancel={vi.fn()} />,
    );

    expect(await screen.findByRole("button", { name: "Use own.jpg" })).toBeVisible();
    expect(screen.queryByRole("button", { name: "Use admin-visible.jpg" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("tab", { name: "Shared pool" }));
    expect(screen.getByRole("button", { name: "Use admin-visible.jpg" })).toBeEnabled();
  });

  it("uploads to the library and uses the returned storage key", async () => {
    const user = userEvent.setup();
    const uploaded = asset({
      storageKey: `library/bb/${"b".repeat(64)}.png`,
      originalFilename: "new.png",
      mimeType: "image/png",
      deduped: false,
    });
    mockUploadImage.mockResolvedValue(uploaded);
    const onApply = vi.fn();
    render(
      <PressImagePicker creatorId="creator-1" slot="cover" onApply={onApply} onCancel={vi.fn()} />,
    );

    await user.upload(screen.getByLabelText("Upload new image"), new File(["bytes"], "new.png", { type: "image/png" }));
    await user.click(await screen.findByRole("button", { name: "Confirm crop" }));
    await user.type(screen.getByLabelText(/Alternative text/), "Cover art");
    await user.click(screen.getByRole("button", { name: "Apply image" }));

    expect(mockUploadImage).toHaveBeenCalledWith("creator-1", expect.objectContaining({ name: "new.png" }));
    expect(onApply.mock.calls[0]![0].key).toBe(`library/bb/${"b".repeat(64)}.png`);
    expect(onApply.mock.calls[0]![0].key).not.toContain("/press/");
  });

  it("recovers from load errors and paginates without duplicating assets", async () => {
    const user = userEvent.setup();
    mockFetchImages
      .mockRejectedValueOnce(new Error("Library offline"))
      .mockResolvedValueOnce({ items: [asset()], nextCursor: "cursor-2" })
      .mockResolvedValueOnce({
        items: [asset(), asset({
          id: "00000000-0000-4000-a000-000000000005",
          originalFilename: "second.jpg",
        })],
        nextCursor: null,
      });
    render(
      <PressImagePicker creatorId="creator-1" slot="about" onApply={vi.fn()} onCancel={vi.fn()} />,
    );

    expect(await screen.findByRole("alert")).toHaveTextContent("Library offline");
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByRole("button", { name: "Use own.jpg" })).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Load more" }));
    expect(await screen.findByRole("button", { name: "Use second.jpg" })).toBeVisible();
    expect(screen.getAllByRole("button", { name: "Use own.jpg" })).toHaveLength(1);
    expect(mockFetchImages).toHaveBeenLastCalledWith("creator-1", "cursor-2", undefined);
  });
});
