import { AppError, ok, err, type Result } from "@snc/shared";

import { config } from "../config.js";
import { wrapExternalError } from "./external-error.js";

// ── Public Types ──

export type OwncastStatus = {
  online: boolean;
  viewerCount: number;
  lastConnectTime: string | null;
  lastDisconnectTime: string | null;
};

// ── Module-Level Configuration ──

const OWNCAST_API_URL: string | null = config.OWNCAST_URL ?? null;

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

export const getStreamStatus = async (): Promise<
  Result<OwncastStatus, AppError>
> => {
  const configured = ensureConfigured();
  if (!configured.ok) return configured as Result<OwncastStatus, AppError>;

  try {
    const response = await fetch(`${OWNCAST_API_URL!}/api/status`);

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
    });
  } catch (e) {
    return err(wrapOwncastError(e));
  }
};
