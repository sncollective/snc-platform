import { describe, it, expect } from "vitest";

import {
  FEATURE_FLAGS,
  ALL_FEATURES_ON,
  PRODUCTION_DEFAULTS,
  FEATURE_LABELS,
  type FeatureFlag,
  type FeatureFlags,
} from "../src/index.js";

describe("FEATURE_FLAGS", () => {
  it("contains 11 flag names", () => {
    expect(FEATURE_FLAGS).toHaveLength(11);
  });

  it("includes expected flags", () => {
    const expected: FeatureFlag[] = [
      "content",
      "creator",
      "subscription",
      "merch",
      "booking",
      "dashboard",
      "admin",
      "emissions",
      "calendar",
      "federation",
      "streaming",
    ];
    expect([...FEATURE_FLAGS]).toStrictEqual(expected);
  });
});

describe("ALL_FEATURES_ON", () => {
  it("has all keys set to true", () => {
    for (const flag of FEATURE_FLAGS) {
      expect(ALL_FEATURES_ON[flag]).toBe(true);
    }
  });

  it("has exactly the same keys as FEATURE_FLAGS", () => {
    expect(Object.keys(ALL_FEATURES_ON).sort()).toStrictEqual(
      [...FEATURE_FLAGS].sort(),
    );
  });
});

describe("PRODUCTION_DEFAULTS", () => {
  it("enables admin, calendar, and creator by default", () => {
    const expected: FeatureFlags = {
      content: false,
      creator: true,
      subscription: false,
      merch: false,
      booking: false,
      dashboard: false,
      admin: true,
      emissions: false,
      calendar: true,
      federation: false,
      streaming: false,
    };
    expect(PRODUCTION_DEFAULTS).toStrictEqual(expected);
  });

  it("has exactly the same keys as FEATURE_FLAGS", () => {
    expect(Object.keys(PRODUCTION_DEFAULTS).sort()).toStrictEqual(
      [...FEATURE_FLAGS].sort(),
    );
  });
});

describe("FEATURE_LABELS", () => {
  it("has exactly the same keys as FEATURE_FLAGS", () => {
    expect(Object.keys(FEATURE_LABELS).sort()).toStrictEqual(
      [...FEATURE_FLAGS].sort(),
    );
  });

  it("every entry has a non-empty name and description", () => {
    for (const flag of FEATURE_FLAGS) {
      const label = FEATURE_LABELS[flag];
      expect(label.name.length).toBeGreaterThan(0);
      expect(label.description.length).toBeGreaterThan(0);
    }
  });
});
