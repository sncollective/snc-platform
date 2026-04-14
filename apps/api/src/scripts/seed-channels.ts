import "dotenv/config";

import { ensurePlayout, ensureBroadcast } from "../services/channels.js";
import { ensureChannelRoom } from "../services/chat.js";
import { rootLogger } from "../logging/logger.js";

// ── Channel Definitions ──

const PLAYOUT_CHANNELS = [
  { name: "S/NC Classics", srsStreamName: "channel-classics" },
];

const BROADCAST_CHANNEL = {
  name: "S/NC TV",
  srsStreamName: "snc-tv",
};

// ── Main ──

const main = async (): Promise<void> => {
  // Seed playout channels first (broadcast references them)
  const playoutIds: string[] = [];
  for (const ch of PLAYOUT_CHANNELS) {
    const result = await ensurePlayout(ch);
    if (result.ok) {
      playoutIds.push(result.value.channelId);
      await ensureChannelRoom(result.value.channelId, ch.name);
      rootLogger.info(
        `Playout channel "${ch.name}" ready (${result.value.channelId})`,
      );
    } else {
      rootLogger.error(
        { error: result.error },
        `Failed to create playout channel "${ch.name}"`,
      );
    }
  }

  // Seed broadcast channel with first playout channel as default fallback
  const broadcastResult = await ensureBroadcast({
    ...BROADCAST_CHANNEL,
    ...(playoutIds[0] !== undefined && { defaultPlayoutChannelId: playoutIds[0] }),
  });
  if (broadcastResult.ok) {
    await ensureChannelRoom(broadcastResult.value.channelId, BROADCAST_CHANNEL.name);
    rootLogger.info(
      `Broadcast channel "${BROADCAST_CHANNEL.name}" ready (${broadcastResult.value.channelId})`,
    );
  } else {
    rootLogger.error(
      { error: broadcastResult.error },
      `Failed to create broadcast channel "${BROADCAST_CHANNEL.name}"`,
    );
  }

  process.exit(0);
};

main();
