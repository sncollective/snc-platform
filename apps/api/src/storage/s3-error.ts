import { AppError } from "@snc/shared";

import { rootLogger } from "../logging/logger.js";

// ── Shared S3 Error Helper ──

/** Log an S3 error and wrap it as a 502 AppError with the given code. */
export const wrapS3Error = (e: unknown, code: string): AppError => {
  rootLogger.error({ code, error: e instanceof Error ? e.message : String(e) }, "S3 operation error");
  return new AppError(code, "Storage operation failed", 502);
};
