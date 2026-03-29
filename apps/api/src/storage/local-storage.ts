import node_path from "node:path";
import { mkdir, unlink, stat } from "node:fs/promises";
import type { Stats } from "node:fs";
import { createReadStream, createWriteStream } from "node:fs";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

import { ok, err } from "@snc/shared";
import { AppError, NotFoundError } from "@snc/shared";
import type { StorageProvider, UploadMetadata, UploadResult, DownloadResult, RangeDownloadResult } from "@snc/shared";
import type { Result } from "@snc/shared";

import { inferContentType } from "../lib/file-utils.js";

// ── Private Helpers ──

const isEnoent = (error: unknown): boolean =>
  error instanceof Error && (error as NodeJS.ErrnoException).code === "ENOENT";

const statOrNotFound = async (filePath: string): Promise<Result<Stats, AppError>> => {
  try {
    return ok(await stat(filePath));
  } catch (statError) {
    if (isEnoent(statError)) {
      return err(new NotFoundError("File not found"));
    }
    throw statError;
  }
};

const toStorageError = (error: unknown): Result<never, AppError> => {
  const message = error instanceof Error ? error.message : String(error);
  return err(new AppError("STORAGE_ERROR", message, 500));
};

// ── Public Types ──

export type LocalStorageOptions = {
  baseDir: string;
};

// ── Public API ──

/** Create a StorageProvider backed by the local filesystem with path-traversal protection. */
export const createLocalStorage = (
  options: LocalStorageOptions,
): StorageProvider => {
  const baseDir = node_path.resolve(options.baseDir);

  const resolvePath = (key: string): string => {
    const resolved = node_path.resolve(node_path.join(baseDir, key));
    if (!resolved.startsWith(baseDir + node_path.sep) && resolved !== baseDir) {
      throw new AppError("STORAGE_ERROR", "Invalid storage key", 400);
    }
    return resolved;
  };

  const upload = async (
    key: string,
    stream: ReadableStream<Uint8Array>,
    _metadata?: UploadMetadata,
  ): Promise<Result<UploadResult, AppError>> => {
    try {
      const filePath = resolvePath(key);
      const dir = node_path.dirname(filePath);
      await mkdir(dir, { recursive: true });
      const nodeReadable = Readable.fromWeb(stream as any);
      const writeStream = createWriteStream(filePath);
      await pipeline(nodeReadable, writeStream);
      const statResult = await stat(filePath);
      return ok({ key, size: statResult.size });
    } catch (error) {
      if (error instanceof AppError) {
        return err(error);
      }
      return toStorageError(error);
    }
  };

  const download = async (
    key: string,
  ): Promise<Result<DownloadResult, AppError>> => {
    try {
      const filePath = resolvePath(key);
      const statResult = await statOrNotFound(filePath);
      if (!statResult.ok) return statResult;
      const readStream = createReadStream(filePath);
      const webStream = Readable.toWeb(readStream) as ReadableStream<Uint8Array>;
      return ok({ stream: webStream, size: statResult.value.size });
    } catch (error) {
      if (error instanceof AppError) {
        return err(error);
      }
      return toStorageError(error);
    }
  };

  const downloadRange = async (
    key: string,
    start: number,
    end: number,
  ): Promise<Result<RangeDownloadResult, AppError>> => {
    try {
      const filePath = resolvePath(key);
      const statResult = await statOrNotFound(filePath);
      if (!statResult.ok) return statResult;

      const readStream = createReadStream(filePath, { start, end });
      const webStream =
        Readable.toWeb(readStream) as ReadableStream<Uint8Array>;

      return ok({
        stream: webStream,
        contentLength: end - start + 1,
        totalSize: statResult.value.size,
        range: { start, end },
      });
    } catch (error) {
      if (error instanceof AppError) {
        return err(error);
      }
      return toStorageError(error);
    }
  };

  const deleteFile = async (
    key: string,
  ): Promise<Result<void, AppError>> => {
    try {
      const filePath = resolvePath(key);
      await unlink(filePath);
      return ok(undefined);
    } catch (error) {
      if (error instanceof AppError) {
        return err(error);
      }
      if (isEnoent(error)) {
        return ok(undefined);
      }
      return toStorageError(error);
    }
  };

  /**
   * Resolve a local storage key to an API URL.
   *
   * Routing convention: keys with the prefix `content/{id}/...` are routed to
   * `/api/content/{id}/media` (served via the content media handler); all other
   * keys are routed to `/api/storage/{key}` (the generic storage passthrough).
   */
  const getSignedUrl = async (
    key: string,
    _expiresInSeconds: number,
  ): Promise<Result<string, AppError>> => {
    const parts = key.split("/");
    const contentId = parts[1];
    if (parts[0] === "content" && contentId) {
      return ok(`/api/content/${contentId}/media`);
    }
    return ok(`/api/storage/${key}`);
  };

  const head = async (
    key: string,
  ): Promise<Result<{ size: number; contentType: string }, AppError>> => {
    try {
      const filePath = resolvePath(key);
      const statResult = await statOrNotFound(filePath);
      if (!statResult.ok) return statResult;
      const contentType = inferContentType(key);
      return ok({ size: statResult.value.size, contentType });
    } catch (error) {
      if (error instanceof AppError) {
        return err(error);
      }
      return toStorageError(error);
    }
  };

  /**
   * Always returns a 501 error — local storage does not support presigned upload URLs.
   * Use an S3-compatible StorageProvider for direct client uploads.
   */
  const getPresignedUploadUrl = async (
    _key: string,
    _contentType: string,
    _expiresInSeconds: number,
  ): Promise<Result<string, AppError>> => {
    return err(
      new AppError("PRESIGN_UPLOAD_NOT_SUPPORTED", "Direct uploads require S3 storage", 501),
    );
  };

  return {
    upload,
    download,
    downloadRange,
    delete: deleteFile,
    getSignedUrl,
    head,
    getPresignedUploadUrl,
  };
};
