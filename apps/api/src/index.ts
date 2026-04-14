import { serve } from "@hono/node-server";

import { app } from "./app.js";
import { injectWebSocket } from "./ws.js";
import { seedOidcClients } from "./auth/seed-oidc-clients.js";
import { ensurePlatformRoom } from "./services/chat.js";
import { startBoss, stopBoss } from "./jobs/boss.js";
import { registerWorkers } from "./jobs/register-workers.js";
import { config } from "./config.js";
import { sql } from "./db/connection.js";
import { rootLogger } from "./logging/logger.js";

// ── Server ──

const server = serve({
  fetch: app.fetch,
  port: config.PORT,
});

injectWebSocket(server);

rootLogger.info({ port: config.PORT }, "Server started");

// ── Startup Tasks ──

seedOidcClients().catch((err) =>
  rootLogger.error(
    { error: err instanceof Error ? err.message : String(err) },
    "Failed to seed OIDC clients",
  ),
);

ensurePlatformRoom().catch((err) =>
  rootLogger.error(
    { error: err instanceof Error ? err.message : String(err) },
    "Failed to seed platform chat room",
  ),
);

startBoss()
  .then((boss) => registerWorkers(boss))
  .catch((err) =>
    rootLogger.error(
      { error: err instanceof Error ? err.message : String(err) },
      "Failed to start pg-boss",
    ),
  );

// ── Graceful Shutdown ──

let shuttingDown = false;

/**
 * Gracefully shut down the server, job queue, and database connection.
 * Prevents re-entry on multiple signals. Forces exit after 30 seconds
 * if cleanup hangs, closing all active connections including WebSockets.
 */
const shutdown = async () => {
  if (shuttingDown) return;
  shuttingDown = true;
  rootLogger.info("Shutdown initiated");

  // Hard timeout — force exit if any cleanup stage hangs
  const forceExit = setTimeout(() => {
    rootLogger.error("Shutdown timed out, forcing exit");
    if ("closeAllConnections" in server) {
      server.closeAllConnections();
    }
    process.exit(1);
  }, 30_000);
  forceExit.unref(); // Don't keep process alive just for this timer

  // Stop accepting new connections
  server.close();

  try {
    rootLogger.info("Stopping job queue...");
    await stopBoss();
  } catch (e) {
    rootLogger.error({ err: e }, "Error stopping job queue");
  }

  try {
    rootLogger.info("Closing database connection...");
    await sql.end({ timeout: 10 });
  } catch (e) {
    rootLogger.error({ err: e }, "Error closing database");
  }

  clearTimeout(forceExit);
  rootLogger.info("Shutdown complete");
  process.exit(0);
};

process.on("SIGTERM", () => void shutdown());
process.on("SIGINT", () => void shutdown());
