import "dotenv/config";

import { ensurePlayout } from "../services/channels.js";
import { ensureChannelRoom } from "../services/chat.js";
import { rootLogger } from "../logging/logger.js";

// ── Playout Channel Definitions ──

const PLAYOUT_CHANNELS = [
  { name: "S/NC Classics", srsStreamName: "channel-main" },
];

// ── Main ──

const main = async (): Promise<void> => {
  for (const ch of PLAYOUT_CHANNELS) {
    const result = await ensurePlayout(ch);
    if (result.ok) {
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
  process.exit(0);
};

main();
