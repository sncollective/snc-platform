import { writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { and, eq, inArray, or } from "drizzle-orm";
import { AppError, ok, err } from "@snc/shared";
import type { Result } from "@snc/shared";

import { db } from "../db/connection.js";
import { channels } from "../db/schema/streaming.schema.js";
import { buildPlayoutTopology } from "./playout-topology.js";
import { getAllEditorialConfigs } from "./editorial-config.js";
import { renderPlayoutLiq } from "./liquidsoap-render.js";
import { eventBus } from "./event-bus.js";
import { config } from "../config.js";
import { rootLogger } from "../logging/logger.js";

// ── Config Path ──

/** Repo-root `liquidsoap/` dir, resolved from this module's location so the default
 * holds at any clone/mount path. The dir is volume-mounted into the liquidsoap container. */
const DEFAULT_LIQUIDSOAP_DIR = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../../../liquidsoap",
);

/**
 * Path to the Liquidsoap config file (mounted volume).
 *
 * Defaults to the repo's `liquidsoap/` dir; override via `LIQUIDSOAP_CONFIG_DIR`.
 * Exported for the portability regression test.
 */
export const getLiquidsoapConfigPath = (): string =>
  resolve(config.LIQUIDSOAP_CONFIG_DIR ?? DEFAULT_LIQUIDSOAP_DIR, "playout.liq");

// ── Logger ──

const logger = rootLogger.child({ service: "liquidsoap-config" });

// ── Public API ──

interface LiquidsoapChannelRow {
  readonly id: string;
  readonly name: string;
  readonly srsStreamName: string;
  readonly ownership: string;
  readonly creatorId: string | null;
  readonly role?: string;
}

/**
 * E2E is the only runtime profile that renders creator live-ingest rows into
 * Liquidsoap. It reuses the existing explicit test-profile switch shape rather
 * than inferring from broad NODE_ENV-style environments.
 */
const includeCreatorLiveIngestChannels = (): boolean =>
  config.TEST_CONTROL_PROFILE === "e2e";

const shouldRenderChannel = (row: LiquidsoapChannelRow): boolean => {
  const role = row.role ?? "playout";
  return role === "playout" ||
    role === "broadcast" ||
    (includeCreatorLiveIngestChannels() &&
      role === "live-ingest" &&
      row.ownership === "creator");
};

/**
 * Generate the full playout.liq content from database state.
 * Returns the file content as a string.
 *
 * Thin composition: query active playout channels + editorial configs, build the
 * typed topology, render. The topology and render layers are pure (see
 * playout-topology.ts / liquidsoap-render.ts); this module owns the IO edges only.
 */
export const generateLiquidsoapConfig = async (): Promise<string> => {
  const renderCreatorLiveIngest = includeCreatorLiveIngestChannels();
  const channelRolePredicate = renderCreatorLiveIngest
    ? or(
        // Broadcast (S/NC TV) renders through the unified topology as a generated
        // channel block — it is no longer a static tail. Playout channels are the
        // ordinary content channels. Both reach buildPlayoutTopology.
        inArray(channels.role, ["playout", "broadcast"]),
        and(eq(channels.role, "live-ingest"), eq(channels.ownership, "creator")),
      )
    : inArray(channels.role, ["playout", "broadcast"]);

  const [queriedChannels, editorialConfigsResult] = await Promise.all([
    db
      .select({
        id: channels.id,
        name: channels.name,
        srsStreamName: channels.srsStreamName,
        ownership: channels.ownership,
        creatorId: channels.creatorId,
        role: channels.role,
      })
      .from(channels)
      .where(
        and(
          channelRolePredicate,
          eq(channels.isActive, true),
        ),
      ),
    getAllEditorialConfigs(),
  ]);

  // Keep the safe-by-default inclusion rule enforced in-process as well as in the
  // SQL predicate, so tests can characterize the profile split without a real DB.
  const playoutChannels = (queriedChannels as LiquidsoapChannelRow[]).filter(shouldRenderChannel);

  // Editorial configs are best-effort: a failure here degrades gracefully to
  // config-less (queue-only) defaults for all channels rather than blocking
  // config generation.
  const editorialConfigs = editorialConfigsResult.ok
    ? editorialConfigsResult.value
    : [];

  if (!editorialConfigsResult.ok) {
    logger.warn(
      { error: editorialConfigsResult.error.message },
      "Failed to load editorial configs — falling back to queue-only defaults",
    );
  }

  logger.info({ channelCount: playoutChannels.length }, "Generating Liquidsoap config");

  return renderPlayoutLiq(buildPlayoutTopology(playoutChannels, editorialConfigs));
};

/**
 * Write generated config to disk and signal Liquidsoap to restart.
 * Returns ok on success, err if write or restart signal fails.
 */
export const regenerateAndRestart = async (): Promise<Result<void, AppError>> => {
  const configPath = getLiquidsoapConfigPath();

  try {
    const configContent = await generateLiquidsoapConfig();
    await writeFile(configPath, configContent, "utf-8");
    logger.info({ path: configPath }, "Liquidsoap config written");
  } catch (e) {
    logger.error({ error: e instanceof Error ? e.message : String(e) }, "Failed to write Liquidsoap config");
    return err(new AppError("CONFIG_WRITE_FAILED", "Failed to write playout config", 500));
  }

  // Signal Liquidsoap to restart via harbor shutdown endpoint
  const baseUrl = config.LIQUIDSOAP_API_URL;
  if (!baseUrl) {
    logger.warn("LIQUIDSOAP_API_URL not configured — config written but restart not signaled");
    return ok(undefined);
  }

  try {
    const secret = config.PLAYOUT_CALLBACK_SECRET ?? "";
    const res = await fetch(`${baseUrl}/admin/shutdown?secret=${encodeURIComponent(secret)}`, {
      method: "POST",
      signal: AbortSignal.timeout(5000),
    });
    // Liquidsoap may close the connection before responding (shutdown is immediate)
    // Both 200 and connection reset are acceptable
    if (res.ok) {
      logger.info("Liquidsoap shutdown signaled — container will restart with new config");
    }
  } catch (e) {
    // Connection reset is expected — shutdown kills the process
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("fetch failed") || msg.includes("ECONNRESET") || msg.includes("ECONNREFUSED")) {
      logger.info("Liquidsoap shutdown signaled (connection closed)");
    } else {
      logger.error({ error: msg }, "Failed to signal Liquidsoap restart");
      return err(new AppError("RESTART_SIGNAL_FAILED", "Failed to signal playout engine restart", 502));
    }
  }

  try {
    eventBus.publish({ type: "playout.engine-restarted" });
  } catch {
    // fire-and-forget: publish must never fail regenerateAndRestart
  }

  return ok(undefined);
};

/**
 * Write the generated config to disk without signaling a restart.
 * Used on API startup — Liquidsoap reads the file on its own startup.
 */
export const writeConfigOnly = async (): Promise<void> => {
  const configPath = getLiquidsoapConfigPath();
  try {
    const configContent = await generateLiquidsoapConfig();
    await writeFile(configPath, configContent, "utf-8");
    logger.info({ path: configPath }, "Liquidsoap config written on startup");
  } catch (e) {
    logger.error({ error: e instanceof Error ? e.message : String(e) }, "Failed to write Liquidsoap config on startup");
    // Non-fatal — API continues without restarting Liquidsoap
  }
};

/**
 * Wait for Liquidsoap to become healthy after restart.
 * Polls the health endpoint up to maxAttempts times.
 */
export const waitForHealth = async (
  maxAttempts = 10,
  intervalMs = 2000,
): Promise<boolean> => {
  const baseUrl = config.LIQUIDSOAP_API_URL;
  if (!baseUrl) return true; // No Liquidsoap configured — vacuously healthy

  for (let i = 0; i < maxAttempts; i++) {
    try {
      const res = await fetch(`${baseUrl}/health`, {
        signal: AbortSignal.timeout(2000),
      });
      if (res.ok) return true;
    } catch {
      // Not ready yet
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  return false;
};
