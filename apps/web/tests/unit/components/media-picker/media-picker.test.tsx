import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useEffect } from "react";

import type { ContentAsset, PressImageCrop } from "@snc/shared";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { MediaPicker } from "../../../../src/components/media-picker/media-picker.js";

const { mockFetchImages, mockUploadImage } = vi.hoisted(() => ({
  mockFetchImages: vi.fn(),
  mockUploadImage: vi.fn(),
}));

vi.mock("../../../../src/lib/content-library.js", () => ({
  fetchContentLibraryImages: mockFetchImages,
  contentLibraryThumbnailUrl: (key: string) => `/raw/${key}`,
}));

vi.mock("../../../../src/components/media-picker/media-picker-upload.js", () => ({
  uploadMediaPickerImage: mockUploadImage,
}));

vi.mock("../../../../src/components/media-picker/media-picker-crop.js", () => ({
  MediaPickerCrop: ({ assetId, onCropChange, onReadyChange }: {
    assetId: string;
    onCropChange: (assetId: string, crop: PressImageCrop | null) => void;
    onReadyChange: (assetId: string, ready: boolean) => void;
  }) => {
    useEffect(() => {
      onCropChange(assetId, null);
      onReadyChange(assetId, false);
    }, [assetId, onCropChange, onReadyChange]);
    return (
      <section aria-label="Crop mock">
        <button
          type="button"
          onClick={() => {
            onCropChange(assetId, { x: 0.1, y: 0.2, width: 0.8, height: 0.6 });
            onReadyChange(assetId, true);
          }}
        >
          Complete crop
        </button>
      </section>
    );
  },
}));

const key = (character: string, extension = "jpg"): string =>
  `library/${character.repeat(2)}/${character.repeat(64)}.${extension}`;

const makeAsset = (overrides: Partial<ContentAsset> = {}): ContentAsset => ({
  id: "00000000-0000-4000-a000-000000000001",
  creatorId: "creator-1",
  blobSha256: "a".repeat(64),
  sharing: "private",
  originalFilename: "own.jpg",
  createdAt: "2026-08-09T00:00:00.000Z",
  storageKey: key("a"),
  mimeType: "image/jpeg",
  size: 100,
  width: 2400,
  height: 1600,
  canUse: true,
  useStatus: "own",
  ...overrides,
});

const target = {
  mediaType: "image" as const,
  slot: "banner" as const,
  surfaceLabel: "Profile",
  slotLabel: "Banner",
};

const renderPicker = (props: Partial<React.ComponentProps<typeof MediaPicker>> = {}) => {
  const onInsert = vi.fn();
  const onClose = vi.fn();
  render(
    <MediaPicker
      open
      creatorId="creator-1"
      creatorName="Animal Future"
      target={target}
      onInsert={onInsert}
      onClose={onClose}
      {...props}
    />,
  );
  return { onInsert, onClose };
};

beforeEach(() => {
  vi.clearAllMocks();
  mockFetchImages.mockResolvedValue({ items: [makeAsset()], nextCursor: null });
});

describe("MediaPicker", () => {
  it("renders an Ark modal workbench with real image-source tabs", async () => {
    const user = userEvent.setup();
    const { onClose } = renderPicker();

    expect(await screen.findByRole("dialog", { name: "Choose image" })).toBeVisible();
    expect(screen.getByText("Profile · Banner slot · fixed 3:1")).toBeVisible();
    expect(screen.getByRole("tablist", { name: "Image sources" })).toBeVisible();
    expect(screen.getByRole("tab", { name: /My library/ })).toHaveAttribute("aria-selected", "true");

    await user.click(screen.getByRole("tab", { name: /Shared pool/ }));
    expect(screen.getByRole("tabpanel", { name: /Shared pool/ })).toBeVisible();
    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("keeps crop, metadata, readiness, and insertion atomic to the current asset", async () => {
    const user = userEvent.setup();
    const second = makeAsset({
      id: "00000000-0000-4000-a000-000000000002",
      blobSha256: "b".repeat(64),
      storageKey: key("b"),
      originalFilename: "second.jpg",
    });
    mockFetchImages.mockResolvedValue({ items: [makeAsset(), second], nextCursor: null });
    const { onInsert } = renderPicker();

    await user.click(await screen.findByRole("button", { name: "Choose own.jpg" }));
    const insert = screen.getByRole("button", { name: "Insert into banner" });
    expect(insert).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Complete crop" }));
    await user.type(screen.getByLabelText(/Alternative text/), "First description");
    expect(insert).toBeEnabled();

    await user.click(screen.getByRole("button", { name: "Choose second.jpg" }));
    expect(screen.getByLabelText(/Alternative text/)).toHaveValue("");
    expect(insert).toBeDisabled();
    expect(screen.getByText("Crop output is preparing · Alt text required")).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Complete crop" }));
    await user.type(screen.getByLabelText(/Alternative text/), "Second description");
    await user.type(screen.getByLabelText(/Photo credit/), "  Photographer  ");
    await user.click(insert);

    expect(onInsert).toHaveBeenCalledWith({
      key: key("b"),
      crop: { x: 0.1, y: 0.2, width: 0.8, height: 0.6 },
      alt: "Second description",
      credit: "Photographer",
    });
  });

  it("lets users inspect a blocked shared asset without exposing crop or a request workflow", async () => {
    const user = userEvent.setup();
    const blocked = makeAsset({
      id: "00000000-0000-4000-a000-000000000003",
      creatorId: "creator-2",
      blobSha256: "c".repeat(64),
      storageKey: key("c"),
      originalFilename: "permission.jpg",
      sharing: "requestable",
      canUse: false,
      useStatus: "requestable-needs-grant",
    });
    mockFetchImages.mockResolvedValue({ items: [blocked], nextCursor: null });
    renderPicker();

    await user.click(await screen.findByRole("tab", { name: /Shared pool/ }));
    await user.click(screen.getByRole("button", { name: "Inspect unavailable permission.jpg" }));

    expect(screen.getByText("Not available", { selector: "b" })).toBeVisible();
    expect(screen.getByText(/needs the owner's permission/, { selector: "small" })).toBeVisible();
    expect(screen.queryByLabelText(/Alternative text/)).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /request/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Insert into banner" })).toBeDisabled();
  });

  it("shows distinct empty and paginated source states", async () => {
    const user = userEvent.setup();
    const shared = makeAsset({
      id: "00000000-0000-4000-a000-000000000004",
      creatorId: "creator-2",
      blobSha256: "d".repeat(64),
      storageKey: key("d"),
      originalFilename: "shared.jpg",
      sharing: "open",
      useStatus: "open",
    });
    mockFetchImages
      .mockResolvedValueOnce({ items: [shared], nextCursor: "next-page" })
      .mockResolvedValueOnce({ items: [makeAsset()], nextCursor: null });
    renderPicker();

    expect(await screen.findByText("No own images loaded yet")).toBeVisible();
    expect(screen.getByRole("button", { name: "Load more" })).toBeVisible();
    await user.click(screen.getByRole("tab", { name: /Shared pool/ }));
    const panel = screen.getByRole("tabpanel", { name: /Shared pool/ });
    expect(within(panel).getByRole("button", { name: "Choose shared.jpg" })).toBeVisible();
    await user.click(within(panel).getByRole("button", { name: "Load more" }));
    await waitFor(() => expect(mockFetchImages).toHaveBeenLastCalledWith("creator-1", "next-page", undefined));
  });

  it("validates uploads, reports progress, and opens a successful upload in crop", async () => {
    const user = userEvent.setup();
    const uploaded = makeAsset({
      id: "00000000-0000-4000-a000-000000000005",
      blobSha256: "e".repeat(64),
      storageKey: key("e", "png"),
      originalFilename: "new.png",
      mimeType: "image/png",
    });
    mockUploadImage.mockImplementation(async (_creatorId: string, _file: File, options: { onProgress: (value: number) => void }) => {
      options.onProgress(46);
      return { ...uploaded, deduped: false };
    });
    renderPicker();

    await user.click(await screen.findByRole("tab", { name: /Upload new/ }));
    fireEvent.change(screen.getByLabelText("Choose file"), {
      target: { files: [new File(["bytes"], "notes.txt", { type: "text/plain" })] },
    });
    expect(screen.getByRole("alert")).toHaveTextContent("Choose a JPEG, PNG, or WebP image");

    fireEvent.change(screen.getByLabelText("Choose file"), {
      target: { files: [new File(["png"], "new.png", { type: "image/png" })] },
    });
    expect(await screen.findByLabelText(/Alternative text/)).toHaveValue("");
    expect(screen.getAllByText("new.png", { selector: "strong" })).toHaveLength(2);
    expect(screen.getByRole("button", { name: "Insert into banner" })).toBeDisabled();
    expect(mockUploadImage).toHaveBeenCalledWith(
      "creator-1",
      expect.objectContaining({ name: "new.png" }),
      expect.objectContaining({ signal: expect.any(AbortSignal), onProgress: expect.any(Function) }),
    );
  });
});
