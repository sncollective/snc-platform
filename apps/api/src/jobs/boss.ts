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
 * Races a 15-second timeout against boss.stop() — logs a warning and
 * continues if the timeout wins. Safe to call when not started (no-op).
 */
export const stopBoss = async (): Promise<void> => {
  if (!boss) return;

  const stopTimeout = new Promise<void>((resolve) =>
    setTimeout(() => {
      rootLogger.warn("pg-boss stop timed out, continuing shutdown");
      resolve();
    }, 15_000),
  );

  try {
    await Promise.race([boss.stop(), stopTimeout]);
  } catch (e) {
    rootLogger.error({ err: e }, "pg-boss stop error");
  }

  rootLogger.info("pg-boss stopped");
  boss = null;
};
