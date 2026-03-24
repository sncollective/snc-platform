import { AppError } from "@snc/shared";

import { rootLogger } from "../logging/logger.js";

// ── Shared S3 Error Helper ──

export const wrapS3Error = (e: unknown, code: string): AppError => {
  rootLogger.error({ error: e instanceof Error ? e.message : String(e) }, `S3 error [${code}]`);
  return new AppError(code, "Storage operation failed", 502);
};
