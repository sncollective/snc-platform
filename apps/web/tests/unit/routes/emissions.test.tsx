import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// Standing-copy contract (operator 2026-08-15): /emissions is an always-on prose page —
// no feature-flag gate, no API/loader dependency, draft copy visibly marked pending the
// human writing pass.
describe("emissions standing-copy page", () => {
  const source = readFileSync(
    resolve(import.meta.dirname, "../../../src/routes/emissions.tsx"),
    "utf-8",
  );

  it("has no loader or feature-flag dependency", () => {
    expect(source).not.toContain("loader:");
    expect(source).not.toContain("isFeatureEnabled");
    expect(source).not.toContain("fetchApiServer");
  });

  it("carries the visible draft-copy marker (copy governance)", () => {
    expect(source).toContain("Draft copy");
    expect(source).toContain("pending");
  });

  it("keeps canonical + og meta", () => {
    expect(source).toContain("canonical");
    expect(source).toContain("og:title");
  });
});
