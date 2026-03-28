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

const shutdown = () => {
  server.close(async (err) => {
    if (err) {
      rootLogger.error(
        { error: err instanceof Error ? err.message : String(err) },
        "Error during server shutdown",
      );
      process.exit(1);
    }
    await stopBoss();
    await sql.end();
    process.exit(0);
  });
};

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
