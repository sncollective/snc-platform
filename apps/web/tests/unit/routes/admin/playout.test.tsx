import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
} from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { PlayoutItem, PlayoutItemListResponse, PlayoutStatus, ChannelListResponse } from "@snc/shared";
import { createRouterMock } from "../../../helpers/router-mock.js";
import { extractRouteComponent } from "../../../helpers/route-test-utils.js";

// ── Fixtures ──

function makeMockPlayoutItem(
  overrides?: Partial<PlayoutItem>,
): PlayoutItem {
  return {
    id: "item_001",
    title: "Metropolis",
    year: 1927,
    director: "Fritz Lang",
    duration: 9000,
    sourceWidth: 1920,
    sourceHeight: 1080,
    processingStatus: "ready",
    position: 0,
    enabled: true,
    renditions: {
      source: true,
      "1080p": true,
      "720p": true,
      "480p": true,
      audio: true,
    },
    hasSubtitles: false,
    createdAt: "2025-01-01T00:00:00Z",
    updatedAt: "2025-01-01T00:00:00Z",
    ...overrides,
  };
}

function makeMockStatus(
  overrides?: Partial<PlayoutStatus>,
): PlayoutStatus {
  return {
    nowPlaying: {
      itemId: "item_001",
      title: "Metropolis",
      year: 1927,
      director: "Fritz Lang",
      duration: 9000,
      elapsed: 600,
      remaining: 8400,
    },
    queuedItems: [],
    ...overrides,
  };
}

function makeMockChannels(
  overrides?: Partial<ChannelListResponse>,
): ChannelListResponse {
  return {
    defaultChannelId: "ch_broadcast",
    channels: [
      {
        id: "ch_broadcast",
        name: "S/NC TV",
        type: "broadcast",
        thumbnailUrl: null,
        hlsUrl: "https://cdn.example.com/snc-tv/index.m3u8",
        viewerCount: 0,
        creator: null,
        startedAt: null,
        nowPlaying: {
          itemId: "item_001",
          title: "Metropolis",
          year: 1927,
          director: "Fritz Lang",
          duration: 9000,
          elapsed: 600,
          remaining: 8400,
        },
      },
    ],
    ...overrides,
  };
}

// ── Hoisted Mocks ──

const {
  mockFetchPlayoutItems,
  mockCreatePlayoutItem,
  mockUpdatePlayoutItem,
  mockDeletePlayoutItem,
  mockReorderPlayoutItems,
  mockFetchPlayoutStatus,
  mockSkipPlayoutTrack,
  mockQueuePlayoutItem,
  mockSavePlaylist,
  mockStartUpload,
} = vi.hoisted(() => ({
  mockFetchPlayoutItems: vi.fn(),
  mockCreatePlayoutItem: vi.fn(),
  mockUpdatePlayoutItem: vi.fn(),
  mockDeletePlayoutItem: vi.fn(),
  mockReorderPlayoutItems: vi.fn(),
  mockFetchPlayoutStatus: vi.fn(),
  mockSkipPlayoutTrack: vi.fn(),
  mockQueuePlayoutItem: vi.fn(),
  mockSavePlaylist: vi.fn(),
  mockStartUpload: vi.fn(),
}));

const mockUseLoaderData = vi.hoisted(() => vi.fn());

vi.mock("@tanstack/react-router", () =>
  createRouterMock({
    redirect: vi.fn(),
    useLoaderData: mockUseLoaderData,
  }),
);

vi.mock("../../../../src/lib/api-server.js", () => ({
  fetchAuthStateServer: vi.fn().mockResolvedValue({
    user: { id: "u1" },
    roles: ["admin"],
  }),
  fetchApiServer: vi.fn(),
}));

vi.mock("../../../../src/lib/playout.js", () => ({
  fetchPlayoutItems: mockFetchPlayoutItems,
  createPlayoutItem: mockCreatePlayoutItem,
  updatePlayoutItem: mockUpdatePlayoutItem,
  deletePlayoutItem: mockDeletePlayoutItem,
  reorderPlayoutItems: mockReorderPlayoutItems,
  fetchPlayoutStatus: mockFetchPlayoutStatus,
  skipPlayoutTrack: mockSkipPlayoutTrack,
  queuePlayoutItem: mockQueuePlayoutItem,
  savePlaylist: mockSavePlaylist,
}));

vi.mock("../../../../src/contexts/upload-context.js", () => ({
  useUpload: () => ({
    state: { activeUploads: [], isUploading: false, isExpanded: false },
    actions: { startUpload: mockStartUpload },
  }),
}));

// ── Component Under Test ──

const PlayoutPage = extractRouteComponent(
  () => import("../../../../src/routes/admin/playout.js"),
);

// ── Lifecycle ──

beforeEach(() => {
  const item = makeMockPlayoutItem();
  const loaderData: { items: PlayoutItemListResponse; channels: ChannelListResponse | null } = {
    items: { items: [item] },
    channels: null,
  };
  mockUseLoaderData.mockReturnValue(loaderData);
  mockFetchPlayoutStatus.mockResolvedValue(makeMockStatus());
  mockUpdatePlayoutItem.mockResolvedValue({ ...item, enabled: false });
  mockDeletePlayoutItem.mockResolvedValue(undefined);
  mockReorderPlayoutItems.mockResolvedValue({ items: [item] });
  mockSkipPlayoutTrack.mockResolvedValue(undefined);
  mockQueuePlayoutItem.mockResolvedValue(undefined);
  mockSavePlaylist.mockResolvedValue({ items: [makeMockPlayoutItem()] });
  mockCreatePlayoutItem.mockResolvedValue({
    ...item,
    id: "item_new",
    processingStatus: "pending",
  });
});

// ── Tests ──

describe("PlayoutPage", () => {
  it("renders page heading 'Playout'", () => {
    render(<PlayoutPage />);
    expect(
      screen.getByRole("heading", { name: "Playout" }),
    ).toBeInTheDocument();
  });

  it("renders playlist item titles", async () => {
    render(<PlayoutPage />);
    expect(screen.getByText("Metropolis")).toBeInTheDocument();
  });

  it("shows now-playing title after status loads", async () => {
    render(<PlayoutPage />);
    await waitFor(() => {
      expect(screen.getAllByText(/Metropolis/)[0]).toBeInTheDocument();
    });
  });

  it("shows 'Nothing playing' when nowPlaying is null", async () => {
    mockFetchPlayoutStatus.mockResolvedValue(makeMockStatus({ nowPlaying: null }));
    render(<PlayoutPage />);
    await waitFor(() => {
      expect(screen.getByText("Nothing playing")).toBeInTheDocument();
    });
  });

  it("calls skipPlayoutTrack when Skip button is clicked", async () => {
    const userSetup = userEvent.setup();
    render(<PlayoutPage />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Skip" })).toBeInTheDocument();
    });

    await userSetup.click(screen.getByRole("button", { name: "Skip" }));
    await waitFor(() => {
      expect(mockSkipPlayoutTrack).toHaveBeenCalled();
    });
  });

  it("calls queuePlayoutItem when Play Next is clicked", async () => {
    const userSetup = userEvent.setup();
    render(<PlayoutPage />);

    await userSetup.click(
      screen.getByRole("button", { name: /Play Metropolis next/ }),
    );

    await waitFor(() => {
      expect(mockQueuePlayoutItem).toHaveBeenCalledWith("item_001");
    });
  });

  it("does not call updatePlayoutItem when enabled checkbox is toggled", async () => {
    const userSetup = userEvent.setup();
    render(<PlayoutPage />);

    const checkbox = screen.getByRole("checkbox", { name: /Enable Metropolis/ });
    await userSetup.click(checkbox);

    expect(mockUpdatePlayoutItem).not.toHaveBeenCalled();
  });

  it("removes item from list after delete", async () => {
    const userSetup = userEvent.setup();
    render(<PlayoutPage />);

    await userSetup.click(
      screen.getByRole("button", { name: /Delete Metropolis/ }),
    );

    await waitFor(() => {
      expect(mockDeletePlayoutItem).toHaveBeenCalledWith("item_001");
    });
  });

  it("shows 'Add Film' button", () => {
    render(<PlayoutPage />);
    expect(
      screen.getByRole("button", { name: "Add Film" }),
    ).toBeInTheDocument();
  });

  it("shows add film form when 'Add Film' is clicked", async () => {
    const userSetup = userEvent.setup();
    render(<PlayoutPage />);

    await userSetup.click(screen.getByRole("button", { name: "Add Film" }));

    expect(
      screen.getByRole("textbox", { name: "Title" }),
    ).toBeInTheDocument();
  });

  it("calls createPlayoutItem and shows upload prompt on form submit", async () => {
    const userSetup = userEvent.setup();
    render(<PlayoutPage />);

    await userSetup.click(screen.getByRole("button", { name: "Add Film" }));

    await userSetup.type(screen.getByRole("textbox", { name: "Title" }), "Nosferatu");
    await userSetup.click(screen.getByRole("button", { name: "Create & Upload" }));

    await waitFor(() => {
      expect(mockCreatePlayoutItem).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Nosferatu" }),
      );
    });

    await waitFor(() => {
      expect(screen.getByText(/created/)).toBeInTheDocument();
    });
  });

  it("shows processing status badge for each item", () => {
    render(<PlayoutPage />);
    expect(screen.getByText("Ready")).toBeInTheDocument();
  });

  it("shows 'Processing…' badge for items in processing state", () => {
    const processingItem = makeMockPlayoutItem({
      processingStatus: "processing",
    });
    mockUseLoaderData.mockReturnValue({
      items: { items: [processingItem] },
    });

    render(<PlayoutPage />);
    expect(screen.getByText("Processing…")).toBeInTheDocument();
  });

  it("shows 'No items in playlist' when list is empty", () => {
    mockUseLoaderData.mockReturnValue({ items: { items: [] } });
    render(<PlayoutPage />);
    expect(screen.getByText("No items in playlist")).toBeInTheDocument();
  });

  it("disables 'Play Next' button for non-ready items", () => {
    const pendingItem = makeMockPlayoutItem({ processingStatus: "pending" });
    mockUseLoaderData.mockReturnValue({
      items: { items: [pendingItem] },
    });

    render(<PlayoutPage />);
    const playNextBtn = screen.getByRole("button", {
      name: /Play Metropolis next/,
    });
    expect(playNextBtn).toBeDisabled();
  });

  it("disables move-up button for first item", () => {
    render(<PlayoutPage />);
    const moveUpBtn = screen.getByRole("button", {
      name: /Move Metropolis up/,
    });
    expect(moveUpBtn).toBeDisabled();
  });

  it("disables move-down button for last item", () => {
    render(<PlayoutPage />);
    const moveDownBtn = screen.getByRole("button", {
      name: /Move Metropolis down/,
    });
    expect(moveDownBtn).toBeDisabled();
  });
});

describe("playlist editing", () => {
  it("toggles enabled locally without calling API", async () => {
    const userSetup = userEvent.setup();
    render(<PlayoutPage />);

    const checkbox = screen.getByRole("checkbox", { name: /Enable Metropolis/ });
    await userSetup.click(checkbox);

    expect(mockUpdatePlayoutItem).not.toHaveBeenCalled();
  });

  it("shows Save button when playlist state is dirty", async () => {
    const userSetup = userEvent.setup();
    render(<PlayoutPage />);

    const checkbox = screen.getByRole("checkbox", { name: /Enable Metropolis/ });
    await userSetup.click(checkbox);

    expect(screen.getByRole("button", { name: "Save Playlist" })).toBeInTheDocument();
  });

  it("does not show Save/Discard when clean", () => {
    render(<PlayoutPage />);
    expect(screen.queryByRole("button", { name: "Save Playlist" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Discard" })).not.toBeInTheDocument();
  });

  it("calls savePlaylist with pending items on Save click", async () => {
    const userSetup = userEvent.setup();
    render(<PlayoutPage />);

    const checkbox = screen.getByRole("checkbox", { name: /Enable Metropolis/ });
    await userSetup.click(checkbox);

    await userSetup.click(screen.getByRole("button", { name: "Save Playlist" }));

    await waitFor(() => {
      expect(mockSavePlaylist).toHaveBeenCalledWith({
        items: [{ id: "item_001", enabled: false, position: 0 }],
      });
    });
  });

  it("resets pending state on Discard click", async () => {
    const userSetup = userEvent.setup();
    render(<PlayoutPage />);

    const checkbox = screen.getByRole("checkbox", { name: /Enable Metropolis/ });
    await userSetup.click(checkbox);

    // Discard button should now be visible
    await userSetup.click(screen.getByRole("button", { name: "Discard" }));

    // Save/Discard should be gone — state is clean again
    expect(screen.queryByRole("button", { name: "Save Playlist" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Discard" })).not.toBeInTheDocument();
  });
});

describe("queue section", () => {
  it("renders queued items from status poll", async () => {
    mockFetchPlayoutStatus.mockResolvedValue({
      nowPlaying: null,
      queuedItems: [{ itemId: "q1", title: "Queued Film", queuedAt: "2026-03-30T12:00:00.000Z" }],
    });
    render(<PlayoutPage />);
    await waitFor(() => {
      expect(screen.getByText("Queued Film")).toBeInTheDocument();
    });
  });

  it("shows empty state when no items queued", async () => {
    render(<PlayoutPage />);
    await waitFor(() => {
      expect(screen.getByText(/Queue empty/)).toBeInTheDocument();
    });
  });
});

describe("BroadcastStatus", () => {
  it("renders nothing when channels is null", () => {
    mockUseLoaderData.mockReturnValue({ items: { items: [] }, channels: null });
    render(<PlayoutPage />);
    expect(screen.queryByText("S/NC TV")).not.toBeInTheDocument();
  });

  it("renders nothing when no broadcast channel exists", () => {
    mockUseLoaderData.mockReturnValue({
      items: { items: [] },
      channels: { defaultChannelId: null, channels: [] },
    });
    render(<PlayoutPage />);
    expect(screen.queryByText("S/NC TV")).not.toBeInTheDocument();
  });

  it("shows 'Now Playing' with title when playout is active", () => {
    mockUseLoaderData.mockReturnValue({
      items: { items: [] },
      channels: makeMockChannels(),
    });
    render(<PlayoutPage />);
    expect(screen.getByText("S/NC TV")).toBeInTheDocument();
    expect(screen.getByText(/Now Playing:/)).toBeInTheDocument();
    expect(screen.getByText(/Metropolis/)).toBeInTheDocument();
  });

  it("shows director when nowPlaying includes director", () => {
    mockUseLoaderData.mockReturnValue({
      items: { items: [] },
      channels: makeMockChannels(),
    });
    render(<PlayoutPage />);
    expect(screen.getByText(/Fritz Lang/)).toBeInTheDocument();
  });

  it("shows nothing when broadcast has no nowPlaying and no live creator", () => {
    mockUseLoaderData.mockReturnValue({
      items: { items: [] },
      channels: makeMockChannels({
        channels: [
          {
            id: "ch_broadcast",
            name: "S/NC TV",
            type: "broadcast",
            thumbnailUrl: null,
            hlsUrl: null,
            viewerCount: 0,
            creator: null,
            startedAt: null,
            nowPlaying: null,
          },
        ],
      }),
    });
    render(<PlayoutPage />);
    expect(screen.getByText("S/NC TV")).toBeInTheDocument();
    expect(screen.queryByText(/Now Playing:/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Live:/)).not.toBeInTheDocument();
  });

  it("shows 'Live: {name}' when a live creator channel is active", () => {
    mockUseLoaderData.mockReturnValue({
      items: { items: [] },
      channels: makeMockChannels({
        channels: [
          {
            id: "ch_broadcast",
            name: "S/NC TV",
            type: "broadcast",
            thumbnailUrl: null,
            hlsUrl: "https://cdn.example.com/snc-tv/index.m3u8",
            viewerCount: 2,
            creator: null,
            startedAt: null,
            nowPlaying: null,
          },
          {
            id: "ch_live_1",
            name: "Alice Live",
            type: "live",
            thumbnailUrl: null,
            hlsUrl: "https://cdn.example.com/alice/index.m3u8",
            viewerCount: 2,
            creator: {
              id: "user_alice",
              displayName: "Alice",
              handle: "alice",
              avatarUrl: null,
            },
            startedAt: "2026-03-29T12:00:00.000Z",
            nowPlaying: null,
          },
        ],
      }),
    });
    render(<PlayoutPage />);
    expect(screen.getByText(/Live:/)).toBeInTheDocument();
    expect(screen.getByText(/Alice/)).toBeInTheDocument();
    expect(screen.queryByText(/Now Playing:/)).not.toBeInTheDocument();
  });

  it("prefers 'Live: {name}' over 'Now Playing' when both are available", () => {
    mockUseLoaderData.mockReturnValue({
      items: { items: [] },
      channels: makeMockChannels({
        channels: [
          {
            id: "ch_broadcast",
            name: "S/NC TV",
            type: "broadcast",
            thumbnailUrl: null,
            hlsUrl: "https://cdn.example.com/snc-tv/index.m3u8",
            viewerCount: 1,
            creator: null,
            startedAt: null,
            nowPlaying: {
              itemId: "item_001",
              title: "Metropolis",
              year: 1927,
              director: "Fritz Lang",
              duration: 9000,
              elapsed: 600,
              remaining: 8400,
            },
          },
          {
            id: "ch_live_1",
            name: "Bob Live",
            type: "live",
            thumbnailUrl: null,
            hlsUrl: "https://cdn.example.com/bob/index.m3u8",
            viewerCount: 1,
            creator: {
              id: "user_bob",
              displayName: "Bob",
              handle: "bob",
              avatarUrl: null,
            },
            startedAt: "2026-03-29T13:00:00.000Z",
            nowPlaying: null,
          },
        ],
      }),
    });
    render(<PlayoutPage />);
    expect(screen.getByText(/Live:/)).toBeInTheDocument();
    expect(screen.getByText(/Bob/)).toBeInTheDocument();
    expect(screen.queryByText(/Now Playing:/)).not.toBeInTheDocument();
  });

  it("shows viewer count when positive", () => {
    mockUseLoaderData.mockReturnValue({
      items: { items: [] },
      channels: makeMockChannels({
        channels: [
          {
            id: "ch_broadcast",
            name: "S/NC TV",
            type: "broadcast",
            thumbnailUrl: null,
            hlsUrl: "https://cdn.example.com/snc-tv/index.m3u8",
            viewerCount: 3,
            creator: null,
            startedAt: null,
            nowPlaying: null,
          },
        ],
      }),
    });
    render(<PlayoutPage />);
    expect(screen.getByText(/3 viewers/)).toBeInTheDocument();
  });
});
