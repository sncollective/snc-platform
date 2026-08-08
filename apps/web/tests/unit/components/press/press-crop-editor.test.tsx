import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { fitSlotCrop } from "../../../../src/lib/press-image-crop.js";
import { PressCropEditor } from "../../../../src/components/press/press-crop-editor.js";

const { mockRequestPreview } = vi.hoisted(() => ({
  mockRequestPreview: vi.fn(),
}));

vi.mock("../../../../src/lib/press-images.js", async () => {
  const actual = await vi.importActual<typeof import("../../../../src/lib/press-images.js")>(
    "../../../../src/lib/press-images.js",
  );
  return { ...actual, requestPressImagePreview: mockRequestPreview };
});

const key = `library/aa/${"a".repeat(64)}.jpg`;
const descriptor = (src: string) => ({ src, srcSet: `${src} 960w`, sizes: "100vw" });

const baseProps = {
  creatorId: "creator-1",
  imageKey: key,
  sourceWidth: 2400,
  sourceHeight: 1600,
  slot: "gallery" as const,
  slotLabel: "Gallery image",
  onApply: vi.fn(),
  onCancel: vi.fn(),
};

beforeEach(() => {
  vi.clearAllMocks();
  mockRequestPreview.mockResolvedValue(descriptor("https://images.example/initial"));
});

describe("PressCropEditor", () => {
  const waitForCurrentPreview = async (): Promise<void> => {
    await waitFor(() => expect(screen.getByRole("button", { name: "Apply crop" })).toBeEnabled());
  };

  it("supports keyboard nudge, zoom, reset, and normalized Apply", async () => {
    const user = userEvent.setup();
    const onApply = vi.fn();
    render(<PressCropEditor {...baseProps} onApply={onApply} />);

    await waitForCurrentPreview();
    const viewport = screen.getByRole("application", { name: "Gallery image crop viewport" });
    viewport.focus();
    await user.keyboard("{ArrowRight}+");
    expect(screen.getByRole("button", { name: "Apply crop" })).toBeDisabled();
    await waitForCurrentPreview();
    await user.click(screen.getByRole("button", { name: "Apply crop" }));

    expect(onApply).toHaveBeenCalledTimes(1);
    const moved = onApply.mock.calls[0]![0];
    expect(moved.x).toBeGreaterThan(fitSlotCrop({ width: 2400, height: 1600 }, "gallery").x);
    expect(moved.x + moved.width).toBeLessThanOrEqual(1);

    await user.click(screen.getByRole("button", { name: "Reset" }));
    await waitForCurrentPreview();
    await user.click(screen.getByRole("button", { name: "Apply crop" }));
    expect(onApply.mock.calls[1]![0]).toEqual(
      fitSlotCrop({ width: 2400, height: 1600 }, "gallery"),
    );
  });

  it("restores a prior crop and Cancel emits no crop", async () => {
    const user = userEvent.setup();
    const onApply = vi.fn();
    const onCancel = vi.fn();
    const initialCrop = {
      x: 0.2,
      y: 0.25,
      width: 0.4,
      height: 0.6,
    };
    render(
      <PressCropEditor
        {...baseProps}
        slot="member"
        initialCrop={initialCrop}
        onApply={onApply}
        onCancel={onCancel}
      />,
    );

    await waitForCurrentPreview();
    await user.click(screen.getByRole("button", { name: "Apply crop" }));
    expect(onApply).toHaveBeenCalledWith(initialCrop);
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onApply).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["banner", 1920],
    ["about", 720],
    ["member", 480],
    ["gallery", 960],
    ["cover", 480],
  ] as const)("requests the %s slot's eventual delivery width", async (slot, width) => {
    render(<PressCropEditor {...baseProps} slot={slot} />);

    await waitFor(() => expect(mockRequestPreview).toHaveBeenCalled());
    expect(mockRequestPreview).toHaveBeenLastCalledWith(expect.objectContaining({ slot, width }));
  });

  it("sends the exact latest crop to the signed-preview endpoint", async () => {
    const user = userEvent.setup();
    render(<PressCropEditor {...baseProps} />);

    await waitFor(() => expect(mockRequestPreview).toHaveBeenCalledTimes(1));
    const viewport = screen.getByRole("application", { name: "Gallery image crop viewport" });
    viewport.focus();
    await user.keyboard("{ArrowLeft}");

    await waitFor(() => expect(mockRequestPreview).toHaveBeenCalledTimes(2));
    const latest = mockRequestPreview.mock.calls[1]![0];
    expect(latest).toMatchObject({
      creatorId: "creator-1",
      key,
      slot: "gallery",
      width: 960,
    });
    expect(latest.crop.x).toBeLessThan(mockRequestPreview.mock.calls[0]![0].crop.x);
  });

  it("ignores a stale signed-preview response", async () => {
    let resolveFirst!: (value: ReturnType<typeof descriptor>) => void;
    let resolveSecond!: (value: ReturnType<typeof descriptor>) => void;
    mockRequestPreview
      .mockReturnValueOnce(new Promise((resolve) => { resolveFirst = resolve; }))
      .mockReturnValueOnce(new Promise((resolve) => { resolveSecond = resolve; }));
    const user = userEvent.setup();
    render(<PressCropEditor {...baseProps} />);

    await waitFor(() => expect(mockRequestPreview).toHaveBeenCalledTimes(1));
    const viewport = screen.getByRole("application", { name: "Gallery image crop viewport" });
    viewport.focus();
    await user.keyboard("{ArrowRight}");
    await waitFor(() => expect(mockRequestPreview).toHaveBeenCalledTimes(2));

    resolveSecond(descriptor("https://images.example/latest"));
    await waitFor(() => {
      expect(document.querySelector('section[aria-label="Gallery image rendered preview"] img'))
        .toHaveAttribute("src", "https://images.example/latest");
    });
    resolveFirst(descriptor("https://images.example/stale"));
    await Promise.resolve();
    expect(document.querySelector('section[aria-label="Gallery image rendered preview"] img'))
      .toHaveAttribute("src", "https://images.example/latest");
  });

  it("pans by pointer while keeping the crop in bounds", async () => {
    const onApply = vi.fn();
    const user = userEvent.setup();
    render(<PressCropEditor {...baseProps} onApply={onApply} />);
    const viewport = screen.getByRole("application", { name: "Gallery image crop viewport" });
    vi.spyOn(viewport, "getBoundingClientRect").mockReturnValue({
      width: 600,
      height: 450,
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      right: 600,
      bottom: 450,
      toJSON: () => ({}),
    });

    const pointerEvent = (type: string, clientX: number, clientY: number) => {
      const event = new Event(type, { bubbles: true });
      Object.defineProperties(event, {
        pointerId: { value: 1 },
        clientX: { value: clientX },
        clientY: { value: clientY },
      });
      viewport.dispatchEvent(event);
    };
    pointerEvent("pointerdown", 300, 225);
    pointerEvent("pointermove", 180, 120);
    pointerEvent("pointerup", 180, 120);
    await waitForCurrentPreview();
    await user.click(screen.getByRole("button", { name: "Apply crop" }));

    const crop = onApply.mock.calls[0]![0];
    expect(crop.x).toBeGreaterThanOrEqual(0);
    expect(crop.y).toBeGreaterThanOrEqual(0);
    expect(crop.x + crop.width).toBeLessThanOrEqual(1);
    expect(crop.y + crop.height).toBeLessThanOrEqual(1);
  });

  it("clears stale output and blocks Apply until the current preview succeeds", async () => {
    mockRequestPreview
      .mockResolvedValueOnce(descriptor("https://images.example/initial"))
      .mockRejectedValueOnce(new Error("imgproxy unavailable"));
    const user = userEvent.setup();
    render(<PressCropEditor {...baseProps} />);

    await waitForCurrentPreview();
    expect(screen.getByLabelText("Gallery image rendered preview").querySelector("img"))
      .toHaveAttribute("src", "https://images.example/initial");

    const viewport = screen.getByRole("application", { name: "Gallery image crop viewport" });
    viewport.focus();
    await user.keyboard("{ArrowRight}");

    expect(screen.getByRole("button", { name: "Apply crop" })).toBeDisabled();
    expect(screen.getByLabelText("Gallery image rendered preview").querySelector("img"))
      .not.toBeInTheDocument();
    expect(await screen.findByText("Preview unavailable. Adjust the crop or try again.")).toBeVisible();
    expect(screen.getByRole("button", { name: "Apply crop" })).toBeDisabled();
    expect(within(screen.getByLabelText("Gallery image rendered preview")).getByText(/try again/)).toBeVisible();
  });

  it("uses the authenticated legacy source adapter for owned press keys", () => {
    const legacyKey = "creators/creator-1/press/hero photo.jpg";
    render(
      <PressCropEditor {...baseProps} imageKey={legacyKey} sourceWidth={null} sourceHeight={null} />,
    );

    expect(document.querySelector('[role="application"] img')).toHaveAttribute(
      "src",
      `/api/creators/creator-1/press/image-source?key=${encodeURIComponent(legacyKey)}`,
    );
  });
});
