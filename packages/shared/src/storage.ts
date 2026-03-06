import type { Result } from "./result.js";
import type { AppError } from "./errors.js";

// ── Public Types ──

export type UploadMetadata = {
  contentType?: string;
  contentLength?: number;
};

export type UploadResult = {
  key: string;
  size: number;
};

export type DownloadResult = {
  stream: ReadableStream<Uint8Array>;
  size: number;
};

export type StorageProvider = {
  upload(
    key: string,
    stream: ReadableStream<Uint8Array>,
    metadata?: UploadMetadata,
  ): Promise<Result<UploadResult, AppError>>;

  download(key: string): Promise<Result<DownloadResult, AppError>>;

  delete(key: string): Promise<Result<void, AppError>>;

  getSignedUrl(
    key: string,
    expiresInSeconds: number,
  ): Promise<Result<string, AppError>>;
};

// ── Public Constants ──

export const ACCEPTED_MIME_TYPES = {
  video: ["video/mp4", "video/webm", "video/quicktime"],
  audio: ["audio/mpeg", "audio/wav", "audio/flac", "audio/ogg", "audio/aac"],
  image: ["image/jpeg", "image/png", "image/webp"],
} as const;

export const MAX_FILE_SIZES = {
  video: 500 * 1024 * 1024,
  audio: 100 * 1024 * 1024,
  image: 10 * 1024 * 1024,
} as const;
