import { describe, expect, it } from "vitest";

import {
  cropFromViewport,
  fitSlotCrop,
  viewportFromCrop,
} from "../../../src/lib/press-image-crop.js";

const expectInBounds = (crop: { x: number; y: number; width: number; height: number }) => {
  expect(crop.x).toBeGreaterThanOrEqual(0);
  expect(crop.y).toBeGreaterThanOrEqual(0);
  expect(crop.x + crop.width).toBeLessThanOrEqual(1);
  expect(crop.y + crop.height).toBeLessThanOrEqual(1);
};

const pixelRatio = (
  crop: { width: number; height: number },
  source: { width: number; height: number },
) => crop.width * source.width / (crop.height * source.height);

describe("press image crop geometry", () => {
  it.each([
    [{ width: 2400, height: 1200 }, "banner" as const, 3],
    [{ width: 800, height: 1600 }, "about" as const, 4 / 5],
    [{ width: 1000, height: 1000 }, "member" as const, 1],
    [{ width: 10000, height: 200 }, "gallery" as const, 4 / 3],
    [{ width: 200, height: 10000 }, "cover" as const, 1],
  ])("fits %o to the %s ratio", (source, slot, ratio) => {
    const crop = fitSlotCrop(source, slot);

    expectInBounds(crop);
    // Persistence canonicalizes to six decimals; extreme sources stay within 1e-4.
    expect(pixelRatio(crop, source)).toBeCloseTo(ratio, 4);
    expect(Math.max(crop.width, crop.height)).toBe(1);
  });

  it("zooms around a clamped center without leaving source bounds", () => {
    const source = { width: 3000, height: 1000 };
    const crop = cropFromViewport({
      source,
      slot: "gallery",
      center: { x: -10, y: 20 },
      zoom: 4,
    });

    expectInBounds(crop);
    expect(crop.x).toBe(0);
    expect(crop.y + crop.height).toBe(1);
    expect(pixelRatio(crop, source)).toBeCloseTo(4 / 3, 5);
  });

  it("treats zoom below one as the largest fitting crop", () => {
    const source = { width: 1200, height: 1800 };
    expect(cropFromViewport({
      source,
      slot: "about",
      center: { x: 0.5, y: 0.5 },
      zoom: 0.25,
    })).toEqual(fitSlotCrop(source, "about"));
  });

  it("restores persisted crop center and zoom stably", () => {
    const source = { width: 2400, height: 1600 };
    const original = cropFromViewport({
      source,
      slot: "gallery",
      center: { x: 0.72, y: 0.31 },
      zoom: 2.75,
    });
    const restored = viewportFromCrop({ source, slot: "gallery", crop: original });

    expect(restored.crop).toEqual(original);
    expect(restored.center).toEqual({
      x: original.x + original.width / 2,
      y: original.y + original.height / 2,
    });
  });

  it("rejects unusable source dimensions", () => {
    expect(() => fitSlotCrop({ width: 0, height: 100 }, "banner")).toThrow(RangeError);
    expect(() => fitSlotCrop({ width: 100, height: Number.NaN }, "banner")).toThrow(RangeError);
  });
});
