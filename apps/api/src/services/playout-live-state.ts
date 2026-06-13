/**
 * Ephemeral in-memory holder for the Liquidsoap airing source.
 *
 * State is keyed to this API process lifetime — it resets to "unknown" on restart.
 * The consuming feature (`live-experience-redesign-live-state`) is responsible for
 * any mitigation strategy (e.g., heartbeat polling from Liquidsoap).
 *
 * This module is intentionally stateful and process-singleton. No DB column —
 * ephemeral engine state does not belong in the channel row.
 */

/** The source Liquidsoap is currently airing on the S/NC TV broadcast fallback. */
export type AiringSource = "live" | "queue" | "fallback" | "unknown";

let currentSource: AiringSource = "unknown";

/**
 * Record the source the broadcast fallback switched to.
 * Called from the input-switch webhook on every Liquidsoap transition event.
 */
export const setAiringSource = (source: AiringSource): void => {
  currentSource = source;
};

/**
 * Return the latest known airing source.
 * Returns "unknown" until the first switch event is received after API boot.
 */
export const getAiringSource = (): AiringSource => currentSource;
