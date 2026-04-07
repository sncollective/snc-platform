import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { Channel, ChannelListResponse } from "@snc/shared";

import { createRouterMock } from "../../../helpers/router-mock.js";

// ── Hoisted Mocks ──

vi.mock("@tanstack/react-router", () => createRouterMock());

// ── Import component under test (after mocks) ──

import { WhatsOn } from "../../../../src/components/landing/whats-on.js";

// ── Fixtures ──

function makeMockChannel(overrides?: Partial<Channel>): Channel {
  return {
    id: "channel-1",
    name: "Test Channel",
    type: "playout",
    thumbnailUrl: null,
    hlsUrl: null,
    viewerCount: 0,
    creator: null,
    startedAt: null,
    nowPlaying: null,
    ...overrides,
  };
}

function makeMockChannelList(channels: Channel[]): ChannelListResponse {
  return {
    channels,
    defaultChannelId: channels[0]?.id ?? null,
  };
}

// ── Tests ──

describe("WhatsOn", () => {
  it("renders channel cards when channels provided", () => {
    const channels = makeMockChannelList([
      makeMockChannel({ id: "ch-1", name: "Channel One" }),
      makeMockChannel({ id: "ch-2", name: "Channel Two" }),
    ]);

    render(<WhatsOn channels={channels} />);

    expect(screen.getByText("Channel One")).toBeInTheDocument();
    expect(screen.getByText("Channel Two")).toBeInTheDocument();
  });

  it("shows empty state for empty channels array", () => {
    render(<WhatsOn channels={{ channels: [], defaultChannelId: null }} />);

    expect(screen.getByText(/Nothing playing right now/)).toBeInTheDocument();
  });
});
