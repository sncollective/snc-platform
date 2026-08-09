import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { beforeEach, describe, expect, it, vi } from "vitest";

import { MediaPickerCrop } from "../../../../src/components/media-picker/media-picker-crop.js";

const { mockPreview } = vi.hoisted(() => ({ mockPreview: vi.fn() }));

vi.mock("../../../../src/lib/press-images.js", () => ({
  contentLibraryRawUrl: (key: string) => `/raw/${key}`,
  requestPressImagePreview: mockPreview,
}));

const imageKey = `library/aa/${"a".repeat(64)}.jpg`;

beforeEach(() => {
  vi.clearAllMocks();
  mockPreview.mockResolvedValue({ src: "/preview.jpg", srcSet: "", sizes: "" });
});

describe("MediaPickerCrop", () => {
  it("supports keyboard pan, zoom controls, reset, and a slot-aspect rendered preview", async () => {
    const user = userEvent.setup();
    const onCropChange = vi.fn();
    const onReadyChange = vi.fn();
    render(
      <MediaPickerCrop
        assetId="asset-1"
        creatorId="creator-1"
        imageKey={imageKey}
        sourceWidth={2400}
        sourceHeight={1600}
        slot="banner"
        slotLabel="Banner"
        outputWidth={1800}
        outputHeight={600}
        onCropChange={onCropChange}
        onReadyChange={onReadyChange}
        announce={vi.fn()}
      />,
    );

    const viewport = screen.getByRole("application", { name: /Banner crop viewport/ });
    expect(viewport).toHaveStyle({ aspectRatio: "3 / 1" });
    expect(screen.getByText(/Drag to pan/)).toBeVisible();

    await waitFor(() => expect(mockPreview).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(onReadyChange).toHaveBeenLastCalledWith("asset-1", true));
    expect(within(screen.getByLabelText("Banner rendered output preview")).getByRole("presentation")).toHaveAttribute("src", "/preview.jpg");

    await user.click(screen.getByRole("button", { name: "Zoom in" }));
    expect(screen.getByText(/1\.10×/)).toBeVisible();
    await waitFor(() => expect(mockPreview.mock.calls.length).toBeGreaterThan(1));
    const zoomedCrop = mockPreview.mock.calls.at(-1)![0].crop;

    viewport.focus();
    await user.keyboard("{ArrowRight}");
    await waitFor(() => expect(mockPreview.mock.calls.length).toBeGreaterThan(2));
    expect(mockPreview.mock.calls.at(-1)![0].crop.x).toBeGreaterThan(zoomedCrop.x);

    await user.click(screen.getByRole("button", { name: "Reset" }));
    expect(screen.getByText("1.00× · centered")).toBeVisible();
  });
});
