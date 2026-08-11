import { MAX_FILE_SIZES } from "@snc/shared";

export type DetectedImageType = "jpg" | "png" | "webp";

export type DetectedImage = {
  type: DetectedImageType;
  width: number | null;
  height: number | null;
};

type ImageDimensions = {
  width: number;
  height: number;
};

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] as const;
const MAX_DATABASE_DIMENSION = 0x7fff_ffff;
const JPEG_SOF_MARKERS = new Set([
  0xc0, 0xc1, 0xc2, 0xc3,
  0xc5, 0xc6, 0xc7,
  0xc9, 0xca, 0xcb,
  0xcd, 0xce, 0xcf,
]);

const matchesBytes = (
  bytes: Uint8Array,
  offset: number,
  expected: readonly number[],
): boolean => {
  if (offset < 0 || offset + expected.length > bytes.byteLength) return false;
  return expected.every((value, index) => bytes[offset + index] === value);
};

const matchesAscii = (bytes: Uint8Array, offset: number, expected: string): boolean => {
  if (offset < 0 || offset + expected.length > bytes.byteLength) return false;
  for (let index = 0; index < expected.length; index += 1) {
    if (bytes[offset + index] !== expected.charCodeAt(index)) return false;
  }
  return true;
};

const readUint16BigEndian = (
  bytes: Uint8Array,
  offset: number,
  limit: number,
): number | null => {
  if (offset < 0 || offset + 2 > limit || offset + 2 > bytes.byteLength) return null;
  return bytes[offset]! * 0x100 + bytes[offset + 1]!;
};

const readUint16LittleEndian = (
  bytes: Uint8Array,
  offset: number,
  limit: number,
): number | null => {
  if (offset < 0 || offset + 2 > limit || offset + 2 > bytes.byteLength) return null;
  return bytes[offset]! + bytes[offset + 1]! * 0x100;
};

const readUint24LittleEndian = (
  bytes: Uint8Array,
  offset: number,
  limit: number,
): number | null => {
  if (offset < 0 || offset + 3 > limit || offset + 3 > bytes.byteLength) return null;
  return bytes[offset]!
    + bytes[offset + 1]! * 0x100
    + bytes[offset + 2]! * 0x1_0000;
};

const readUint32BigEndian = (
  bytes: Uint8Array,
  offset: number,
  limit: number,
): number | null => {
  if (offset < 0 || offset + 4 > limit || offset + 4 > bytes.byteLength) return null;
  return bytes[offset]! * 0x1_000_000
    + bytes[offset + 1]! * 0x1_0000
    + bytes[offset + 2]! * 0x100
    + bytes[offset + 3]!;
};

const readUint32LittleEndian = (
  bytes: Uint8Array,
  offset: number,
  limit: number,
): number | null => {
  if (offset < 0 || offset + 4 > limit || offset + 4 > bytes.byteLength) return null;
  return bytes[offset]!
    + bytes[offset + 1]! * 0x100
    + bytes[offset + 2]! * 0x1_0000
    + bytes[offset + 3]! * 0x1_000_000;
};

const dimensionsOrNull = (
  width: number | null,
  height: number | null,
): ImageDimensions | null => {
  if (
    width === null
    || height === null
    || width <= 0
    || height <= 0
    || width > MAX_DATABASE_DIMENSION
    || height > MAX_DATABASE_DIMENSION
  ) {
    return null;
  }
  return { width, height };
};

const readPngDimensions = (bytes: Uint8Array): ImageDimensions | null => {
  const limit = bytes.byteLength;
  const ihdrLength = readUint32BigEndian(bytes, 8, limit);
  if (limit < 33 || ihdrLength !== 13 || !matchesAscii(bytes, 12, "IHDR")) return null;
  return dimensionsOrNull(
    readUint32BigEndian(bytes, 16, limit),
    readUint32BigEndian(bytes, 20, limit),
  );
};

const readWebpDimensions = (bytes: Uint8Array): ImageDimensions | null => {
  const limit = bytes.byteLength;
  const riffSize = readUint32LittleEndian(bytes, 4, limit);
  const chunkSize = readUint32LittleEndian(bytes, 16, limit);
  if (
    riffSize === null
    || riffSize < 12
    || riffSize > limit - 8
    || chunkSize === null
    || chunkSize > riffSize - 12
    || chunkSize > limit - 20
  ) {
    return null;
  }

  if (matchesAscii(bytes, 12, "VP8X")) {
    if (chunkSize < 10) return null;
    const widthMinusOne = readUint24LittleEndian(bytes, 24, limit);
    const heightMinusOne = readUint24LittleEndian(bytes, 27, limit);
    return dimensionsOrNull(
      widthMinusOne === null ? null : widthMinusOne + 1,
      heightMinusOne === null ? null : heightMinusOne + 1,
    );
  }

  if (matchesAscii(bytes, 12, "VP8L")) {
    if (chunkSize < 5 || bytes.byteLength < 25 || bytes[20] !== 0x2f) return null;
    const width = 1 + bytes[21]! + ((bytes[22]! & 0x3f) << 8);
    const height = 1
      + (bytes[22]! >> 6)
      + (bytes[23]! << 2)
      + ((bytes[24]! & 0x0f) << 10);
    return dimensionsOrNull(width, height);
  }

  if (matchesAscii(bytes, 12, "VP8 ")) {
    if (
      chunkSize < 10
      || bytes.byteLength < 30
      || (bytes[20]! & 0x01) !== 0
      || !matchesBytes(bytes, 23, [0x9d, 0x01, 0x2a])
    ) {
      return null;
    }
    const encodedWidth = readUint16LittleEndian(bytes, 26, limit);
    const encodedHeight = readUint16LittleEndian(bytes, 28, limit);
    return dimensionsOrNull(
      encodedWidth === null ? null : encodedWidth & 0x3fff,
      encodedHeight === null ? null : encodedHeight & 0x3fff,
    );
  }

  return null;
};

const readJpegDimensions = (bytes: Uint8Array): ImageDimensions | null => {
  const scanLimit = Math.min(bytes.byteLength, MAX_FILE_SIZES.image);
  let offset = 2;

  while (offset < scanLimit) {
    if (bytes[offset] !== 0xff) return null;
    while (offset < scanLimit && bytes[offset] === 0xff) offset += 1;
    if (offset >= scanLimit) return null;

    const marker = bytes[offset]!;
    offset += 1;

    if (marker === 0x00 || marker === 0xd9 || marker === 0xda) return null;
    if (marker === 0x01 || marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd7)) {
      continue;
    }

    const segmentLength = readUint16BigEndian(bytes, offset, scanLimit);
    if (segmentLength === null || segmentLength < 2) return null;
    const segmentEnd = offset + segmentLength;
    if (segmentEnd > scanLimit || segmentEnd > bytes.byteLength) return null;

    if (JPEG_SOF_MARKERS.has(marker)) {
      if (segmentLength < 8) return null;
      return dimensionsOrNull(
        readUint16BigEndian(bytes, offset + 5, segmentEnd),
        readUint16BigEndian(bytes, offset + 3, segmentEnd),
      );
    }

    offset = segmentEnd;
  }

  return null;
};

const detectType = (bytes: Uint8Array): DetectedImageType | null => {
  if (matchesBytes(bytes, 0, [0xff, 0xd8, 0xff])) return "jpg";
  if (matchesBytes(bytes, 0, PNG_SIGNATURE)) return "png";
  if (matchesAscii(bytes, 0, "RIFF") && matchesAscii(bytes, 8, "WEBP")) return "webp";
  return null;
};

/**
 * Detect an allowlisted image format and read its header dimensions.
 *
 * Non-jpg/png/webp magic returns null before a format-specific parser runs.
 * Recognized but malformed or truncated headers retain their format with null
 * dimensions; attacker-controlled bytes never cause this function to throw.
 */
export const detectImage = (bytes: Uint8Array): DetectedImage | null => {
  const type = detectType(bytes);
  if (type === null) return null;

  const dimensions = type === "jpg"
    ? readJpegDimensions(bytes)
    : type === "png"
      ? readPngDimensions(bytes)
      : readWebpDimensions(bytes);

  return {
    type,
    width: dimensions?.width ?? null,
    height: dimensions?.height ?? null,
  };
};
