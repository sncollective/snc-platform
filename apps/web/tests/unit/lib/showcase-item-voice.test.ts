import { describe, expect, it } from "vitest";

import {
  itemUnitStyle,
  resolveContentItemVoice,
  resolveEventItemVoice,
} from "../../../src/lib/showcase-item-voice.js";

describe("showcase item voice fallback", () => {
  it.each([
    ["audio", "records"],
    ["video", "tv"],
    ["podcast", "studio"],
    ["studio-audio", "studio"],
    ["written", "parent"],
    ["none", "parent"],
    [null, "parent"],
    [undefined, "parent"],
    ["future-type", "parent"],
  ] as const)("maps content type %s to %s", (contentType, expected) => {
    expect(resolveContentItemVoice(contentType)).toBe(expected);
  });

  it.each([
    ["show", "tv"],
    ["recording-session", "studio"],
    ["meeting", "parent"],
    [null, "parent"],
  ] as const)("maps event type %s to %s", (eventType, expected) => {
    expect(resolveEventItemVoice(eventType)).toBe(expected);
  });

  it("emits exact inline unit chains for mapped voices and no properties for parent", () => {
    expect(itemUnitStyle("tv")).toEqual({
      "--item-unit-accent": "var(--voice-tv-accent)",
      "--item-unit-bg": "var(--voice-tv-accent-bg)",
      "--item-unit-on-accent": "var(--voice-tv-on-accent)",
    });
    expect(itemUnitStyle("parent")).toBeUndefined();
  });
});
