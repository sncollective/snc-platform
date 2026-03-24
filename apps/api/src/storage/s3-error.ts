import { AppError } from "@snc/shared";

// ── Shared S3 Error Helper ──

export const wrapS3Error = (e: unknown, code: string): AppError => {
  const message = e instanceof Error ? e.message : String(e);
  return new AppError(code, message, 502);
};
