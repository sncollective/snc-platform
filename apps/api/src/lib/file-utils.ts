import type { Context } from "hono";

import { NotFoundError } from "@snc/shared";
import type { StorageProvider } from "@snc/shared";

import type { AuthEnv } from "../middleware/auth-env.js";

const DEFAULT_CACHE_CONTROL: string = "public, max-age=86400"; // 1 day

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
 * Download a file from storage and stream it as an HTTP response with appropriate headers.
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
  const result = await storage.download(key);
  if (!result.ok) {
    throw new NotFoundError(errorMsg);
  }
  const { stream, size } = result.value;
  const contentType = inferContentType(key);
  const filename = key.split("/").pop() ?? "file";
  c.header("Content-Type", contentType);
  c.header("Content-Length", size.toString());
  c.header("Content-Disposition", `inline; filename="${filename}"`);
  c.header("Cache-Control", cacheControl);
  return c.body(stream);
};
