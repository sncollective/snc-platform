import { describe, it, expect } from "vitest";

import {
  CompleteJoinRequestSchema,
  PRIVACY_POLICY_VERSION,
} from "../src/index.js";

// ── CompleteJoinRequestSchema ──

describe("CompleteJoinRequestSchema", () => {
  it("accepts explicit consent with the current privacy policy version", () => {
    const result = CompleteJoinRequestSchema.parse({
      consent: true,
      policyVersion: PRIVACY_POLICY_VERSION,
    });

    expect(result).toStrictEqual({
      consent: true,
      policyVersion: PRIVACY_POLICY_VERSION,
    });
  });

  it("rejects stale privacy policy versions", () => {
    const result = CompleteJoinRequestSchema.safeParse({
      consent: true,
      policyVersion: "privacy-policy-1900-01-01",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ path: ["policyVersion"] }),
        ]),
      );
    }
  });
});
