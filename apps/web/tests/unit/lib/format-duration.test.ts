import { describe, it, expect } from "vitest";

import { formatDuration, formatSeconds } from "../../../src/lib/format-duration.js";

describe("formatDuration", () => {
  it("formats durations under an hour as MM:SS", () => {
    expect(formatDuration(0)).toBe("00:00");
    expect(formatDuration(5)).toBe("00:05");
    expect(formatDuration(90)).toBe("01:30");
  });

  it("formats durations of at least an hour as H:MM:SS", () => {
    expect(formatDuration(3600)).toBe("1:00:00");
    expect(formatDuration(3661)).toBe("1:01:01");
    expect(formatDuration(7325)).toBe("2:02:05");
  });

  it("floors fractional seconds", () => {
    expect(formatDuration(90.9)).toBe("01:30");
  });
});

describe("formatSeconds", () => {
  it("delegates to the shared duration formatter", () => {
    expect(formatSeconds(3661)).toBe(formatDuration(3661));
  });
});
