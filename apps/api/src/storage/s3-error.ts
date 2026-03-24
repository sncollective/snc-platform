import { AppError } from "@snc/shared";

// ── Shared S3 Error Helper ──

/** Log an S3 error and wrap it as a 502 AppError with the given code. */
export const wrapS3Error = (e: unknown, code: string): AppError => {
  console.error(`S3 error [${code}]:`, e instanceof Error ? e.message : String(e));
  return new AppError(code, "Storage operation failed", 502);
};
