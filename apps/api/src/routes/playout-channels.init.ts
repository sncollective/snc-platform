import { createPlayoutOrchestrator } from "../services/playout-orchestrator.js";
import { createLiquidsoapClient, createStubLiquidsoapClient } from "../services/liquidsoap-client.js";
import { config } from "../config.js";

/** Singleton orchestrator instance. Uses real client when Liquidsoap is configured. */
export const orchestrator = createPlayoutOrchestrator(
  config.LIQUIDSOAP_API_URL
    ? createLiquidsoapClient()
    : createStubLiquidsoapClient(),
);
