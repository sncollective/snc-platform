import { createHash } from "node:crypto";
import type { Page, TestInfo } from "@playwright/test";

/**
 * Canonical browser-visible clock for e2e specs that assert dates or relative time.
 *
 * Keep production code on real time. Specs opt into this value with `installFixedClock(page)`
 * before navigating to the surface under test, or pass this timestamp explicitly to e2e
 * fixture/test-control setup when backend rows need deterministic dates.
 */
export const E2E_FIXED_CLOCK_ISO = "2026-01-15T12:00:00.000Z";

/** Explicit timestamp for deterministic e2e fixture rows. */
export const E2E_FIXED_FIXTURE_TIMESTAMP_ISO = E2E_FIXED_CLOCK_ISO;

const DEFAULT_ID_PREFIX = "e2e";
const DEFAULT_SUFFIX_LENGTH = 10;
const DEFAULT_MAX_ID_LENGTH = 63;

export type StableTestIdOptions = {
  /** Human-readable prefix for the fixture family, for example `creator-programming`. */
  prefix?: string;
  /** Additional deterministic seed parts when one test creates multiple related fixtures. */
  parts?: readonly string[];
  /** Maximum length for stores with bounded identifier columns. */
  maxLength?: number;
};

const slugify = (value: string): string => {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug || "fixture";
};

const hashSeed = (parts: readonly string[], length = DEFAULT_SUFFIX_LENGTH): string => {
  if (length < 4) {
    throw new Error("Deterministic e2e suffix length must be at least 4 characters");
  }

  return createHash("sha256")
    .update(JSON.stringify(parts))
    .digest("hex")
    .slice(0, length);
};

const testInfoSeedParts = (testInfo: TestInfo): string[] => [
  testInfo.project.name,
  ...testInfo.titlePath,
  `repeat-${testInfo.repeatEachIndex}`,
  // parallelIndex is stable across worker restarts and prevents cross-worker collisions.
  `parallel-${testInfo.parallelIndex}`,
];

/**
 * Return a deterministic suffix for fixture names, tokens, and emails.
 *
 * Use this instead of `Date.now()` or `Math.random()` in e2e setup. The same seed produces
 * the same suffix on every run, so failing runs are reproducible and cleanup can target the
 * same fixture family precisely.
 */
export const seededSuffix = (
  seed: string | readonly string[],
  length = DEFAULT_SUFFIX_LENGTH,
): string => hashSeed(Array.isArray(seed) ? seed : [seed], length);

/**
 * Deterministic suffix scoped to the current Playwright test and project.
 *
 * The seed includes project name, title path, repeat index, and parallel worker slot so fixture
 * IDs are collision-safe when specs run in parallel against the shared e2e backend.
 */
export const testSeededSuffix = (
  testInfo: TestInfo,
  ...parts: readonly string[]
): string => seededSuffix([...testInfoSeedParts(testInfo), ...parts]);

/**
 * Build a stable, readable, bounded identifier for e2e fixture rows.
 *
 * Example:
 *
 * ```ts
 * const id = stableTestId(testInfo, "pool-row", { prefix: "creator-programming" });
 * ```
 */
export const stableTestId = (
  testInfo: TestInfo,
  label: string,
  options: StableTestIdOptions = {},
): string => {
  const prefix = options.prefix ?? DEFAULT_ID_PREFIX;
  const maxLength = options.maxLength ?? DEFAULT_MAX_ID_LENGTH;
  const seedParts = [...testInfoSeedParts(testInfo), label, ...(options.parts ?? [])];
  const suffix = hashSeed(seedParts);
  const readable = slugify(`${prefix}-${testInfo.project.name}-${label}`);
  const suffixWithSeparator = `-${suffix}`;

  if (maxLength <= suffixWithSeparator.length) {
    throw new Error("Stable e2e test ID maxLength must leave room for the deterministic suffix");
  }

  return `${readable.slice(0, maxLength - suffixWithSeparator.length)}${suffixWithSeparator}`;
};

/** Return a fresh Date instance for explicit fixture timestamps. */
export const fixedFixtureDate = (): Date => new Date(E2E_FIXED_FIXTURE_TIMESTAMP_ISO);

/**
 * Freeze browser-visible `Date.now()` / `new Date()` without pausing timers.
 *
 * Call before `page.goto()` for specs whose assertions depend on displayed dates or relative
 * time. This controls only the Playwright browser context; backend services and production code
 * continue to use their normal clocks unless the spec passes explicit fixture timestamps.
 */
export const installFixedClock = async (
  page: Page,
  time: string | number | Date = E2E_FIXED_CLOCK_ISO,
): Promise<void> => {
  await page.clock.setFixedTime(time);
};
