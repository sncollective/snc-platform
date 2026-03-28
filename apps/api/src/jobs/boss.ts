import { PgBoss } from "pg-boss";

import { config } from "../config.js";
import { rootLogger } from "../logging/logger.js";

// ── Module-Level Instance ──

let boss: PgBoss | null = null;

// ── Public API ──

/**
 * Get the active pg-boss instance.
 * Returns null if not yet started — call startBoss() during server init.
 */
export const getBoss = (): PgBoss | null => boss;

/**
 * Start the pg-boss job queue. Called once during server startup.
 * Creates pgboss schema and tables in PostgreSQL automatically on first call.
 * Returns the existing instance if already started (idempotent).
 */
export const startBoss = async (): Promise<PgBoss> => {
  if (boss) return boss;

  boss = new PgBoss({
    connectionString: config.DATABASE_URL,
    schema: "pgboss",
    schedule: false,
  });

  boss.on("error", (err) => {
    rootLogger.error(
      { error: err instanceof Error ? err.message : String(err) },
      "pg-boss error",
    );
  });

  await boss.start();
  rootLogger.info("pg-boss started");

  return boss;
};

/**
 * Stop the pg-boss instance gracefully. Called during server shutdown.
 * Waits up to 30 seconds for in-progress jobs to complete before stopping.
 * Safe to call when not started (no-op).
 */
export const stopBoss = async (): Promise<void> => {
  if (!boss) return;
  await boss.stop();
  rootLogger.info("pg-boss stopped");
  boss = null;
};
