import { createElement } from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";

import { extractRouteComponent } from "../../helpers/route-test-utils.js";
import { createRouterMock } from "../../helpers/router-mock.js";

// ── Hoisted Mocks ──

const { mockIsFeatureEnabled, mockUseLoaderData, mockUseSearch } = vi.hoisted(() => ({
  mockIsFeatureEnabled: vi.fn(),
  mockUseLoaderData: vi.fn(),
  mockUseSearch: vi.fn(),
}));

vi.mock("../../../src/lib/config.js", () => ({
  DEMO_MODE: false,
  features: {},
  isFeatureEnabled: mockIsFeatureEnabled,
}));

vi.mock("@tanstack/react-router", () =>
  createRouterMock({ useLoaderData: mockUseLoaderData, useSearch: mockUseSearch }),
);

vi.mock("@vidstack/react", () => ({
  MediaPlayer: (props: Record<string, unknown>) =>
    createElement("div", { "data-testid": "media-player", "data-src": props.src }),
  MediaProvider: () => createElement("div", { "data-testid": "media-provider" }),
}));

vi.mock("../../../src/lib/api-server.js", () => ({
  fetchApiServer: vi.fn(),
}));

vi.mock("../../../src/lib/fetch-utils.js", () => ({
  apiGet: vi.fn().mockResolvedValue({ rooms: [] }),
  throwIfNotOk: vi.fn(),
}));

// Mock GlobalPlayerProvider/useGlobalPlayer — live route calls actions on channel selection
vi.mock("../../../src/contexts/global-player-context.js", () => ({
  useGlobalPlayer: () => ({
    state: { media: null, activeDetailId: null, liveLayout: null, chatCollapsed: false },
    presentation: "hidden",
    actions: {
      play: vi.fn(),
      clear: vi.fn(),
      setActiveDetail: vi.fn(),
      setLiveLayout: vi.fn(),
      setChatCollapsed: vi.fn(),
    },
    chatPortalRef: { current: null },
  }),
}));

// Mock ChatProvider to avoid WebSocket connections in tests
vi.mock("../../../src/contexts/chat-context.js", () => ({
  ChatProvider: ({ children }: { children: unknown }) =>
    createElement("div", { "data-testid": "chat-provider" }, children as never),
  useChat: () => ({
    state: {
      rooms: [],
      activeRoomId: null,
      messages: [],
      hasMore: false,
      isConnected: false,
    },
    actions: {
      joinRoom: vi.fn(),
      leaveRoom: vi.fn(),
      sendMessage: vi.fn(),
      setActiveRoom: vi.fn(),
      setRooms: vi.fn(),
    },
  }),
}));

// Mock ChatPanel to avoid scrollIntoView and other browser APIs not available in jsdom
vi.mock("../../../src/components/chat/chat-panel.js", () => ({
  ChatPanel: () => createElement("div", { "data-testid": "chat-panel" }),
}));

// ── Component Under Test ──

const LivePage = extractRouteComponent(() => import("../../../src/routes/live.js"));

// ── Test Lifecycle ──

beforeEach(() => {
  mockIsFeatureEnabled.mockReturnValue(true);
  mockUseSearch.mockReturnValue({});
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ── Helpers ──

function makeChannel(overrides: Record<string, unknown> = {}) {
  return {
    id: "channel-1",
    name: "S/NC Radio",
    type: "playout" as const,
    thumbnailUrl: null,
    hlsUrl: "https://stream.example.com/live.m3u8",
    viewerCount: 42,
    creator: null,
    startedAt: null,
    ...overrides,
  };
}

function makeChannelList(overrides: Record<string, unknown> = {}) {
  const channel = makeChannel();
  return {
    channels: [channel],
    defaultChannelId: channel.id,
    ...overrides,
  };
}

// ── Tests ──

describe("LivePage", () => {
  it("renders Coming Soon when channels is empty", () => {
    mockUseLoaderData.mockReturnValue({
      initial: { channels: [], defaultChannelId: null },
    });

    render(<LivePage />);

    expect(screen.getByRole("heading", { level: 1, name: "Coming Soon" })).toBeInTheDocument();
    expect(screen.getByText("Live streaming is on its way. Stay tuned.")).toBeInTheDocument();
  });

  it("does not render Coming Soon while loading (initial is null)", () => {
    mockUseLoaderData.mockReturnValue({ initial: null });

    render(<LivePage />);

    // When initial is null, isLoading is true — Coming Soon deferred until fetch completes
    expect(screen.queryByRole("heading", { level: 1, name: "Coming Soon" })).not.toBeInTheDocument();
  });

  it("renders channel selector when channels are active", () => {
    mockUseLoaderData.mockReturnValue({
      initial: makeChannelList(),
    });

    render(<LivePage />);

    expect(screen.getByRole("combobox", { name: "Select channel" })).toBeInTheDocument();
  });

  it("seeds selected channel from URL ?channel= search param (priority over defaultChannelId)", () => {
    mockUseSearch.mockReturnValue({ channel: "url-channel" });
    mockUseLoaderData.mockReturnValue({
      initial: {
        channels: [
          makeChannel({ id: "url-channel", name: "URL Channel", viewerCount: 99 }),
          makeChannel({ id: "default-channel", name: "Default", viewerCount: 42 }),
        ],
        defaultChannelId: "default-channel",
      },
    });

    render(<LivePage />);

    // URL channel is selected — its viewer count renders in both the hero panel
    // and its dropdown option; the default channel only renders once (its option).
    // So URL-selected count appears strictly more than the default's.
    expect(screen.getAllByText(/99 viewers/).length).toBeGreaterThan(
      screen.queryAllByText(/42 viewers/).length,
    );
  });

  it("shows viewer count for selected channel", () => {
    mockUseLoaderData.mockReturnValue({
      initial: makeChannelList(),
    });

    render(<LivePage />);

    expect(screen.getAllByText(/42 viewers/).length).toBeGreaterThan(0);
  });

  it("shows singular 'viewer' for count of 1", () => {
    mockUseLoaderData.mockReturnValue({
      initial: makeChannelList({
        channels: [makeChannel({ viewerCount: 1 })],
      }),
    });

    render(<LivePage />);

    expect(screen.getAllByText(/1 viewer/).length).toBeGreaterThan(0);
  });

  it("shows LIVE indicator only for live channels", () => {
    mockUseLoaderData.mockReturnValue({
      initial: makeChannelList({
        channels: [makeChannel({ type: "live" })],
      }),
    });

    render(<LivePage />);

    expect(screen.getByText("LIVE")).toBeInTheDocument();
  });

  it("does not show LIVE indicator for playout channels", () => {
    mockUseLoaderData.mockReturnValue({
      initial: makeChannelList(),
    });

    render(<LivePage />);

    expect(screen.queryByText("LIVE")).toBeNull();
  });

  it("shows creator name for live channel with creator", () => {
    mockUseLoaderData.mockReturnValue({
      initial: makeChannelList({
        channels: [
          makeChannel({
            type: "live",
            creator: {
              id: "creator-1",
              displayName: "Test Creator",
              handle: "test",
              avatarUrl: null,
            },
          }),
        ],
      }),
    });

    render(<LivePage />);

    expect(screen.getByText("Test Creator")).toBeInTheDocument();
  });

  it("does not show creator bar when channel has no creator", () => {
    mockUseLoaderData.mockReturnValue({
      initial: makeChannelList({ channels: [makeChannel({ creator: null })] }),
    });

    render(<LivePage />);

    expect(screen.queryByRole("img")).toBeNull();
  });

  it("shows avatar when creator has avatarUrl", () => {
    mockUseLoaderData.mockReturnValue({
      initial: makeChannelList({
        channels: [
          makeChannel({
            type: "live",
            creator: {
              id: "creator-1",
              displayName: "Test Creator",
              handle: "test",
              avatarUrl: "/api/creators/creator-1/avatar",
            },
          }),
        ],
      }),
    });

    render(<LivePage />);

    // Avatar has alt="" so role is "presentation" — query by src attribute
    const avatar = document.querySelector("img[src='/api/creators/creator-1/avatar']");
    expect(avatar).toBeInTheDocument();
  });

  it("lists all channels in the selector dropdown", () => {
    mockUseLoaderData.mockReturnValue({
      initial: {
        channels: [
          makeChannel({ id: "ch-1", name: "S/NC Radio", viewerCount: 10 }),
          makeChannel({ id: "ch-2", name: "Live: Maya", type: "live", viewerCount: 5 }),
        ],
        defaultChannelId: "ch-1",
      },
    });

    render(<LivePage />);

    expect(screen.getByRole("option", { name: /S\/NC Radio/ })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /Live: Maya/ })).toBeInTheDocument();
  });

  it("does not show Also Live section (removed in channel model)", () => {
    mockUseLoaderData.mockReturnValue({
      initial: makeChannelList(),
    });

    render(<LivePage />);

    expect(screen.queryByText("Also Live")).toBeNull();
  });
});
