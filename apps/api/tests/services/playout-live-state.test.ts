import { describe, it, expect, beforeEach } from "vitest";

// playout-live-state is a process-singleton module; import directly (no mocking needed).
// Tests reset state between runs via setAiringSource("unknown").
import {
  getAiringSource,
  setAiringSource,
} from "../../src/services/playout-live-state.js";

describe("playout-live-state", () => {
  beforeEach(() => {
    // Reset to sentinel value before each test — module is a singleton
    setAiringSource("unknown");
  });

  it("returns 'unknown' before any switch event", () => {
    expect(getAiringSource()).toBe("unknown");
  });

  it("records 'live' when set", () => {
    setAiringSource("live");
    expect(getAiringSource()).toBe("live");
  });

  it("records 'queue' when set", () => {
    setAiringSource("queue");
    expect(getAiringSource()).toBe("queue");
  });

  it("records 'fallback' when set", () => {
    setAiringSource("fallback");
    expect(getAiringSource()).toBe("fallback");
  });

  it("reflects the latest value after multiple switches", () => {
    setAiringSource("live");
    setAiringSource("queue");
    setAiringSource("fallback");
    setAiringSource("live");
    expect(getAiringSource()).toBe("live");
  });
});
