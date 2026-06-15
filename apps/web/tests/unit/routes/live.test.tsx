import { createElement } from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, render, screen, fireEvent, waitFor } from "@testing-library/react";

import { extractRouteComponent } from "../../helpers/route-test-utils.js";
import { createRouterMock } from "../../helpers/router-mock.js";
import { FakeEventSource } from "../../helpers/fake-event-source.js";

// ── Hoisted Mocks ──

const { mockIsFeatureEnabled, mockUseLoaderData, mockUseSearch, mockApiGet } = vi.hoisted(() => ({
  mockIsFeatureEnabled: vi.fn(),
  mockUseLoaderData: vi.fn(),
  mockUseSearch: vi.fn(),
  mockApiGet: vi.fn<() => Promise<unknown>>().mockResolvedValue({ channels: [], defaultChannelId: null }),
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
  apiGet: mockApiGet,
  throwIfNotOk: vi.fn(),
}));

// ── Hoisted mock for setLiveMobileChatOpen ──
const { mockSetLiveMobileChatOpen } = vi.hoisted(() => ({
  mockSetLiveMobileChatOpen: vi.fn(),
}));

// Mock GlobalPlayerProvider/useGlobalPlayer — live route calls actions on channel selection
vi.mock("../../../src/contexts/global-player-context.js", () => ({
  useGlobalPlayer: () => ({
    state: { media: null, activeDetailId: null, liveLayout: null, chatCollapsed: false, liveMobileChatOpen: false },
    presentation: "hidden",
    actions: {
      play: vi.fn(),
      clear: vi.fn(),
      setActiveDetail: vi.fn(),
      setLiveLayout: vi.fn(),
      setChatCollapsed: vi.fn(),
      setLiveMobileChatOpen: mockSetLiveMobileChatOpen,
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
    ownership: "platform" as const,
    role: "playout" as const,
    thumbnailUrl: null,
    hlsUrl: "https://stream.example.com/live.m3u8",
    viewerCount: 42,
    creator: null,
    startedAt: null,
    nowPlaying: null,
    liveState: "offline" as const,
    ...overrides,
  };
}

/**
 * A live creator channel. The live page derives "is live" from the server's
 * `liveState` field (live-experience-redesign-live-state); a live fixture sets
 * `liveState: "live-creator"` (plus the matching identity for realism).
 */
function liveOverrides(extra: Record<string, unknown> = {}) {
  return {
    ownership: "creator" as const,
    role: "live-ingest" as const,
    liveState: "live-creator" as const,
    ...extra,
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
  it("renders offline placeholder when channels is empty and not loading", () => {
    mockUseLoaderData.mockReturnValue({
      initial: { channels: [], defaultChannelId: null },
    });

    render(<LivePage />);

    expect(screen.getByRole("heading", { level: 1, name: "Nothing live right now" })).toBeInTheDocument();
    expect(screen.getByText(/No channels are streaming at the moment/)).toBeInTheDocument();
    expect(screen.queryByText(/coming soon/i)).toBeNull();
  });

  it("renders calendar link in offline placeholder", () => {
    mockUseLoaderData.mockReturnValue({
      initial: { channels: [], defaultChannelId: null },
    });

    render(<LivePage />);

    const link = screen.getByRole("link", { name: "View the calendar" });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "/calendar");
  });

  it("renders channel zone skeleton while loading (initial is null)", () => {
    // Keep the fetch pending so isLoading stays true for the duration of the test
    mockApiGet.mockReturnValue(new Promise(() => {}));
    mockUseLoaderData.mockReturnValue({ initial: null });

    render(<LivePage />);

    // Skeleton renders synchronously before any fetch resolves
    expect(screen.getByRole("status", { name: "Loading channels" })).toBeInTheDocument();
    expect(screen.queryByText(/coming soon/i)).toBeNull();
    expect(screen.queryByRole("heading", { name: "Nothing live right now" })).toBeNull();
  });

  it("does not render offline placeholder while loading (initial is null)", () => {
    mockUseLoaderData.mockReturnValue({ initial: null });

    render(<LivePage />);

    // When initial is null, isLoading is true — offline state deferred until fetch completes
    expect(screen.queryByRole("heading", { name: "Nothing live right now" })).not.toBeInTheDocument();
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
        channels: [makeChannel(liveOverrides())],
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
          makeChannel(liveOverrides({
            creator: {
              id: "creator-1",
              displayName: "Test Creator",
              handle: "test",
              avatarUrl: null,
            },
          })),
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
          makeChannel(liveOverrides({
            creator: {
              id: "creator-1",
              displayName: "Test Creator",
              handle: "test",
              avatarUrl: "/api/creators/creator-1/avatar",
            },
          })),
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
          makeChannel(liveOverrides({ id: "ch-2", name: "Live: Maya", viewerCount: 5 })),
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

// ── Mobile Tab Bar Tests ──

describe("LivePage — MobileTabBar", () => {
  it("renders tablist with Info and Chat tabs when streaming", () => {
    mockUseLoaderData.mockReturnValue({
      initial: makeChannelList(),
    });

    render(<LivePage />);

    const tablist = screen.getByRole("tablist", { name: "Live page sections" });
    expect(tablist).toBeInTheDocument();

    const infoTab = screen.getByRole("tab", { name: "Info" });
    const chatTab = screen.getByRole("tab", { name: "Chat" });
    expect(infoTab).toBeInTheDocument();
    expect(chatTab).toBeInTheDocument();
  });

  it("Info tab is selected by default when streaming", () => {
    mockUseLoaderData.mockReturnValue({
      initial: makeChannelList(),
    });

    render(<LivePage />);

    const infoTab = screen.getByRole("tab", { name: "Info" });
    const chatTab = screen.getByRole("tab", { name: "Chat" });
    expect(infoTab).toHaveAttribute("aria-selected", "true");
    expect(chatTab).toHaveAttribute("aria-selected", "false");
  });

  it("clicking Chat tab calls setLiveMobileChatOpen with true", () => {
    mockSetLiveMobileChatOpen.mockClear();
    mockUseLoaderData.mockReturnValue({
      initial: makeChannelList(),
    });

    render(<LivePage />);

    const chatTab = screen.getByRole("tab", { name: "Chat" });
    fireEvent.click(chatTab);

    expect(mockSetLiveMobileChatOpen).toHaveBeenCalledWith(true);
  });

  it("does not render tablist when offline (no channels)", () => {
    mockUseLoaderData.mockReturnValue({
      initial: { channels: [], defaultChannelId: null },
    });

    render(<LivePage />);

    expect(screen.queryByRole("tablist")).toBeNull();
  });

  it("does not render tablist while loading (initial is null)", () => {
    mockApiGet.mockReturnValue(new Promise(() => {}));
    mockUseLoaderData.mockReturnValue({ initial: null });

    render(<LivePage />);

    expect(screen.queryByRole("tablist")).toBeNull();
  });

  it("does not render tablist when channel has no hlsUrl (not streaming)", () => {
    mockUseLoaderData.mockReturnValue({
      initial: makeChannelList({
        channels: [makeChannel({ hlsUrl: null })],
      }),
    });

    render(<LivePage />);

    expect(screen.queryByRole("tablist")).toBeNull();
  });
});

// ── Desktop Control Icon Tests ──

describe("LivePage — desktop control icons", () => {
  it("theater toggle renders an svg icon (not a Unicode glyph) when not in theater mode", () => {
    mockUseLoaderData.mockReturnValue({ initial: makeChannelList() });

    render(<LivePage />);

    const button = screen.getByRole("button", { name: "Theater mode" });
    expect(button.querySelector("svg")).toBeTruthy();
    expect(button.textContent).not.toContain("⤢"); // ⤢
    expect(button.textContent).not.toContain("✕"); // ✕
  });

  it("chat toggle renders an svg icon (not a Unicode glyph) when chat is visible", () => {
    mockUseLoaderData.mockReturnValue({ initial: makeChannelList() });

    render(<LivePage />);

    const button = screen.getByRole("button", { name: "Hide chat" });
    expect(button.querySelector("svg")).toBeTruthy();
    expect(button.textContent).not.toContain("→"); // →
    expect(button.textContent).not.toContain("←"); // ←
  });

  it("chat toggle renders an svg icon after collapse (Show chat label)", () => {
    mockUseLoaderData.mockReturnValue({ initial: makeChannelList() });

    render(<LivePage />);

    // Collapse chat
    const hideButton = screen.getByRole("button", { name: "Hide chat" });
    fireEvent.click(hideButton);

    const showButton = screen.getByRole("button", { name: "Show chat" });
    expect(showButton.querySelector("svg")).toBeTruthy();
    expect(showButton.textContent).not.toContain("←"); // ←
  });

  it("re-fetches the channel list when a live spine event arrives", async () => {
    vi.stubGlobal("EventSource", FakeEventSource);
    FakeEventSource.reset();
    mockUseLoaderData.mockReturnValue({ initial: makeChannelList() });
    // Seeded from SSR, so no immediate poll — refetch count starts clean.
    mockApiGet.mockClear();

    render(<LivePage />);

    const source = FakeEventSource.instances.at(-1);
    expect(source).toBeDefined();

    // Connect (re-sync on open) + a live-state change both trigger a re-fetch.
    act(() => source!.emitConnected(["live"]));
    act(() =>
      source!.emitEvent("channel.live-state-changed", {
        channelId: "channel-1",
        live: true,
      }),
    );

    await waitFor(() => {
      expect(mockApiGet).toHaveBeenCalledWith("/api/streaming/status");
    });

    vi.unstubAllGlobals();
  });
});
