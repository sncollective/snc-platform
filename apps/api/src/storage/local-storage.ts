import node_path from "node:path";
import { mkdir, unlink, stat } from "node:fs/promises";
import { createReadStream, createWriteStream } from "node:fs";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

import { ok, err } from "@snc/shared";
import { AppError, NotFoundError } from "@snc/shared";
import type { StorageProvider, UploadMetadata, UploadResult, DownloadResult } from "@snc/shared";
import type { Result } from "@snc/shared";

// ── Private Helpers ──

const isEnoent = (error: unknown): boolean =>
  error instanceof Error && (error as NodeJS.ErrnoException).code === "ENOENT";

const toStorageError = (error: unknown): Result<never, AppError> => {
  const message = error instanceof Error ? error.message : String(error);
  return err(new AppError("STORAGE_ERROR", message, 500));
};

// ── Public Types ──

export type LocalStorageOptions = {
  baseDir: string;
};

// ── Public API ──

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
      let fileSize: number;
      try {
        const fileStat = await stat(filePath);
        fileSize = fileStat.size;
      } catch (statError) {
        if (isEnoent(statError)) {
          return err(new NotFoundError("File not found"));
        }
        throw statError;
      }
      const readStream = createReadStream(filePath);
      const webStream = Readable.toWeb(readStream) as ReadableStream<Uint8Array>;
      return ok({ stream: webStream, size: fileSize });
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

  return {
    upload,
    download,
    delete: deleteFile,
    getSignedUrl,
  };
};
