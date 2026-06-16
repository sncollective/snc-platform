import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
} from "vitest";
import { act, render, screen, waitFor, within } from "@testing-library/react";

import { FakeEventSource } from "../../../helpers/fake-event-source.js";
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
    ownership: "platform",
    role: "playout",
    thumbnailUrl: null,
    hlsUrl: null,
    viewerCount: 0,
    creator: null,
    startedAt: null,
    nowPlaying: null,
    liveState: "offline",
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
  mockCreateChannel,
  mockDeleteChannel,
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
  mockCreateChannel: vi.fn(),
  mockDeleteChannel: vi.fn(),
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
  createChannel: mockCreateChannel,
  deleteChannel: mockDeleteChannel,
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
  vi.clearAllMocks();
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
  mockCreateChannel.mockResolvedValue({ channelId: "ch_new", engineRestarting: false, engineReady: true });
  mockDeleteChannel.mockResolvedValue({ ok: true, engineRestarting: true, engineReady: false });
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

  it("renders new channel row without inline style (uses CSS class)", async () => {
    const userSetup = userEvent.setup();
    render(<PlayoutPage />);

    const newChannelBtn = screen.getByRole("button", { name: "+ New Channel" });
    await userSetup.click(newChannelBtn);

    const channelInput = screen.getByPlaceholderText("Channel name");
    // The input should not have an inline style attribute (class handles sizing).
    expect(channelInput.closest("div")?.getAttribute("style")).toBeNull();
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

describe("create channel — confirm dialog gate", () => {
  it("clicking Create opens the confirm dialog without creating the channel", async () => {
    const user = userEvent.setup();
    render(<PlayoutPage />);

    // Open the new channel form
    await user.click(screen.getByRole("button", { name: "+ New Channel" }));
    const nameInput = screen.getByPlaceholderText("Channel name");
    await user.type(nameInput, "Test Channel");

    // Click Create — should open the confirm dialog, NOT call createChannel
    await user.click(screen.getByRole("button", { name: "Create" }));

    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    expect(screen.getByText(/briefly restarts the playout engine/i)).toBeInTheDocument();
    expect(mockCreateChannel).not.toHaveBeenCalled();
  });

  it("confirming the dialog calls createChannel", async () => {
    const user = userEvent.setup();
    render(<PlayoutPage />);

    await user.click(screen.getByRole("button", { name: "+ New Channel" }));
    await user.type(screen.getByPlaceholderText("Channel name"), "Test Channel");
    await user.click(screen.getByRole("button", { name: "Create" }));

    await waitFor(() => {
      expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "Create channel" }));

    await waitFor(() => {
      expect(mockCreateChannel).toHaveBeenCalledWith("Test Channel");
    });
  });

  it("cancelling the create dialog preserves the typed channel name", async () => {
    const user = userEvent.setup();
    render(<PlayoutPage />);

    await user.click(screen.getByRole("button", { name: "+ New Channel" }));
    const nameInput = screen.getByPlaceholderText("Channel name");
    await user.type(nameInput, "My Channel");
    await user.click(screen.getByRole("button", { name: "Create" }));

    const createDialog = await screen.findByRole("alertdialog");

    // Cancel via the dialog's Cancel button (not the form Cancel)
    await user.click(within(createDialog).getByRole("button", { name: "Cancel" }));

    await waitFor(() => {
      expect(screen.queryByRole("alertdialog")).toBeNull();
    });

    // The typed name should still be in the input
    expect(screen.getByPlaceholderText("Channel name")).toHaveValue("My Channel");
    expect(mockCreateChannel).not.toHaveBeenCalled();
  });
});

describe("delete channel — confirm dialog gate", () => {
  it("renders a Delete channel button when a channel is selected", () => {
    render(<PlayoutPage />);
    expect(screen.getByRole("button", { name: "Delete channel" })).toBeInTheDocument();
  });

  it("clicking Delete channel opens the confirm dialog without calling deleteChannel", async () => {
    const user = userEvent.setup();
    render(<PlayoutPage />);

    await user.click(screen.getByRole("button", { name: "Delete channel" }));

    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    expect(screen.getByText(/goes offline and is removed from playout/i)).toBeInTheDocument();
    expect(mockDeleteChannel).not.toHaveBeenCalled();
  });

  it("confirming the delete dialog calls deleteChannel with the selected channel id", async () => {
    const user = userEvent.setup();
    render(<PlayoutPage />);

    await user.click(screen.getByRole("button", { name: "Delete channel" }));

    const deleteDialog = await screen.findByRole("alertdialog");

    // Click the confirm button inside the dialog (not the "Delete channel" nav button)
    await user.click(within(deleteDialog).getByRole("button", { name: "Delete channel" }));

    await waitFor(() => {
      expect(mockDeleteChannel).toHaveBeenCalledWith("ch_playout_1");
    });
  });

  it("cancelling the delete dialog closes it without calling deleteChannel", async () => {
    const user = userEvent.setup();
    render(<PlayoutPage />);

    await user.click(screen.getByRole("button", { name: "Delete channel" }));

    await waitFor(() => {
      expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "Cancel" }));

    await waitFor(() => {
      expect(screen.queryByRole("alertdialog")).toBeNull();
    });

    expect(mockDeleteChannel).not.toHaveBeenCalled();
  });
});

describe("Now Playing — disabled skip when nothing is playing", () => {
  it("shows a disabled Skip button with 'No active track' when queueStatus is loaded but nowPlaying is null", async () => {
    mockFetchChannelQueue.mockResolvedValue(
      makeMockQueueStatus({ nowPlaying: null }),
    );
    render(<PlayoutPage />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Skip" })).toBeInTheDocument();
    });

    const skipBtn = screen.getByRole("button", { name: "Skip" });
    expect(skipBtn).toBeDisabled();
    expect(screen.getByText("No active track")).toBeInTheDocument();
  });

  it("shows enabled Skip when nowPlaying is not null", async () => {
    render(<PlayoutPage />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Skip" })).toBeInTheDocument();
    });

    expect(screen.getByRole("button", { name: "Skip" })).not.toBeDisabled();
    expect(screen.queryByText("No active track")).not.toBeInTheDocument();
  });

  it("shows Loading when queueStatus is null (initial load)", () => {
    mockFetchChannelQueue.mockReturnValue(new Promise(() => {})); // never resolves
    render(<PlayoutPage />);
    // Both queue and Now Playing sections show "Loading…" while queueStatus is null
    expect(screen.getAllByText("Loading…").length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByRole("button", { name: "Skip" })).not.toBeInTheDocument();
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

    // ResponsiveTable renders both a table and card view (dual render), so
    // there are two Remove buttons per item — use getAllByRole and click the first.
    await waitFor(() => {
      expect(
        screen.getAllByRole("button", { name: /Remove Metropolis from pool/ })[0],
      ).toBeInTheDocument();
    });

    await userSetup.click(
      screen.getAllByRole("button", { name: /Remove Metropolis from pool/ })[0]!,
    );

    await waitFor(() => {
      expect(mockRemoveChannelContent).toHaveBeenCalledWith(
        "ch_playout_1",
        ["item_001"],
      );
    });
  });

  describe("spine live-data", () => {
    const lastSource = () => {
      const s = FakeEventSource.instances.at(-1);
      if (!s) throw new Error("no FakeEventSource");
      return s;
    };

    beforeEach(() => {
      vi.stubGlobal("EventSource", FakeEventSource);
      FakeEventSource.reset();
    });

    it("re-fetches the queue on a playout.queue-changed event (not waiting for the 3s poll)", async () => {
      render(<PlayoutPage />);
      // Initial mount fetch(es).
      await waitFor(() => expect(mockFetchChannelQueue).toHaveBeenCalled());
      const callsBefore = mockFetchChannelQueue.mock.calls.length;

      act(() => lastSource().emitConnected(["playout"]));
      act(() => lastSource().emitEvent("playout.queue-changed", { channelId: "ch_playout_1" }));

      await waitFor(() =>
        expect(mockFetchChannelQueue.mock.calls.length).toBeGreaterThan(callsBefore),
      );

      vi.unstubAllGlobals();
    });

    it("shows the stale banner when the spine connection drops", async () => {
      render(<PlayoutPage />);
      act(() => lastSource().emitConnected(["playout"]));
      // Healthy: quiet Live indicator, no stale banner.
      expect(screen.getByText("Live")).toBeInTheDocument();

      act(() => lastSource().emitError(FakeEventSource.CLOSED));

      await waitFor(() =>
        expect(screen.getByText(/Data may be out of date/)).toBeInTheDocument(),
      );

      vi.unstubAllGlobals();
    });
  });
});
