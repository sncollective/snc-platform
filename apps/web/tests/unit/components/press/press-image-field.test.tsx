import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";

import type { PressImage } from "@snc/shared";
import { describe, expect, it, vi } from "vitest";

import { PressImageField } from "../../../../src/components/press/press-image-field.js";

vi.mock("../../../../src/lib/content-library.js", () => ({
  contentLibraryThumbnailUrl: (key: string) => `/raw/${key}`,
}));

vi.mock("../../../../src/components/press/press-image-picker.js", () => ({
  PressImagePicker: ({ slot, onApply, onCancel }: {
    slot: string;
    onApply: (image: object) => void;
    onCancel: () => void;
  }) => (
    <div role="dialog" aria-label={`${slot} picker mock`}>
      <button type="button" onClick={() => onApply({
        key: `library/bb/${"b".repeat(64)}.png`,
        alt: "Replacement",
        credit: null,
        crop: { x: 0, y: 0, width: 1, height: 1 },
      })}>Choose replacement</button>
      <button type="button" onClick={onCancel}>Cancel picker</button>
    </div>
  ),
}));

vi.mock("../../../../src/components/press/press-crop-editor.js", () => ({
  PressCropEditor: ({ slot, onApply, onCancel }: {
    slot: string;
    onApply: (crop: object) => void;
    onCancel: () => void;
  }) => (
    <div role="dialog" aria-label={`${slot} crop mock`}>
      <button type="button" onClick={() => onApply({ x: 0.2, y: 0.2, width: 0.5, height: 0.5 })}>Save crop</button>
      <button type="button" onClick={onCancel}>Cancel crop</button>
    </div>
  ),
}));

const image = {
  key: `library/aa/${"a".repeat(64)}.jpg`,
  alt: "Original image",
  credit: "Original credit",
  crop: { x: 0.1, y: 0.1, width: 0.8, height: 0.8 },
};

describe("PressImageField", () => {
  it("works empty and emits a selected replacement immediately", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <PressImageField creatorId="creator-1" label="Member photo" slot="member" value={null} onChange={onChange} />,
    );

    expect(screen.getByText("No image selected. This slot can remain empty.")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Choose image" }));
    expect(screen.getByRole("dialog", { name: "member picker mock" })).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Choose replacement" }));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
      key: `library/bb/${"b".repeat(64)}.png`,
      alt: "Replacement",
    }));
  });

  it("updates alt and normalized credit on the controlled reference", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    function Harness() {
      const [value, setValue] = useState<PressImage>(image);
      return (
        <PressImageField
          creatorId="creator-1"
          label="Gallery image"
          slot="gallery"
          value={value}
          onChange={(next) => {
            onChange(next);
            if (next) setValue(next);
          }}
        />
      );
    }
    render(<Harness />);

    await user.clear(screen.getByLabelText(/Alternative text/));
    await user.type(screen.getByLabelText(/Alternative text/), "New alt");
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ alt: "New alt" }));

    await user.clear(screen.getByLabelText("Photo credit (optional)"));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ credit: null }));
  });

  it("preserves metadata while editing crop and removes immediately", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <PressImageField creatorId="creator-1" label="Gallery image" slot="gallery" value={image} onChange={onChange} />,
    );

    await user.click(screen.getByRole("button", { name: "Edit crop" }));
    await user.click(screen.getByRole("button", { name: "Save crop" }));
    expect(onChange).toHaveBeenCalledWith({
      ...image,
      crop: { x: 0.2, y: 0.2, width: 0.5, height: 0.5 },
    });

    await user.click(screen.getByRole("button", { name: "Remove" }));
    expect(onChange).toHaveBeenLastCalledWith(null);
  });

  it("shows a recoverable fallback when the thumbnail fails", async () => {
    render(
      <PressImageField creatorId="creator-1" label="Gallery image" slot="gallery" value={image} onChange={vi.fn()} />,
    );

    screen.getByRole("img", { name: "Original image" }).dispatchEvent(new Event("error", { bubbles: true }));
    expect(await screen.findByText("Preview unavailable")).toBeVisible();
    expect(screen.getByRole("button", { name: "Replace" })).toBeEnabled();
  });
});
