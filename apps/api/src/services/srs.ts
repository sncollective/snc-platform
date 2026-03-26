import { AppError, ok, err, type Result } from "@snc/shared";

import { config } from "../config.js";
import { wrapExternalError } from "./external-error.js";

// ── Public Types ──

export type SrsStreamStatus = {
  isLive: boolean;
  viewerCount: number;
  hlsUrl: string | null;
};

// ── Module-Level Configuration ──

const SRS_API_URL: string | null = config.SRS_API_URL ?? null;
const SRS_HLS_URL: string | null = config.SRS_HLS_URL ?? null;

// ── Private Helpers ──

const wrapSrsError = wrapExternalError("SRS_ERROR");

const ensureConfigured = (): Result<void, AppError> => {
  if (SRS_API_URL === null) {
    return err(
      new AppError(
        "STREAMING_NOT_CONFIGURED",
        "SRS streaming is not configured",
        503,
      ),
    );
  }
  return ok(undefined);
};

// ── Public API ──

/**
 * Fetch live stream status from SRS.
 *
 * Queries the SRS streams API and aggregates across all active streams.
 * Returns isLive = true if any stream is actively publishing.
 * Errors when SRS is not configured (503) or the upstream API fails (502).
 */
export const getStreamStatus = async (): Promise<
  Result<SrsStreamStatus, AppError>
> => {
  const configured = ensureConfigured();
  if (!configured.ok) return err(configured.error);

  try {
    const response = await fetch(`${SRS_API_URL!}/api/v1/streams/`, {
      signal: AbortSignal.timeout(5_000),
    });

    if (!response.ok) {
      return err(
        new AppError(
          "SRS_ERROR",
          `SRS API returned ${response.status}`,
          502,
        ),
      );
    }

    const data = (await response.json()) as {
      code: number;
      streams: Array<{
        publish: { active: boolean };
        clients: number;
      }>;
    };

    const activeStreams = data.streams.filter((s) => s.publish.active);
    const isLive = activeStreams.length > 0;
    const viewerCount = activeStreams.reduce((sum, s) => sum + s.clients, 0);

    return ok({
      isLive,
      viewerCount,
      hlsUrl: isLive ? SRS_HLS_URL : null,
    });
  } catch (e) {
    return err(wrapSrsError(e));
  }
};
