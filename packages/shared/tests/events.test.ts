import { describe, expect, it } from "vitest";

import { PlatformEventSchema, type PlatformEvent } from "../src/index.js";

const validEvents = [
  {
    type: "channel.live-state-changed",
    channelId: "channel-1",
    live: true,
  },
  {
    type: "playout.queue-changed",
    channelId: "channel-1",
  },
  {
    type: "playout.now-playing-changed",
    channelId: "channel-1",
  },
  {
    type: "playout.engine-restarted",
  },
  {
    type: "content.processing-status-changed",
    contentId: "content-1",
    creatorId: "creator-1",
    status: "ready",
  },
  {
    type: "content.playout-changed",
    channelId: "channel-1",
    creatorId: "creator-1",
    changeType: "queue",
  },
] satisfies PlatformEvent[];

describe("PlatformEventSchema", () => {
  it.each(validEvents)("parses $type events", (event) => {
    const result = PlatformEventSchema.safeParse(event);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toStrictEqual(event);
    }
  });

  it("rejects unknown event types", () => {
    const result = PlatformEventSchema.safeParse({
      type: "unknown.event",
      channelId: "channel-1",
    });

    expect(result.success).toBe(false);
  });
});
