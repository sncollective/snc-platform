import { createHmac } from "node:crypto";

import {
  PRESS_IMAGE_SLOT_RATIOS,
  type PressImage,
  type PressImageSlot,
} from "@snc/shared";

import { config } from "../config.js";

// ── Public Types ──

/** Resize strategy for imgproxy processing. */
export type ResizeType = "fit" | "fill" | "fill-down" | "force" | "auto";

/** Gravity type for crop/fill alignment. */
export type Gravity = "no" | "so" | "ea" | "we" | "noea" | "nowe" | "soea" | "sowe" | "ce" | "sm";

/** Options for imgproxy URL generation. */
export interface ImgproxyOptions {
  /** Resize type (default: "fill"). */
  readonly resizeType?: ResizeType;
  /** Gravity for crop/fill (default: "ce"). */
  readonly gravity?: Gravity;
  /** Quality 1-100 (default: 0 = server default). */
  readonly quality?: number;
}

/** Resolved imgproxy configuration parsed from environment. */
interface ImgproxyConfig {
  readonly baseUrl: string;
  readonly key: string;
  readonly salt: string;
  readonly bucket: string;
  readonly signingEnabled: boolean;
}

// ── Public Constants ──

/** Standard responsive widths for content thumbnails and banners. */
export const THUMBNAIL_WIDTHS = [320, 640, 960, 1280] as const;

/** Standard responsive widths for hero/banner images. */
export const BANNER_WIDTHS = [640, 960, 1280, 1920] as const;

/** Standard DPR multipliers for fixed-size images. */
export const AVATAR_DPRS = [1, 2, 3] as const;

const PRESS_IMAGE_SIZES = {
  banner: "100vw",
  about: "(max-width: 760px) 100vw, 360px",
  member: "(max-width: 760px) 50vw, 240px",
  gallery: "(max-width: 480px) 84vw, (max-width: 760px) 45vw, 300px",
  cover: "(max-width: 480px) 92px, 145px",
} as const satisfies Record<keyof PressImageSlot, string>;

// ── Private Helpers ──

const hexDecode = (hex: string): Buffer => Buffer.from(hex, "hex");

const signPath = (key: string, salt: string, path: string): string => {
  const hmac = createHmac("sha256", hexDecode(key));
  hmac.update(hexDecode(salt));
  hmac.update(path);
  return hmac.digest("base64url");
};

const formatNormalized = (value: number, fullAxis = false): string => {
  const canonical = Math.round(value * 1_000_000) / 1_000_000;
  return fullAxis && canonical === 1 ? "0" : String(canonical);
};

const pressImageCandidateWidths = (width: number): number[] => {
  const candidates = [Math.round(width / 4), Math.round(width / 2), width]
    .map((candidate) => Math.max(160, candidate))
    .filter((candidate) => candidate <= width);

  return candidates.length > 0 ? [...new Set(candidates)] : [width];
};

// ── Module-level Config Access ──

const getConfig = (): ImgproxyConfig => ({
  baseUrl: config.IMGPROXY_URL ?? "",
  key: config.IMGPROXY_KEY ?? "",
  salt: config.IMGPROXY_SALT ?? "",
  bucket: config.S3_BUCKET ?? "snc-storage",
  signingEnabled: !!(config.IMGPROXY_KEY && config.IMGPROXY_SALT),
});

// ── Public API ──

/**
 * Build a single signed imgproxy URL for the given S3 key and target width.
 *
 * Height is auto-calculated (set to 0). No output format is specified —
 * imgproxy negotiates WebP/AVIF from the Accept header.
 *
 * @param s3Key - S3 object key (e.g. "content/{id}/thumbnail/photo.jpg")
 * @param width - Target pixel width
 * @param options - Resize type, gravity, and quality overrides
 */
export function buildImgproxyUrl(
  s3Key: string,
  width: number,
  options?: ImgproxyOptions,
): string {
  const cfg = getConfig();
  const rt = options?.resizeType ?? "fill";
  const g = options?.gravity ?? "ce";

  const parts = [`rs:${rt}:${width}:0`, `g:${g}`];
  if (options?.quality && options.quality > 0) {
    parts.push(`q:${options.quality}`);
  }

  const processingPath = parts.join("/");
  const sourceUrl = `s3://${cfg.bucket}/${s3Key}`;
  const path = `/${processingPath}/plain/${sourceUrl}`;

  const signature = cfg.signingEnabled
    ? signPath(cfg.key, cfg.salt, path)
    : "unsafe";

  return `${cfg.baseUrl}/${signature}${path}`;
}

/**
 * Build signed fixed-aspect delivery URLs for a press image slot.
 *
 * Persisted normalized crops are applied before the slot resize. Responsive
 * candidates share the crop and vary only their output dimensions.
 */
export type PressGravity = "ce" | "no" | "so";

export function buildPressImageUrl(
  image: PressImage,
  slot: keyof PressImageSlot,
  width: number,
  height?: number,
  gravity?: PressGravity,
): { src: string; srcSet: string; sizes: string } {
  if (!Number.isInteger(width) || width <= 0) {
    throw new RangeError("Press image width must be a positive integer");
  }
  if (height !== undefined && (!Number.isInteger(height) || height <= 0)) {
    throw new RangeError("Press image height must be a positive integer");
  }

  const cfg = getConfig();
  const [ratioWidth, ratioHeight] = PRESS_IMAGE_SLOT_RATIOS[slot]
    .split("/")
    .map(Number) as [number, number];
  const sourceUrl = `s3://${cfg.bucket}/${image.key}`;

  const buildCandidate = (candidateWidth: number): string => {
    const outputHeight = height === undefined
      ? Math.round(candidateWidth * ratioHeight / ratioWidth)
      : Math.round(candidateWidth * height / width);
    const parts: string[] = [];

    if (image.crop) {
      const centerX = image.crop.x + image.crop.width / 2;
      const centerY = image.crop.y + image.crop.height / 2;
      parts.push(
        `c:${formatNormalized(image.crop.width, true)}:${formatNormalized(image.crop.height, true)}`
          + `:fp:${formatNormalized(centerX)}:${formatNormalized(centerY)}`,
      );
    }

    parts.push(`rs:fill:${candidateWidth}:${outputHeight}:0`, `g:${gravity ?? "ce"}`);
    const path = `/${parts.join("/")}/plain/${sourceUrl}`;
    const signature = cfg.signingEnabled
      ? signPath(cfg.key, cfg.salt, path)
      : "unsafe";

    return `${cfg.baseUrl}/${signature}${path}`;
  };

  return {
    src: buildCandidate(width),
    srcSet: pressImageCandidateWidths(width)
      .map((candidateWidth) => `${buildCandidate(candidateWidth)} ${candidateWidth}w`)
      .join(", "),
    sizes: PRESS_IMAGE_SIZES[slot],
  };
}

/**
 * Build a width-descriptor srcSet string for responsive images.
 *
 * Each entry is `{url} {width}w`. The browser picks the best match using
 * the `sizes` attribute on the `<img>` element.
 */
export function buildSrcSet(
  s3Key: string,
  widths: readonly number[],
  options?: ImgproxyOptions,
): string {
  return widths
    .map((w) => `${buildImgproxyUrl(s3Key, w, options)} ${w}w`)
    .join(", ");
}

/**
 * Build a DPR-based srcSet string for fixed-size images (avatars, small thumbnails).
 *
 * Each entry is `{url} {dpr}x`. Both width and height are specified to prevent
 * upscaling artifacts on fixed-dimension containers.
 */
export function buildDprSrcSet(
  s3Key: string,
  logicalWidth: number,
  logicalHeight: number,
  options?: ImgproxyOptions,
): string {
  const cfg = getConfig();
  const rt = options?.resizeType ?? "fill";
  const g = options?.gravity ?? "ce";

  return AVATAR_DPRS
    .map((dpr) => {
      const parts = [
        `rs:${rt}:${logicalWidth}:${logicalHeight}`,
        `g:${g}`,
        `dpr:${dpr}`,
      ];
      if (options?.quality && options.quality > 0) {
        parts.push(`q:${options.quality}`);
      }
      const sourceUrl = `s3://${cfg.bucket}/${s3Key}`;
      const path = `/${parts.join("/")}/plain/${sourceUrl}`;
      const signature = cfg.signingEnabled
        ? signPath(cfg.key, cfg.salt, path)
        : "unsafe";
      return `${cfg.baseUrl}/${signature}${path} ${dpr}x`;
    })
    .join(", ");
}
