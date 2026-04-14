import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
} from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type {
  ChannelListResponse,
  ChannelQueueStatus,
  ChannelContent,
} from "@snc/shared";
import { createRouterMock } from "../../../helpers/router-mock.js";
import { extractRouteComponent } from "../../../helpers/route-test-utils.js";

// ── Fixtures ──

function makeMockPlayoutChannel(
  overrides?: Partial<ChannelListResponse["channels"][number]>,
): ChannelListResponse["channels"][number] {
  return {
    id: "ch_playout_1",
    name: "Classics",
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

function makeMockQueueStatus(
  overrides?: Partial<ChannelQueueStatus>,
): ChannelQueueStatus {
  return {
    channelId: "ch_playout_1",
    channelName: "Classics",
    nowPlaying: {
      id: "entry_001",
      channelId: "ch_playout_1",
      playoutItemId: "item_001",
      position: 0,
      status: "playing",
      pushedToLiquidsoap: true,
      createdAt: "2026-01-01T00:00:00Z",
      title: "Metropolis",
      duration: 9000,
    },
    upcoming: [],
    poolSize: 5,
    ...overrides,
  };
}

function makeMockChannelContent(
  overrides?: Partial<ChannelContent>,
): ChannelContent {
  return {
    id: "cc_001",
    channelId: "ch_playout_1",
    playoutItemId: "item_001",
    contentId: null,
    sourceType: "playout",
    processingStatus: "ready",
    title: "Metropolis",
    duration: 9000,
    lastPlayedAt: null,
    playCount: 0,
    createdAt: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

// ── Hoisted Mocks ──

const {
  mockFetchChannelQueue,
  mockFetchChannelContent,
  mockSkipChannelTrack,
  mockInsertQueueItem,
  mockRemoveQueueItem,
  mockAssignChannelContent,
  mockRemoveChannelContent,
  mockSearchAvailableContent,
  mockStartUpload,
  mockCreatePlayoutItem,
} = vi.hoisted(() => ({
  mockFetchChannelQueue: vi.fn(),
  mockFetchChannelContent: vi.fn(),
  mockSkipChannelTrack: vi.fn(),
  mockInsertQueueItem: vi.fn(),
  mockRemoveQueueItem: vi.fn(),
  mockAssignChannelContent: vi.fn(),
  mockRemoveChannelContent: vi.fn(),
  mockSearchAvailableContent: vi.fn(),
  mockStartUpload: vi.fn(),
  mockCreatePlayoutItem: vi.fn(),
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

vi.mock("../../../../src/lib/playout-channels.js", () => ({
  fetchChannelQueue: mockFetchChannelQueue,
  fetchChannelContent: mockFetchChannelContent,
  skipChannelTrack: mockSkipChannelTrack,
  insertQueueItem: mockInsertQueueItem,
  removeQueueItem: mockRemoveQueueItem,
  assignChannelContent: mockAssignChannelContent,
  removeChannelContent: mockRemoveChannelContent,
  searchAvailableContent: mockSearchAvailableContent,
}));

vi.mock("../../../../src/lib/playout.js", () => ({
  fetchPlayoutItems: vi.fn(),
  createPlayoutItem: mockCreatePlayoutItem,
  updatePlayoutItem: vi.fn(),
  deletePlayoutItem: vi.fn(),
  reorderPlayoutItems: vi.fn(),
  fetchPlayoutStatus: vi.fn(),
  skipPlayoutTrack: vi.fn(),
  queuePlayoutItem: vi.fn(),
  savePlaylist: vi.fn(),
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
  const playoutChannel = makeMockPlayoutChannel();
  mockUseLoaderData.mockReturnValue({ allChannels: [playoutChannel], playoutChannels: [playoutChannel] });
  mockFetchChannelQueue.mockResolvedValue(makeMockQueueStatus());
  mockFetchChannelContent.mockResolvedValue({ items: [makeMockChannelContent()] });
  mockSkipChannelTrack.mockResolvedValue(undefined);
  mockInsertQueueItem.mockResolvedValue(undefined);
  mockRemoveQueueItem.mockResolvedValue(undefined);
  mockAssignChannelContent.mockResolvedValue(undefined);
  mockRemoveChannelContent.mockResolvedValue(undefined);
  mockSearchAvailableContent.mockResolvedValue({ items: [] });
  mockCreatePlayoutItem.mockResolvedValue({
    id: "item_new",
    title: "Nosferatu",
    year: null,
    director: null,
    duration: null,
    sourceWidth: null,
    sourceHeight: null,
    processingStatus: "pending",
    position: 0,
    enabled: true,
    renditions: {},
    hasSubtitles: false,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
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

  it("renders channel tab for each playout channel", () => {
    render(<PlayoutPage />);
    expect(screen.getByRole("tab", { name: "Classics" })).toBeInTheDocument();
  });

  it("shows no playout channels message when empty", () => {
    mockUseLoaderData.mockReturnValue({ allChannels: [], playoutChannels: [] });
    render(<PlayoutPage />);
    expect(screen.getByText("No playout channels configured.")).toBeInTheDocument();
  });

  it("shows now-playing title after queue status loads", async () => {
    render(<PlayoutPage />);
    await waitFor(() => {
      expect(screen.getAllByText("Metropolis").length).toBeGreaterThan(0);
    });
  });

  it("shows 'Nothing playing' when nowPlaying is null", async () => {
    mockFetchChannelQueue.mockResolvedValue(
      makeMockQueueStatus({ nowPlaying: null }),
    );
    render(<PlayoutPage />);
    await waitFor(() => {
      expect(screen.getByText("Nothing playing")).toBeInTheDocument();
    });
  });

  it("calls skipChannelTrack when Skip button is clicked", async () => {
    const userSetup = userEvent.setup();
    render(<PlayoutPage />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Skip" })).toBeInTheDocument();
    });

    await userSetup.click(screen.getByRole("button", { name: "Skip" }));
    await waitFor(() => {
      expect(mockSkipChannelTrack).toHaveBeenCalledWith("ch_playout_1");
    });
  });

  it("shows multiple channel tabs when multiple channels exist", () => {
    const chs = [
      makeMockPlayoutChannel({ id: "ch1", name: "Classics" }),
      makeMockPlayoutChannel({ id: "ch2", name: "Music Videos" }),
    ];
    mockUseLoaderData.mockReturnValue({
      allChannels: chs,
      playoutChannels: chs,
    });
    render(<PlayoutPage />);
    expect(screen.getByRole("tab", { name: "Classics" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Music Videos" })).toBeInTheDocument();
  });

  it("renders pool items in the content pool table", async () => {
    render(<PlayoutPage />);
    await waitFor(() => {
      expect(screen.getAllByText("Metropolis").length).toBeGreaterThan(0);
    });
  });
});

describe("queue section", () => {
  it("renders upcoming queue items", async () => {
    mockFetchChannelQueue.mockResolvedValue(
      makeMockQueueStatus({
        upcoming: [
          {
            id: "entry_002",
            channelId: "ch_playout_1",
            playoutItemId: "item_002",
            position: 1,
            status: "queued",
            pushedToLiquidsoap: false,
            createdAt: "2026-01-01T00:00:00Z",
            title: "Nosferatu",
            duration: 6000,
          },
        ],
      }),
    );
    render(<PlayoutPage />);
    await waitFor(() => {
      expect(screen.getByText("Nosferatu")).toBeInTheDocument();
    });
  });

  it("shows empty state when no items are queued", async () => {
    mockFetchChannelQueue.mockResolvedValue(
      makeMockQueueStatus({ nowPlaying: null, upcoming: [] }),
    );
    render(<PlayoutPage />);
    await waitFor(() => {
      expect(screen.getByText(/Queue empty/)).toBeInTheDocument();
    });
  });

  it("calls removeQueueItem when Remove button is clicked in queue", async () => {
    const userSetup = userEvent.setup();
    mockFetchChannelQueue.mockResolvedValue(
      makeMockQueueStatus({
        upcoming: [
          {
            id: "entry_002",
            channelId: "ch_playout_1",
            playoutItemId: "item_002",
            position: 1,
            status: "queued",
            pushedToLiquidsoap: false,
            createdAt: "2026-01-01T00:00:00Z",
            title: "Nosferatu",
            duration: 6000,
          },
        ],
      }),
    );
    render(<PlayoutPage />);

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /Remove Nosferatu from queue/ }),
      ).toBeInTheDocument();
    });

    await userSetup.click(
      screen.getByRole("button", { name: /Remove Nosferatu from queue/ }),
    );

    await waitFor(() => {
      expect(mockRemoveQueueItem).toHaveBeenCalledWith("ch_playout_1", "entry_002");
    });
  });
});

describe("BroadcastStatus", () => {
  it("renders nothing when there are no broadcast channels", () => {
    // No broadcast channel in playoutChannels — BroadcastStatus gets the full list
    mockUseLoaderData.mockReturnValue({ allChannels: [], playoutChannels: [] });
    render(<PlayoutPage />);
    expect(screen.queryByText("S/NC TV")).not.toBeInTheDocument();
  });
});

describe("content pool", () => {
  it("renders content pool table with pool items", async () => {
    render(<PlayoutPage />);
    await waitFor(() => {
      expect(mockFetchChannelContent).toHaveBeenCalledWith("ch_playout_1");
    });
  });

  it("calls removeChannelContent when Remove is clicked in pool table", async () => {
    const userSetup = userEvent.setup();
    render(<PlayoutPage />);

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /Remove Metropolis from pool/ }),
      ).toBeInTheDocument();
    });

    await userSetup.click(
      screen.getByRole("button", { name: /Remove Metropolis from pool/ }),
    );

    await waitFor(() => {
      expect(mockRemoveChannelContent).toHaveBeenCalledWith(
        "ch_playout_1",
        ["item_001"],
      );
    });
  });
});
