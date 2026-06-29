import { rootLogger } from "../logging/logger.js";
import type { LiquidsoapClient } from "./liquidsoap-client.js";
import { autoFill as autoFillChannel } from "./playout/auto-fill.js";
import {
  assignContent as assignChannelContent,
  listContent,
  removeContent,
  searchAvailableContent,
} from "./playout/content-pool.js";
import {
  insertIntoQueue as insertIntoChannelQueue,
  onTrackStarted as handleTrackStarted,
  removeFromQueue,
  skip as skipChannel,
} from "./playout/queue-control.js";
import {
  getChannelQueueStatus,
  getMultiChannelQueueStatus,
} from "./playout/queue-status.js";
import { initialize as initializeChannels } from "./playout/startup.js";
import type { QueueSource } from "./playout-queue-transitions.js";

// ── Constructor ──

export type PlayoutOrchestrator = ReturnType<typeof createPlayoutOrchestrator>;

/**
 * Create a playout orchestrator bound to a Liquidsoap client.
 *
 * The public surface remains the stable service facade consumed by route init and
 * callers. Cohesive internals live under `services/playout/` so queue reads,
 * queue mutation, pool-scope enforcement, auto-fill, prefetch, and startup
 * behavior can evolve independently without growing this factory again.
 */
export const createPlayoutOrchestrator = (client: LiquidsoapClient) => {
  const logger = rootLogger.child({ service: "playout-orchestrator" });

  return {
    getChannelQueueStatus,
    getMultiChannelQueueStatus,
    onTrackStarted: (channelId: string, uri: string) =>
      handleTrackStarted(channelId, uri, client, logger),
    insertIntoQueue: (
      channelId: string,
      source: QueueSource,
      position?: number,
    ) => insertIntoChannelQueue(channelId, source, position, client, logger),
    removeFromQueue,
    skip: (channelId: string) => skipChannel(channelId, client, logger),
    assignContent: (
      channelId: string,
      playoutItemIds: string[],
      contentIds?: string[],
    ) => assignChannelContent(channelId, playoutItemIds, contentIds, logger),
    removeContent,
    listContent,
    searchAvailableContent,
    autoFill: (channelId: string) => autoFillChannel(channelId, logger),
    initialize: () => initializeChannels(client, logger),
  };
};
