import { and, eq, inArray } from "drizzle-orm";

import { config } from "../../config.js";
import { db } from "../../db/connection.js";
import { playoutQueue } from "../../db/schema/playout-queue.schema.js";
import { channels } from "../../db/schema/streaming.schema.js";
import type { LiquidsoapClient } from "../liquidsoap-client.js";
import { autoFill } from "./auto-fill.js";
import { pushPrefetchBuffer } from "./prefetch.js";

interface StartupChannelRow {
  readonly id: string;
  readonly role?: string | null;
  readonly ownership?: string | null;
}

export type StartupLogger = {
  debug: (bindingsOrMessage: Record<string, unknown> | string, message?: string) => void;
  info: (bindings: Record<string, unknown>, message: string) => void;
  error: (bindings: Record<string, unknown>, message: string) => void;
  warn: (bindings: Record<string, unknown>, message: string) => void;
};

/** Creator live-ingest startup/prefetch is an explicit e2e profile affordance. */
const includeCreatorLiveIngestStartupChannels = (): boolean =>
  config.TEST_CONTROL_PROFILE === "e2e";

const shouldInitializeChannel = (channel: StartupChannelRow): boolean => {
  if ((channel.role ?? "playout") === "playout") return true;
  return includeCreatorLiveIngestStartupChannels() &&
    channel.role === "live-ingest" &&
    channel.ownership === "creator";
};

/** Initialize startup playback channels. */
export const initialize = async (
  client: LiquidsoapClient,
  logger: StartupLogger,
): Promise<void> => {
  const includeCreatorLiveIngest = includeCreatorLiveIngestStartupChannels();
  const channelRolePredicate = includeCreatorLiveIngest
    ? inArray(channels.role, ["playout", "live-ingest"])
    : eq(channels.role, "playout");

  const startupChannels = (await db
    .select()
    .from(channels)
    .where(
      and(
        channelRolePredicate,
        eq(channels.isActive, true),
      ),
    ))
    .filter(shouldInitializeChannel);

  if (startupChannels.length === 0) {
    logger.debug("No active startup playout channels found during initialization");
    return;
  }

  await db
    .update(playoutQueue)
    .set({ pushedToLiquidsoap: false })
    .where(
      and(
        inArray(playoutQueue.channelId, startupChannels.map((c) => c.id)),
        inArray(playoutQueue.status, ["queued", "playing"]),
        eq(playoutQueue.pushedToLiquidsoap, true),
      ),
    );

  for (const channel of startupChannels) {
    try {
      await autoFill(channel.id, logger);
    } catch (error) {
      logger.error(
        {
          channelId: channel.id,
          err: error,
          error: error instanceof Error ? error.message : String(error),
        },
        "Auto-fill failed during initialization",
      );
    }

    try {
      await pushPrefetchBuffer(channel.id, client, logger);
    } catch (error) {
      logger.error(
        {
          channelId: channel.id,
          err: error,
          error: error instanceof Error ? error.message : String(error),
        },
        "Prefetch push failed during initialization",
      );
    }
  }

  logger.info(
    { channelCount: startupChannels.length, includeCreatorLiveIngest },
    "Playout channels initialized",
  );
};
