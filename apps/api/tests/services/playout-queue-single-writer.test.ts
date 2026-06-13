/**
 * Structural single-writer invariant test.
 *
 * This test enforces the epic's grep-detectable invariant:
 * `playout_queue.status` writes (set({ status: ...) against the playoutQueue
 * table, and live-row creations (insert(playoutQueue) with status literals)
 * must appear ONLY in `apps/api/src/services/playout-queue-transitions.ts`.
 *
 * Stray writes introduced elsewhere become a CI failure rather than a silent
 * convention violation. The allowlist covers the schema file (defines the
 * status column default) and test files (which are scanned separately below).
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, it, expect } from "vitest";

// ── Path setup ──

// Resolve src root relative to this test file (tests/services/ → ../../src)
const SRC_ROOT = resolve(import.meta.dirname, "../../src");
const TRANSITIONS_MODULE = resolve(
  import.meta.dirname,
  "../../src/services/playout-queue-transitions.ts",
);
// Relative path for readable test output
const TRANSITIONS_REL = "apps/api/src/services/playout-queue-transitions.ts";

// Schema file — allowlisted (defines status column default, not a lifecycle write)
const SCHEMA_FILE = resolve(
  import.meta.dirname,
  "../../src/db/schema/playout-queue.schema.ts",
);

// ── FS walker ──

/** Recursively collect all .ts files under a directory. */
const walkTs = (dir: string): string[] => {
  const entries = readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkTs(full));
    } else if (entry.isFile() && entry.name.endsWith(".ts")) {
      files.push(full);
    }
  }
  return files;
};

// ── Heuristics ──

/**
 * Status-write heuristic A: file contains both `playoutQueue` (reference to the
 * table) and `set({ status:` (Drizzle update set clause). This catches:
 *   db.update(playoutQueue).set({ status: "played" | "playing" | "queued" })
 *
 * Allowlist: schema file (declares the column), transitions module (the owner).
 */
const hasStatusSetWrite = (content: string): boolean =>
  content.includes("playoutQueue") && content.includes("set({ status:");

/**
 * Status-write heuristic B: file contains `insert(playoutQueue)` and a status
 * literal used as an insert value: `status: "queued"`, `status: "playing"`, or
 * `status: "played"`. This catches:
 *   db.insert(playoutQueue).values({ ..., status: "queued", ... })
 *
 * Allowlist: schema file (default value declaration), transitions module (the owner).
 */
const hasStatusInsertWrite = (content: string): boolean =>
  content.includes("insert(playoutQueue)") &&
  (content.includes('status: "queued"') ||
    content.includes('status: "playing"') ||
    content.includes('status: "played"'));

// ── Tests ──

describe("playout-queue single-writer invariant", () => {
  const allSrcFiles = walkTs(SRC_ROOT);

  it("status-set writes (set({ status:) against playoutQueue appear only in transitions module", () => {
    const violators = allSrcFiles.filter((f) => {
      if (f === TRANSITIONS_MODULE) return false; // the authorized owner
      if (f === SCHEMA_FILE) return false; // allowlisted
      const content = readFileSync(f, "utf-8");
      return hasStatusSetWrite(content);
    });

    expect(
      violators.map((f) => f.replace(SRC_ROOT, "src")),
      `Files with set({ status: ...) on playoutQueue outside ${TRANSITIONS_REL}`,
    ).toHaveLength(0);
  });

  it("status insert-value literals in insert(playoutQueue) appear only in transitions module", () => {
    const violators = allSrcFiles.filter((f) => {
      if (f === TRANSITIONS_MODULE) return false; // the authorized owner
      if (f === SCHEMA_FILE) return false; // allowlisted
      const content = readFileSync(f, "utf-8");
      return hasStatusInsertWrite(content);
    });

    expect(
      violators.map((f) => f.replace(SRC_ROOT, "src")),
      `Files with insert(playoutQueue) + status literal outside ${TRANSITIONS_REL}`,
    ).toHaveLength(0);
  });

  it("transitions module itself passes both heuristics (tripwire self-check)", () => {
    const content = readFileSync(TRANSITIONS_MODULE, "utf-8");
    // The module must contain both patterns — if it doesn't the heuristics are broken
    expect(hasStatusSetWrite(content)).toBe(true);
    expect(hasStatusInsertWrite(content)).toBe(true);
  });

  it("cleanup job is not flagged (it deletes terminal rows, never writes status)", () => {
    const cleanupJob = resolve(
      import.meta.dirname,
      "../../src/jobs/handlers/playout-queue-cleanup.ts",
    );
    // File should exist
    expect(() => statSync(cleanupJob)).not.toThrow();

    const content = readFileSync(cleanupJob, "utf-8");
    // The cleanup job must not trigger either heuristic — it never writes status
    expect(hasStatusSetWrite(content)).toBe(false);
    expect(hasStatusInsertWrite(content)).toBe(false);
  });
});
