import { randomUUID } from "node:crypto";

import { and, eq } from "drizzle-orm";

import { db } from "../db/connection.js";
import {
  channelNotifySubscriptions,
  notificationJobs,
  notificationPreferences,
} from "../db/schema/notification.schema.js";
import { channels } from "../db/schema/streaming.schema.js";
import { users } from "../db/schema/user.schema.js";
import { getBoss } from "../jobs/boss.js";
import { JOB_QUEUES } from "../jobs/queue-names.js";
import { rootLogger } from "../logging/logger.js";
import { config } from "../config.js";

// ── Debounce ──

/**
 * Per-channel cooldown (ms) — a channel flapping live/offline must not spam
 * subscribers. Suppresses a repeat go-live dispatch within this window.
 */
const GO_LIVE_COOLDOWN_MS = 10 * 60 * 1_000;

/** Last dispatch time per channel (process-lifetime; resets on restart). */
const lastDispatchedAt = new Map<string, number>();

/** True when a go-live dispatch for this channel is within the cooldown window. */
const isWithinCooldown = (channelId: string, now: number): boolean => {
  const last = lastDispatchedAt.get(channelId);
  return last !== undefined && now - last < GO_LIVE_COOLDOWN_MS;
};

// ── Private ──

/** Resolve the email audience subscribed to a channel's go-live. */
const resolveChannelAudience = async (
  channelId: string,
): Promise<Array<{ userId: string; email: string; name: string }>> =>
  db
    .select({ userId: users.id, email: users.email, name: users.name })
    .from(channelNotifySubscriptions)
    .innerJoin(users, eq(channelNotifySubscriptions.userId, users.id))
    .where(eq(channelNotifySubscriptions.channelId, channelId));

/** True when the user has the channel_go_live email preference enabled (absent = enabled). */
const isGoLiveEmailEnabled = async (userId: string): Promise<boolean> => {
  const [pref] = await db
    .select({ enabled: notificationPreferences.enabled })
    .from(notificationPreferences)
    .where(
      and(
        eq(notificationPreferences.userId, userId),
        eq(notificationPreferences.eventType, "channel_go_live"),
        eq(notificationPreferences.channel, "email"),
      ),
    )
    .limit(1);
  return pref?.enabled ?? true;
};

// ── Public API ──

/**
 * Dispatch a channel-go-live email to each per-channel subscriber, reusing the
 * existing notification-send pg-boss path. Fire ONLY on a genuine offline→live edge;
 * a per-channel cooldown suppresses flapping. No-op when pg-boss isn't started.
 *
 * @param nowMs - injectable clock for tests; defaults to Date.now().
 */
export const dispatchChannelGoLive = async (
  channelId: string,
  nowMs: number = Date.now(),
): Promise<void> => {
  const boss = getBoss();
  if (!boss) {
    rootLogger.warn("pg-boss not started, skipping channel-go-live dispatch");
    return;
  }

  if (isWithinCooldown(channelId, nowMs)) {
    rootLogger.info({ channelId }, "channel-go-live within cooldown — suppressed");
    return;
  }

  const [channel] = await db
    .select({ name: channels.name })
    .from(channels)
    .where(eq(channels.id, channelId))
    .limit(1);
  if (!channel) {
    // Don't consume the cooldown — an unknown channel here is not a real go-live,
    // so a genuine transition right after must still dispatch.
    rootLogger.warn({ channelId }, "channel-go-live for unknown channel — skipped");
    return;
  }

  const audience = await resolveChannelAudience(channelId);
  // Same web base as the existing go_live dispatch (streaming.routes.ts).
  const liveUrl = `${config.BETTER_AUTH_URL}/live?channel=${channelId}`;
  let enqueued = 0;

  for (const member of audience) {
    if (!(await isGoLiveEmailEnabled(member.userId))) continue;

    const jobId = randomUUID();
    const payload = { channelName: channel.name, liveUrl };

    await db.insert(notificationJobs).values({
      id: jobId,
      userId: member.userId,
      eventType: "channel_go_live",
      channel: "email",
      payload,
    });

    await boss.send(JOB_QUEUES.NOTIFICATION_SEND, {
      jobId,
      userId: member.userId,
      email: member.email,
      name: member.name,
      eventType: "channel_go_live",
      payload,
    });

    enqueued++;
  }

  // Arm the cooldown only after a successful dispatch pass — a throw above (DB /
  // boss outage) leaves the cooldown unset so a retry of a genuine go-live can
  // still deliver, rather than being silently suppressed for the window.
  lastDispatchedAt.set(channelId, nowMs);

  rootLogger.info({ channelId, audienceSize: audience.length, enqueued }, "channel-go-live dispatched");
};
