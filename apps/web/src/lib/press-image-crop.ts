import {
  PRESS_IMAGE_SLOT_RATIOS,
  PressImageCropSchema,
} from "@snc/shared";
import type {
  PressImageCrop,
  PressImageSlotName,
} from "@snc/shared";

export type CropSourceSize = { width: number; height: number };
export type CropCenter = { x: number; y: number };

const assertSource = (source: CropSourceSize): void => {
  if (!Number.isFinite(source.width) || source.width <= 0
    || !Number.isFinite(source.height) || source.height <= 0) {
    throw new RangeError("Crop source dimensions must be positive");
  }
};

const slotRatio = (slot: PressImageSlotName): number => {
  const [width, height] = PRESS_IMAGE_SLOT_RATIOS[slot].split("/").map(Number);
  return width! / height!;
};

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

const baseDimensions = (
  source: CropSourceSize,
  slot: PressImageSlotName,
): Pick<PressImageCrop, "width" | "height"> => {
  assertSource(source);
  const sourceRatio = source.width / source.height;
  const targetRatio = slotRatio(slot);
  return sourceRatio >= targetRatio
    ? { width: targetRatio / sourceRatio, height: 1 }
    : { width: 1, height: sourceRatio / targetRatio };
};

/** Largest centered normalized source rectangle matching a press slot. */
export const fitSlotCrop = (
  source: CropSourceSize,
  slot: PressImageSlotName,
): PressImageCrop => {
  const dimensions = baseDimensions(source, slot);
  return PressImageCropSchema.parse({
    x: (1 - dimensions.width) / 2,
    y: (1 - dimensions.height) / 2,
    ...dimensions,
  });
};

/** Convert fixed-frame pan/zoom state to a normalized in-bounds crop. */
export const cropFromViewport = (input: {
  source: CropSourceSize;
  slot: PressImageSlotName;
  center: CropCenter;
  zoom: number;
}): PressImageCrop => {
  const base = baseDimensions(input.source, input.slot);
  const zoom = Math.max(1, Number.isFinite(input.zoom) ? input.zoom : 1);
  const width = base.width / zoom;
  const height = base.height / zoom;
  const centerX = clamp(input.center.x, width / 2, 1 - width / 2);
  const centerY = clamp(input.center.y, height / 2, 1 - height / 2);
  return PressImageCropSchema.parse({
    x: centerX - width / 2,
    y: centerY - height / 2,
    width,
    height,
  });
};

/** Restore pan/zoom state from persisted normalized crop metadata. */
export const viewportFromCrop = (input: {
  source: CropSourceSize;
  slot: PressImageSlotName;
  crop?: PressImageCrop;
}): { center: CropCenter; zoom: number; crop: PressImageCrop } => {
  const base = baseDimensions(input.source, input.slot);
  if (!input.crop) {
    const crop = fitSlotCrop(input.source, input.slot);
    return { center: { x: 0.5, y: 0.5 }, zoom: 1, crop };
  }

  const zoom = Math.max(1, Math.min(base.width / input.crop.width, base.height / input.crop.height));
  const center = {
    x: input.crop.x + input.crop.width / 2,
    y: input.crop.y + input.crop.height / 2,
  };
  return {
    center,
    zoom,
    crop: cropFromViewport({ source: input.source, slot: input.slot, center, zoom }),
  };
};
