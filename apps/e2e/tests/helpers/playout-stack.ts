/**
 * Skip guard for the playout/streaming e2e specs.
 *
 * These specs (Liquidsoap track-event -> nowPlaying promotion, /live channel
 * selector + theater + chat, playout-admin "Now Playing", HLS playback) require
 * the FULL media stack — Liquidsoap + SRS — which the CI test-e2e job does NOT
 * provision (it runs only postgres + api + web). Locally the full PM2 stack is
 * up, so they run and pass.
 *
 * Set `E2E_PLAYOUT=skip` in the CI test-e2e env to skip them here. Drop the flag
 * if CI later provisions the stack (Option A in the root backlog item below).
 *
 * See root .work/backlog/idea-e2e-playout-stack-ci-coverage.
 */
export const PLAYOUT_SPECS_SKIPPED = process.env.E2E_PLAYOUT === "skip";

export const PLAYOUT_SKIP_REASON =
  "playout stack (Liquidsoap+SRS) not provisioned in this environment (E2E_PLAYOUT=skip); run locally with the full stack. See .work/backlog/idea-e2e-playout-stack-ci-coverage.";
