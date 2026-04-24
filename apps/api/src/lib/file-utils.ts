import type { Context } from "hono";

import { NotFoundError } from "@snc/shared";
import type { StorageProvider } from "@snc/shared";

import type { AuthEnv } from "../middleware/auth-env.js";

// ── Private Constants ──

const DEFAULT_CACHE_CONTROL: string = "public, max-age=86400"; // 1 day

// ── Public Constants ──

export const EXTENSION_TO_MIME: Record<string, string> = {
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mov": "video/quicktime",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".flac": "audio/flac",
  ".ogg": "audio/ogg",
  ".aac": "audio/aac",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

// ── Public Types ──

/** Parsed byte range from an HTTP Range header. */
export type ParsedRange =
  | { readonly type: "bounded"; readonly start: number; readonly end: number }
  | { readonly type: "open"; readonly start: number }
  | { readonly type: "suffix"; readonly suffix: number };

// ── Public Helpers ──

/** Extract the file extension from a storage key, without the dot, defaulting to `"bin"`. */
export const getFileExtension = (key: string): string => {
  const dot = key.lastIndexOf(".");
  if (dot === -1) return "bin";
  return key.slice(dot + 1) || "bin";
};

/** Normalize a filename to lowercase alphanumeric with dashes, truncated to 100 chars. */
export const sanitizeFilename = (name: string): string =>
  name
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9\-_.]/g, "")
    .slice(0, 100);

/** Infer MIME type from a storage key's file extension, defaulting to `application/octet-stream`. */
export const inferContentType = (key: string): string => {
  const dot = key.lastIndexOf(".");
  if (dot === -1) return "application/octet-stream";
  const ext = key.slice(dot).toLowerCase();
  return EXTENSION_TO_MIME[ext] ?? "application/octet-stream";
};

/**
 * Parse an HTTP Range header value into a structured range.
 *
 * Supports: `bytes=0-999`, `bytes=500-`, `bytes=-500`.
 * Returns null for malformed or non-byte range headers.
 */
export const parseRangeHeader = (header: string): ParsedRange | null => {
  if (!header.startsWith("bytes=")) return null;

  const match = header.match(/^bytes=(\d*)-(\d*)$/);
  if (!match) return null;
  const [, startStr, endStr] = match;

  if (startStr !== "" && endStr !== "") {
    return { type: "bounded", start: Number(startStr), end: Number(endStr) };
  }
  if (startStr !== "" && endStr === "") {
    return { type: "open", start: Number(startStr) };
  }
  if (startStr === "" && endStr !== "") {
    return { type: "suffix", suffix: Number(endStr) };
  }
  return null;
};

/**
 * Resolve a parsed range against a known file size into concrete byte boundaries.
 *
 * Returns null if the resolved range is invalid (start > end, or start >= totalSize).
 */
export const resolveRange = (
  parsed: ParsedRange,
  totalSize: number,
): { start: number; end: number } | null => {
  let start: number;
  let end: number;

  switch (parsed.type) {
    case "bounded":
      start = parsed.start;
      end = Math.min(parsed.end, totalSize - 1);
      break;
    case "open":
      start = parsed.start;
      end = totalSize - 1;
      break;
    case "suffix":
      start = Math.max(0, totalSize - parsed.suffix);
      end = totalSize - 1;
      break;
  }

  if (start > end || start >= totalSize) return null;
  return { start, end };
};

/**
 * Download a file from storage and stream it as an HTTP response.
 *
 * Supports HTTP Range requests: returns 206 Partial Content with `Content-Range`
 * when a valid `Range` header is present, 200 with full body otherwise.
 * Always sets `Accept-Ranges: bytes`.
 *
 * @throws {NotFoundError} When the storage key does not exist
 */
export const streamFile = async (
  c: Context<AuthEnv>,
  storage: StorageProvider,
  key: string,
  errorMsg: string,
  cacheControl: string = DEFAULT_CACHE_CONTROL,
): Promise<Response> => {
  const contentType = inferContentType(key);
  const filename = key.split("/").pop() ?? "file";
  const rangeHeader = c.req.header("range");

  c.header("Accept-Ranges", "bytes");
  c.header("Content-Type", contentType);
  c.header("Content-Disposition", `inline; filename="${filename}"`);
  c.header("Cache-Control", cacheControl);

  // ── Range request ──
  if (rangeHeader) {
    const headResult = await storage.head(key);
    if (!headResult.ok) {
      throw new NotFoundError(errorMsg);
    }
    const totalSize = headResult.value.size;

    const parsed = parseRangeHeader(rangeHeader);
    if (!parsed) {
      c.status(416);
      c.header("Content-Range", `bytes */${totalSize}`);
      return c.body(null);
    }

    const resolved = resolveRange(parsed, totalSize);
    if (!resolved) {
      c.status(416);
      c.header("Content-Range", `bytes */${totalSize}`);
      return c.body(null);
    }

    const rangeResult = await storage.downloadRange(key, resolved.start, resolved.end);
    if (!rangeResult.ok) {
      throw new NotFoundError(errorMsg);
    }

    const { stream, contentLength } = rangeResult.value;
    c.status(206);
    c.header("Content-Length", contentLength.toString());
    c.header(
      "Content-Range",
      `bytes ${resolved.start}-${resolved.end}/${totalSize}`,
    );
    return c.body(stream);
  }

  // ── Full download ──
  const result = await storage.download(key);
  if (!result.ok) {
    throw new NotFoundError(errorMsg);
  }
  const { stream, size } = result.value;
  c.header("Content-Length", size.toString());
  return c.body(stream);
};
