import type { Result } from "./result.js";
import type { AppError } from "./errors.js";

// ── Public Types ──

/** Optional metadata attached to a storage upload. */
export type UploadMetadata = {
  readonly contentType?: string;
  readonly contentLength?: number;
};

/** Successful upload response with the storage key and byte size. */
export type UploadResult = {
  readonly key: string;
  readonly size: number;
};

/** Successful download response with a readable byte stream and size. */
export type DownloadResult = {
  readonly stream: ReadableStream<Uint8Array>;
  readonly size: number;
};

/** Pluggable storage backend (local filesystem, S3, etc.) for file operations. */
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

  /** Get object metadata (size, content type) without downloading. */
  head(key: string): Promise<Result<{ size: number; contentType: string }, AppError>>;

  /** Generate a presigned PUT URL for direct-to-storage uploads. */
  getPresignedUploadUrl(
    key: string,
    contentType: string,
    expiresInSeconds: number,
  ): Promise<Result<string, AppError>>;
};

// ── Public Constants ──

/** Allowed MIME types per media category for upload validation. */
export const ACCEPTED_MIME_TYPES = {
  video: ["video/mp4", "video/webm", "video/quicktime"],
  audio: ["audio/mpeg", "audio/wav", "audio/flac", "audio/ogg", "audio/aac"],
  image: ["image/jpeg", "image/png", "image/webp"],
} as const;

/** Maximum upload size in bytes per media category. */
export const MAX_FILE_SIZES = {
  video: 20 * 1024 * 1024 * 1024,
  audio: 100 * 1024 * 1024,
  image: 10 * 1024 * 1024,
} as const;
