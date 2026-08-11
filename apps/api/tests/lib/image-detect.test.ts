import { describe, expect, it } from "vitest";

import { MAX_FILE_SIZES } from "@snc/shared";

import { detectImage } from "../../src/lib/image-detect.js";

const setAscii = (bytes: Uint8Array, offset: number, value: string): void => {
  for (let index = 0; index < value.length; index += 1) {
    bytes[offset + index] = value.charCodeAt(index);
  }
};

const makePng = (width: number, height: number): Uint8Array => {
  const bytes = new Uint8Array(33);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const view = new DataView(bytes.buffer);
  view.setUint32(8, 13);
  setAscii(bytes, 12, "IHDR");
  view.setUint32(16, width);
  view.setUint32(20, height);
  return bytes;
};

const makeJpeg = (width: number, height: number): Uint8Array => Uint8Array.from([
  0xff, 0xd8,
  0xff, 0xe0, 0x00, 0x04, 0xaa, 0xbb,
  0xff, 0xc0, 0x00, 0x08, 0x08,
  (height >> 8) & 0xff, height & 0xff,
  (width >> 8) & 0xff, width & 0xff,
  0x01,
]);

const makeWebp = (
  variant: "VP8 " | "VP8L" | "VP8X",
  width: number,
  height: number,
): Uint8Array => {
  const bytes = new Uint8Array(30);
  const view = new DataView(bytes.buffer);
  setAscii(bytes, 0, "RIFF");
  view.setUint32(4, 22, true);
  setAscii(bytes, 8, "WEBP");
  setAscii(bytes, 12, variant);

  if (variant === "VP8X") {
    view.setUint32(16, 10, true);
    const widthMinusOne = width - 1;
    const heightMinusOne = height - 1;
    bytes.set([
      widthMinusOne & 0xff,
      (widthMinusOne >> 8) & 0xff,
      (widthMinusOne >> 16) & 0xff,
    ], 24);
    bytes.set([
      heightMinusOne & 0xff,
      (heightMinusOne >> 8) & 0xff,
      (heightMinusOne >> 16) & 0xff,
    ], 27);
  } else if (variant === "VP8L") {
    view.setUint32(16, 5, true);
    const widthMinusOne = width - 1;
    const heightMinusOne = height - 1;
    bytes[20] = 0x2f;
    bytes[21] = widthMinusOne & 0xff;
    bytes[22] = ((widthMinusOne >> 8) & 0x3f) | ((heightMinusOne & 0x03) << 6);
    bytes[23] = (heightMinusOne >> 2) & 0xff;
    bytes[24] = (heightMinusOne >> 10) & 0x0f;
  } else {
    view.setUint32(16, 10, true);
    bytes[20] = 0;
    bytes.set([0x9d, 0x01, 0x2a], 23);
    view.setUint16(26, width, true);
    view.setUint16(28, height, true);
  }

  return bytes;
};

describe("detectImage", () => {
  it("reads exact PNG and JPG dimensions", () => {
    expect(detectImage(makePng(640, 360))).toEqual({
      type: "png",
      width: 640,
      height: 360,
    });
    expect(detectImage(makeJpeg(1920, 1080))).toEqual({
      type: "jpg",
      width: 1920,
      height: 1080,
    });
  });

  it.each([
    ["VP8 " as const, 320, 180],
    ["VP8L" as const, 321, 123],
    ["VP8X" as const, 4096, 2160],
  ])("reads exact %s WebP dimensions", (variant, width, height) => {
    expect(detectImage(makeWebp(variant, width, height))).toEqual({
      type: "webp",
      width,
      height,
    });
  });

  it("rejects non-allowlisted magic before reading beyond the magic window", () => {
    const signatures = [
      Uint8Array.from(Buffer.from("icns\0\0\0\x10", "binary")),
      Uint8Array.from([0xff, 0x0a, 0, 0, 0, 0, 0, 0]),
      Uint8Array.from([0, 0, 0, 12, 0x4a, 0x58, 0x4c, 0x20, 0x0d, 0x0a, 0x87, 0x0a]),
      Uint8Array.from(Buffer.from("\0\0\0\x18ftypheic\0\0\0\0", "binary")),
      Uint8Array.from([1, 2, 3, 4]),
    ];

    for (const signature of signatures) {
      const reads: number[] = [];
      const observed = new Proxy(signature, {
        get(target, property) {
          if (typeof property === "string" && /^\d+$/.test(property)) {
            reads.push(Number(property));
          }
          return Reflect.get(target, property, target) as unknown;
        },
      });
      expect(detectImage(observed)).toBeNull();
      expect(Math.max(...reads)).toBeLessThanOrEqual(11);
    }
  });

  it("returns null dimensions for truncated and malformed accepted headers", () => {
    expect(detectImage(Uint8Array.from([0xff, 0xd8, 0xff]))).toEqual({
      type: "jpg",
      width: null,
      height: null,
    });
    expect(detectImage(Uint8Array.from([
      0xff, 0xd8, 0xff, 0xe0, 0x00, 0x00,
    ]))).toEqual({
      type: "jpg",
      width: null,
      height: null,
    });
    expect(detectImage(makePng(0, 100))).toEqual({
      type: "png",
      width: null,
      height: null,
    });
  });

  it("rejects a WebP whose declared RIFF size excludes the first chunk", () => {
    // RIFF declares a 12-byte payload (room for "WEBP" + chunk header only),
    // but trailing bytes hold a VP8X chunk with valid-looking dims. The chunk
    // sits outside the declared container, so dims must be null — not read from
    // the trailing bytes.
    const bytes = new Uint8Array(30);
    setAscii(bytes, 0, "RIFF");
    bytes.set([0x0c, 0x00, 0x00, 0x00], 4); // riffSize = 12
    setAscii(bytes, 8, "WEBP");
    setAscii(bytes, 12, "VP8X");
    bytes.set([0x0a, 0x00, 0x00, 0x00], 16); // chunkSize = 10
    bytes.set([0x64, 0x00, 0x00], 24); // width - 1 = 100
    bytes.set([0xc8, 0x00, 0x00], 27); // height - 1 = 200
    expect(detectImage(bytes)).toEqual({ type: "webp", width: null, height: null });
  });

  it("bounds a truncated JPG marker scan by the configured image byte limit", () => {
    const bytes = new Uint8Array(MAX_FILE_SIZES.image + 16).fill(0xff);
    bytes[0] = 0xff;
    bytes[1] = 0xd8;
    bytes[2] = 0xff;
    bytes.set(makeJpeg(800, 600).subarray(2), MAX_FILE_SIZES.image);

    expect(detectImage(bytes)).toEqual({
      type: "jpg",
      width: null,
      height: null,
    });
  });
});
