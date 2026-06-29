import { describe, expect, it } from "vitest";
import type { TestInfo } from "@playwright/test";

import {
  E2E_FIXED_FIXTURE_TIMESTAMP_ISO,
  fixedFixtureDate,
  seededSuffix,
  stableTestId,
  testSeededSuffix,
} from "./determinism.js";

const fakeTestInfo = (
  projectName: string,
  titlePath: readonly string[],
  options: { repeatEachIndex?: number; parallelIndex?: number } = {},
): TestInfo =>
  ({
    project: { name: projectName },
    titlePath: [...titlePath],
    repeatEachIndex: options.repeatEachIndex ?? 0,
    parallelIndex: options.parallelIndex ?? 0,
  }) as unknown as TestInfo;

describe("seededSuffix", () => {
  it("returns deterministic bounded hashes for string and array seeds", () => {
    expect(seededSuffix("fixture-family")).toBe(seededSuffix(["fixture-family"]));
    expect(seededSuffix(["fixture-family", "row-a"], 6)).toHaveLength(6);
    expect(seededSuffix(["fixture-family", "row-a"])).not.toBe(
      seededSuffix(["fixture-family", "row-b"]),
    );
  });

  it("rejects suffix lengths too short to be useful", () => {
    expect(() => seededSuffix("fixture-family", 3)).toThrow(
      "Deterministic e2e suffix length must be at least 4 characters",
    );
  });
});

describe("testSeededSuffix", () => {
  it("is deterministic and partitions project, repeat, parallel worker, and extra parts", () => {
    const base = fakeTestInfo("chromium", ["creator programming", "queues"]);

    expect(testSeededSuffix(base, "pool-row")).toBe(testSeededSuffix(base, "pool-row"));
    expect(testSeededSuffix(base, "pool-row")).not.toBe(
      testSeededSuffix(fakeTestInfo("mobile", ["creator programming", "queues"]), "pool-row"),
    );
    expect(testSeededSuffix(base, "pool-row")).not.toBe(
      testSeededSuffix(
        fakeTestInfo("chromium", ["creator programming", "queues"], { parallelIndex: 1 }),
        "pool-row",
      ),
    );
    expect(testSeededSuffix(base, "pool-row")).not.toBe(testSeededSuffix(base, "other-row"));
  });
});

describe("stableTestId", () => {
  it("is deterministic, readable, bounded, and separates worker/project seeds", () => {
    const chromium = fakeTestInfo("chromium", ["creator programming", "queue takes over"]);
    const mobile = fakeTestInfo("mobile", ["creator programming", "queue takes over"]);
    const otherWorker = fakeTestInfo("chromium", ["creator programming", "queue takes over"], {
      parallelIndex: 2,
    });

    const id = stableTestId(chromium, "pool row", {
      prefix: "creator-programming",
      maxLength: 48,
    });

    expect(id).toBe(
      stableTestId(chromium, "pool row", { prefix: "creator-programming", maxLength: 48 }),
    );
    expect(id).toMatch(/^creator-programming-chromium-pool-row-[a-f0-9]{10}$/);
    expect(id.length).toBeLessThanOrEqual(48);
    expect(id).not.toBe(
      stableTestId(mobile, "pool row", { prefix: "creator-programming", maxLength: 48 }),
    );
    expect(id).not.toBe(
      stableTestId(otherWorker, "pool row", { prefix: "creator-programming", maxLength: 48 }),
    );
  });

  it("truncates long readable prefixes while preserving the deterministic suffix", () => {
    const id = stableTestId(
      fakeTestInfo("chromium", ["very long title path"], { repeatEachIndex: 1 }),
      "this label is intentionally long",
      { prefix: "creator-programming-fixture-family", maxLength: 32 },
    );

    expect(id).toHaveLength(32);
    expect(id).toMatch(/-[a-f0-9]{10}$/);
  });

  it("rejects maxLength values that leave no room for the suffix", () => {
    expect(() =>
      stableTestId(fakeTestInfo("chromium", ["case"]), "pool-row", { maxLength: 11 }),
    ).toThrow("Stable e2e test ID maxLength must leave room for the deterministic suffix");
  });
});

describe("fixedFixtureDate", () => {
  it("returns fresh Date instances at the canonical fixture timestamp", () => {
    const first = fixedFixtureDate();
    const second = fixedFixtureDate();

    expect(first).toBeInstanceOf(Date);
    expect(first.toISOString()).toBe(E2E_FIXED_FIXTURE_TIMESTAMP_ISO);
    expect(second.toISOString()).toBe(E2E_FIXED_FIXTURE_TIMESTAMP_ISO);
    expect(first).not.toBe(second);
  });
});
