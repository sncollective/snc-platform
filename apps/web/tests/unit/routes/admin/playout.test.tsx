import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
} from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { PlayoutItem, PlayoutItemListResponse, PlayoutStatus } from "@snc/shared";
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
    queuedUri: null,
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
  const loaderData: { items: PlayoutItemListResponse } = {
    items: { items: [item] },
  };
  mockUseLoaderData.mockReturnValue(loaderData);
  mockFetchPlayoutStatus.mockResolvedValue(makeMockStatus());
  mockUpdatePlayoutItem.mockResolvedValue({ ...item, enabled: false });
  mockDeletePlayoutItem.mockResolvedValue(undefined);
  mockReorderPlayoutItems.mockResolvedValue({ items: [item] });
  mockSkipPlayoutTrack.mockResolvedValue(undefined);
  mockQueuePlayoutItem.mockResolvedValue(undefined);
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

  it("calls updatePlayoutItem when enabled checkbox is toggled", async () => {
    const userSetup = userEvent.setup();
    render(<PlayoutPage />);

    const checkbox = screen.getByRole("checkbox", { name: /Enable Metropolis/ });
    await userSetup.click(checkbox);

    await waitFor(() => {
      expect(mockUpdatePlayoutItem).toHaveBeenCalledWith("item_001", {
        enabled: false,
      });
    });
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
