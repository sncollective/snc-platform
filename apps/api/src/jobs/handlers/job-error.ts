import type { Logger } from "../../logging/logger.js";
import {
  updateJob,
  updateContentProcessing,
} from "../../services/processing-jobs.js";

// ── Private Helpers ──

/** Format an unknown caught value into a loggable message string. */
export const formatErrorMessage = (e: unknown): string =>
  e instanceof Error ? e.message : String(e);

/**
 * Mark a content processing job as failed: log, update job record,
 * optionally mark content processing status as failed.
 *
 * @param contentId - Pass null to skip updateContentProcessing (e.g. thumbnail failure is non-fatal)
 */
export const failContentJob = async (
  jobId: string,
  contentId: string | null,
  e: unknown,
  logger: Logger,
  label: string,
): Promise<void> => {
  const message = formatErrorMessage(e);
  logger.error({ error: message }, `${label} failed`);
  await updateJob(jobId, { status: "failed", error: message });
  if (contentId) {
    await updateContentProcessing(contentId, { processingStatus: "failed" });
  }
};
