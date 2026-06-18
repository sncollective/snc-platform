import "dotenv/config";

import { ensurePlayout, ensureBroadcast, SNC_TV_BROADCAST } from "../services/channels.js";
import { ensureChannelRoom } from "../services/chat.js";
import {
  upsertEditorialConfig,
  createEditorialTier,
  getEditorialTiers,
} from "../services/editorial-config.js";
import { rootLogger } from "../logging/logger.js";

// ── Channel Definitions ──

const PLAYOUT_CHANNELS = [
  { name: "S/NC Classics", srsStreamName: "channel-classics" },
];

const BROADCAST_CHANNEL = SNC_TV_BROADCAST;

// ── Broadcast editorial config ──

/**
 * Seed S/NC TV's editorial config so the generated .liq reproduces the prior fallback
 * order: live (creator takeover) → queue (+ pool) → S/NC Classics (carried) → silence.
 *
 * Idempotent: if the broadcast channel already has editorial tiers, only the config row
 * is re-upserted (which is itself idempotent) and tier creation is skipped — so a re-run,
 * or a backfill of an existing pre-config broadcast channel, both converge without
 * duplicate-priority errors.
 */
const seedBroadcastEditorialConfig = async (
  broadcastId: string,
  classicsId: string | undefined,
): Promise<void> => {
  const configResult = await upsertEditorialConfig(broadcastId, { mode: "auto" });
  if (!configResult.ok) {
    rootLogger.error(
      { error: configResult.error },
      "Failed to upsert S/NC TV editorial config",
    );
    return;
  }

  const existing = await getEditorialTiers(broadcastId);
  if (existing.ok && existing.value.length > 0) {
    rootLogger.info(
      `S/NC TV editorial tiers already present (${existing.value.length}) — skipping tier creation`,
    );
    return;
  }

  // Priority order reproduces fallback([live, queue, classics, blank]); the blank tail is
  // the render's infallible mksafe(blank()), not a seeded tier. The carry tier is omitted
  // when no playout channel exists to carry (degenerate empty-DB case).
  const tiers: Parameters<typeof createEditorialTier>[1][] = [
    { tierType: "live", priority: 0 },
    { tierType: "queue", priority: 1 },
    ...(classicsId
      ? [{ tierType: "channel-as-source" as const, priority: 2, sourceChannelId: classicsId }]
      : []),
  ];

  for (const tier of tiers) {
    const result = await createEditorialTier(broadcastId, tier);
    if (!result.ok) {
      rootLogger.error(
        { error: result.error, tierType: tier.tierType },
        "Failed to create S/NC TV editorial tier",
      );
      return;
    }
  }

  rootLogger.info(`S/NC TV editorial config seeded (${tiers.length} tiers)`);
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
    // Seed S/NC TV's editorial config (live → queue → S/NC Classics carry). Idempotent;
    // also backfills an existing broadcast channel that predates the editorial model.
    await seedBroadcastEditorialConfig(broadcastResult.value.channelId, playoutIds[0]);
  } else {
    rootLogger.error(
      { error: broadcastResult.error },
      `Failed to create broadcast channel "${BROADCAST_CHANNEL.name}"`,
    );
  }

  process.exit(0);
};

main();
