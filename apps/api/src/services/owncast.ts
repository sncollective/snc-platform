import { AppError, ok, err, type Result } from "@snc/shared";

import { config } from "../config.js";
import { wrapExternalError } from "./external-error.js";

// ── Public Types ──

export type OwncastStatus = {
  online: boolean;
  viewerCount: number;
  lastConnectTime: string | null;
  lastDisconnectTime: string | null;
  hlsUrl: string | null;
};

// ── Module-Level Configuration ──

const OWNCAST_API_URL: string | null = config.OWNCAST_URL ?? null;
const OWNCAST_HLS_URL: string | null = config.OWNCAST_HLS_URL ?? null;

// ── Private Helpers ──

const wrapOwncastError = wrapExternalError("OWNCAST_ERROR");

const ensureConfigured = (): Result<void, AppError> => {
  if (OWNCAST_API_URL === null) {
    return err(
      new AppError(
        "STREAMING_NOT_CONFIGURED",
        "Owncast streaming is not configured",
        503,
      ),
    );
  }
  return ok(undefined);
};

// ── Public API ──

/**
 * Fetch live stream status from Owncast.
 *
 * Returns the current online state, viewer count, and connect/disconnect times.
 * Errors when Owncast is not configured (503) or the upstream API fails (502).
 */
export const getStreamStatus = async (): Promise<
  Result<OwncastStatus, AppError>
> => {
  const configured = ensureConfigured();
  if (!configured.ok) return err(configured.error);

  try {
    const response = await fetch(`${OWNCAST_API_URL!}/api/status`, {
      signal: AbortSignal.timeout(5_000),
    });

    if (!response.ok) {
      return err(
        new AppError(
          "OWNCAST_ERROR",
          `Owncast API returned ${response.status}`,
          502,
        ),
      );
    }

    const data = (await response.json()) as OwncastStatus;

    return ok({
      online: data.online,
      viewerCount: data.viewerCount,
      lastConnectTime: data.lastConnectTime ?? null,
      lastDisconnectTime: data.lastDisconnectTime ?? null,
      hlsUrl: data.online ? OWNCAST_HLS_URL : null,
    });
  } catch (e) {
    return err(wrapOwncastError(e));
  }
};
