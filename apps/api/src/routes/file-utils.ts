import type { Context } from "hono";

import { NotFoundError } from "@snc/shared";
import type { StorageProvider } from "@snc/shared";

import type { AuthEnv } from "../middleware/auth-env.js";

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

export const sanitizeFilename = (name: string): string =>
  name
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9\-_.]/g, "")
    .slice(0, 100);

export const inferContentType = (key: string): string => {
  const dot = key.lastIndexOf(".");
  if (dot === -1) return "application/octet-stream";
  const ext = key.slice(dot).toLowerCase();
  return EXTENSION_TO_MIME[ext] ?? "application/octet-stream";
};

export const streamFile = async (
  c: Context<AuthEnv>,
  storage: StorageProvider,
  key: string,
  errorMsg: string,
  cacheControl = "public, max-age=86400",
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
