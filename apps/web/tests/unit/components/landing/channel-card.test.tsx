import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { Channel } from "@snc/shared";

import { createRouterMock } from "../../../helpers/router-mock.js";

// ── Hoisted Mocks ──

vi.mock("@tanstack/react-router", () => createRouterMock());

// ── Import component under test (after mocks) ──

import { ChannelCard } from "../../../../src/components/landing/channel-card.js";

// ── Fixtures ──

function makeMockChannel(overrides?: Partial<Channel>): Channel {
  return {
    id: "channel-1",
    name: "Test Channel",
    type: "playout",
    thumbnailUrl: null,
    hlsUrl: null,
    viewerCount: 0,
    creator: {
      id: "user-1",
      displayName: "Test Creator",
      handle: "test-creator",
      avatarUrl: null,
    },
    startedAt: null,
    nowPlaying: {
      itemId: "item-1",
      title: "Now Playing Track",
      year: 2024,
      director: null,
      duration: 3600,
      elapsed: 300,
      remaining: 3300,
    },
    ...overrides,
  };
}

// ── Tests ──

describe("ChannelCard", () => {
  it("playout channel shows 'NOW PLAYING' badge and track title", () => {
    const channel = makeMockChannel({
      type: "playout",
      nowPlaying: {
        itemId: "item-1",
        title: "Great Film",
        year: 2023,
        director: null,
        duration: 7200,
        elapsed: 600,
        remaining: 6600,
      },
    });

    render(<ChannelCard channel={channel} />);

    expect(screen.getByText("NOW PLAYING")).toBeInTheDocument();
    expect(screen.getByText("Great Film")).toBeInTheDocument();
  });

  it("live channel shows LIVE badge and viewer count", () => {
    const channel = makeMockChannel({
      type: "live",
      viewerCount: 42,
    });

    render(<ChannelCard channel={channel} />);

    expect(screen.getByText("LIVE")).toBeInTheDocument();
    expect(screen.getByText("42 watching")).toBeInTheDocument();
  });

  it("zero viewers hides viewer count", () => {
    const channel = makeMockChannel({
      type: "live",
      viewerCount: 0,
    });

    render(<ChannelCard channel={channel} />);

    expect(screen.getByText("LIVE")).toBeInTheDocument();
    expect(screen.queryByText(/watching/)).not.toBeInTheDocument();
  });
});
