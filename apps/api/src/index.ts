import { serve } from "@hono/node-server";

import { app } from "./app.js";
import { seedOidcClients } from "./auth/seed-oidc-clients.js";
import { config } from "./config.js";
import { sql } from "./db/connection.js";
import { rootLogger } from "./logging/logger.js";

// ── Server ──

const server = serve({
  fetch: app.fetch,
  port: config.PORT,
});

rootLogger.info({ port: config.PORT }, "Server started");

seedOidcClients().catch((err) =>
  rootLogger.error(
    { error: err instanceof Error ? err.message : String(err) },
    "Failed to seed OIDC clients",
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
    await sql.end();
    process.exit(0);
  });
};

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
