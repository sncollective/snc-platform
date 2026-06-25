import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type {
  ChannelContent,
  ChannelQueueStatus,
  PoolCandidate,
} from "@snc/shared";

import { FakeEventSource } from "../../../helpers/fake-event-source.js";
import { SpineProvider } from "../../../../src/contexts/spine-context.js";

// ── Fixtures ──

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
      contentId: null,
      sourceType: "playout",
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

function makeMockPoolCandidate(
  overrides?: Partial<PoolCandidate>,
): PoolCandidate {
  return {
    id: "item_002",
    sourceType: "playout",
    title: "Nosferatu",
    duration: 6000,
    creator: null,
    ...overrides,
  };
}

const UPCOMING_ENTRY = {
  id: "entry_002",
  channelId: "ch_playout_1",
  playoutItemId: "item_002",
  contentId: null,
  sourceType: "playout" as const,
  position: 1,
  status: "queued" as const,
  pushedToLiquidsoap: false,
  createdAt: "2026-01-01T00:00:00Z",
  title: "Nosferatu",
  duration: 6000,
};

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
} = vi.hoisted(() => ({
  mockFetchChannelQueue: vi.fn(),
  mockFetchChannelContent: vi.fn(),
  mockSkipChannelTrack: vi.fn(),
  mockInsertQueueItem: vi.fn(),
  mockRemoveQueueItem: vi.fn(),
  mockAssignChannelContent: vi.fn(),
  mockRemoveChannelContent: vi.fn(),
  mockSearchAvailableContent: vi.fn(),
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
  retryPlayoutIngest: vi.fn(),
}));

vi.mock("../../../../src/contexts/upload-context.js", () => ({
  useUpload: () => ({
    state: { activeUploads: [], isUploading: false, isExpanded: false },
    actions: { startUpload: vi.fn() },
  }),
}));

// Component under test — imported after mocks are registered.
import { EditorialSurface } from "../../../../src/components/playout/editorial-surface.js";
import {
  EditorialApiProvider,
  ADMIN_EDITORIAL_API,
} from "../../../../src/components/playout/editorial-api.js";

// ── Render helper ──

const ALL_CAPS = {
  channelCrud: true,
  broadcastBanner: true,
  channelTabs: true,
  canCreateContent: true,
} as const;

// `useEditorialApi` now fail-closes when no provider wraps the surface, so the
// isolated render must supply one. The admin bundle is the `playout-channels.ts`
// module mocked above, so the injected fetchers resolve to exactly those mocks.
function renderSurface(
  props?: Partial<React.ComponentProps<typeof EditorialSurface>>,
): void {
  render(
    <SpineProvider
      topics={["playout"]}
      eventSourceCtor={FakeEventSource as unknown as typeof EventSource}
    >
      <EditorialApiProvider api={ADMIN_EDITORIAL_API}>
        <EditorialSurface
          channelId="ch_playout_1"
          spineTopic="playout"
          capabilities={ALL_CAPS}
          {...props}
        />
      </EditorialApiProvider>
    </SpineProvider>,
  );
}

// ── Lifecycle ──

beforeEach(() => {
  vi.clearAllMocks();
  FakeEventSource.reset();
  mockFetchChannelQueue.mockResolvedValue(makeMockQueueStatus());
  mockFetchChannelContent.mockResolvedValue({ items: [makeMockChannelContent()] });
  mockSkipChannelTrack.mockResolvedValue(undefined);
  mockInsertQueueItem.mockResolvedValue(undefined);
  mockRemoveQueueItem.mockResolvedValue(undefined);
  mockAssignChannelContent.mockResolvedValue(undefined);
  mockRemoveChannelContent.mockResolvedValue(undefined);
  mockSearchAvailableContent.mockResolvedValue({ items: [makeMockPoolCandidate()] });
});

// ── Tests ──

describe("EditorialSurface — channel-scoped body", () => {
  it("renders Now Playing / Queue / Content Pool sections", async () => {
    renderSurface();
    expect(screen.getByRole("heading", { name: "Now Playing" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Queue" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Content Pool/ })).toBeInTheDocument();
    // Fetches the queue and the pool for the channel it was handed.
    await waitFor(() => expect(mockFetchChannelQueue).toHaveBeenCalledWith("ch_playout_1"));
    await waitFor(() => expect(mockFetchChannelContent).toHaveBeenCalledWith("ch_playout_1"));
  });

  it("does not render channel tabs / CRUD / broadcast markup (those stay in the mount)", () => {
    renderSurface();
    // The mount (route) owns multi-channel context; the surface never paints it,
    // regardless of the capability flags it accepts for the creator contract.
    expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "+ New Channel" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Delete channel" })).not.toBeInTheDocument();
    expect(screen.queryByText("S/NC TV")).not.toBeInTheDocument();
  });

  it("renders the now-playing/queue/pool body when all capability flags are false", () => {
    renderSurface({
      capabilities: { channelCrud: false, broadcastBanner: false, channelTabs: false, canCreateContent: false },
    });
    // The core body (now-playing/queue/pool) is capability-independent.
    expect(screen.getByRole("heading", { name: "Now Playing" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Queue" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Content Pool/ })).toBeInTheDocument();
  });

  it("renders the '+ Create New' affordance when canCreateContent is true", () => {
    renderSurface(); // ALL_CAPS → canCreateContent: true
    expect(screen.getByRole("button", { name: "+ Create New" })).toBeInTheDocument();
    // The search picker over existing content stays available regardless.
    expect(screen.getByRole("button", { name: "+ Add Content" })).toBeInTheDocument();
  });

  it("hides the '+ Create New' affordance when canCreateContent is false (creator mount)", () => {
    renderSurface({
      capabilities: { channelCrud: false, broadcastBanner: false, channelTabs: false, canCreateContent: false },
    });
    // The admin-shaped create path (createPlayoutItem + playout-item assignment) is
    // rejected for creator scope, so the affordance is hidden on the creator mount...
    expect(screen.queryByRole("button", { name: "+ Create New" })).not.toBeInTheDocument();
    // ...but adding existing own-content via the search picker IS allowed and stays.
    expect(screen.getByRole("button", { name: "+ Add Content" })).toBeInTheDocument();
  });
});

describe("EditorialSurface — Now Playing + Skip", () => {
  it("shows the now-playing title and fires skipChannelTrack on Skip", async () => {
    const user = userEvent.setup();
    renderSurface();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Skip" })).toBeInTheDocument();
    });
    expect(screen.getAllByText("Metropolis").length).toBeGreaterThan(0);

    await user.click(screen.getByRole("button", { name: "Skip" }));
    await waitFor(() => expect(mockSkipChannelTrack).toHaveBeenCalledWith("ch_playout_1"));
  });
});

describe("EditorialSurface — Queue add/remove", () => {
  it("fires insertQueueItem when a pool item is picked via the queue add picker", async () => {
    const user = userEvent.setup();
    renderSurface();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "+ Add to Queue" })).toBeInTheDocument();
    });
    await user.click(screen.getByRole("button", { name: "+ Add to Queue" }));

    // The pool item (playout-source) shows as a selectable option.
    const option = await screen.findByRole("option", { name: /Metropolis/ });
    await user.click(option);

    await waitFor(() =>
      expect(mockInsertQueueItem).toHaveBeenCalledWith("ch_playout_1", "item_001", 1),
    );
  });

  it("fires removeQueueItem when an upcoming entry's Remove is clicked", async () => {
    const user = userEvent.setup();
    mockFetchChannelQueue.mockResolvedValue(
      makeMockQueueStatus({ upcoming: [UPCOMING_ENTRY] }),
    );
    renderSurface();

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /Remove Nosferatu from queue/ }),
      ).toBeInTheDocument();
    });
    await user.click(screen.getByRole("button", { name: /Remove Nosferatu from queue/ }));

    await waitFor(() =>
      expect(mockRemoveQueueItem).toHaveBeenCalledWith("ch_playout_1", "entry_002"),
    );
  });
});

describe("EditorialSurface — Content Pool add/remove", () => {
  it("fires assignChannelContent when content is picked via the pool search picker", async () => {
    const user = userEvent.setup();
    renderSurface();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "+ Add Content" })).toBeInTheDocument();
    });
    await user.click(screen.getByRole("button", { name: "+ Add Content" }));

    const option = await screen.findByRole("option", { name: /Nosferatu/ });
    await user.click(option);

    await waitFor(() =>
      expect(mockAssignChannelContent).toHaveBeenCalledWith("ch_playout_1", ["item_002"]),
    );
  });

  it("fires removeChannelContent when Remove is clicked in the pool table", async () => {
    const user = userEvent.setup();
    renderSurface();

    // ResponsiveTable dual-renders (table + card), so there can be two Remove buttons.
    await waitFor(() => {
      expect(
        screen.getAllByRole("button", { name: /Remove Metropolis from pool/ })[0],
      ).toBeInTheDocument();
    });
    await user.click(
      screen.getAllByRole("button", { name: /Remove Metropolis from pool/ })[0]!,
    );

    await waitFor(() =>
      expect(mockRemoveChannelContent).toHaveBeenCalledWith("ch_playout_1", ["item_001"]),
    );
  });
});

describe("EditorialSurface — spine-driven refetch", () => {
  it("re-fetches the queue on a topic event (not waiting for the 3s poll)", async () => {
    renderSurface();
    await waitFor(() => expect(mockFetchChannelQueue).toHaveBeenCalled());
    const callsBefore = mockFetchChannelQueue.mock.calls.length;

    const source = FakeEventSource.instances.at(-1);
    if (!source) throw new Error("no FakeEventSource");
    source.emitConnected(["playout"]);
    source.emitEvent("playout.queue-changed", { channelId: "ch_playout_1" });

    await waitFor(() =>
      expect(mockFetchChannelQueue.mock.calls.length).toBeGreaterThan(callsBefore),
    );
  });
});
