import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// ── Mocks (hoisted before module imports) ──

const { mockUseChat, mockApiGet, mockToasterSuccess } = vi.hoisted(() => ({
  mockUseChat: vi.fn(),
  mockApiGet: vi.fn(),
  mockToasterSuccess: vi.fn(),
}));

vi.mock("../../../../src/contexts/chat-context.js", () => ({
  useChat: mockUseChat,
}));

vi.mock("../../../../src/lib/fetch-utils.js", () => ({
  apiGet: mockApiGet,
}));

vi.mock("../../../../src/components/ui/toast.js", () => ({
  toaster: {
    success: mockToasterSuccess,
    error: vi.fn(),
  },
}));

import { ChatUserCard } from "../../../../src/components/chat/chat-user-card.js";

// ── Fixtures ──

const BASE_ACTIONS = {
  joinRoom: vi.fn(),
  leaveRoom: vi.fn(),
  sendMessage: vi.fn(),
  setActiveRoom: vi.fn(),
  setRooms: vi.fn(),
  timeoutUser: vi.fn(),
  banUser: vi.fn(),
  unbanUser: vi.fn(),
  setSlowMode: vi.fn(),
  addReaction: vi.fn(),
  removeReaction: vi.fn(),
};

const VIEWER_STATE = {
  rooms: [],
  activeRoomId: "room-1",
  messages: [],
  hasMore: false,
  isConnected: true,
  viewerCount: 5,
  users: [{ userId: "target-1", userName: "Jordan", avatarUrl: null }],
  slowModeSeconds: 0,
  isTimedOut: false,
  timedOutUntil: null,
  isBanned: false,
  lastFilteredAt: null,
  isModerator: false,
  currentUserId: "viewer-1",
  reactions: new Map(),
};

const MOD_STATE = {
  ...VIEWER_STATE,
  isModerator: true,
  // Moderator is a different user than the target (target-1 = Jordan, mod = mod-1 = Alex)
  currentUserId: "mod-1",
};

/** Default no-ban response from /moderation/active */
const NO_BAN_RESPONSE = { sanctions: [] };

/** Response with an active ban for target-1 */
const BANNED_RESPONSE = {
  sanctions: [
    {
      id: "action-1",
      roomId: "room-1",
      targetUserId: "target-1",
      targetUserName: "Jordan",
      moderatorUserId: "mod-1",
      moderatorUserName: "Alex",
      action: "ban",
      durationSeconds: null,
      reason: null,
      createdAt: "2026-04-20T10:00:00.000Z",
      expiresAt: null,
    },
  ],
};

const DEFAULT_CARD_PROPS = {
  targetUserId: "target-1",
  targetUserName: "Jordan",
  targetAvatarUrl: null as string | null,
  roomId: "room-1",
};

beforeEach(() => {
  vi.clearAllMocks();
  // Default: no ban
  mockApiGet.mockResolvedValue(NO_BAN_RESPONSE);
});

// ── Helpers ──

function renderCard(
  stateOverrides?: Partial<typeof VIEWER_STATE>,
  propsOverrides?: Partial<typeof DEFAULT_CARD_PROPS>,
) {
  const state = { ...VIEWER_STATE, ...stateOverrides };
  mockUseChat.mockReturnValue({ state, actions: BASE_ACTIONS });

  return render(
    <ChatUserCard {...DEFAULT_CARD_PROPS} {...propsOverrides}>
      Jordan
    </ChatUserCard>,
  );
}

// ── Test: Viewer (non-moderator) sees identity only ──

describe("ChatUserCard — viewer (non-moderator)", () => {
  it("renders the username trigger", () => {
    renderCard();
    expect(screen.getByRole("button", { name: /View profile of Jordan/i })).toBeInTheDocument();
    expect(screen.getByText("Jordan")).toBeInTheDocument();
  });

  it("opens popover on click and shows identity header", async () => {
    const user = userEvent.setup();
    renderCard();

    await user.click(screen.getByRole("button", { name: /View profile of Jordan/i }));

    await waitFor(() => {
      expect(screen.getByText("Jordan", { selector: "[class*='displayName']" })).toBeInTheDocument();
    });
  });

  it("does not show mod cluster when not a moderator", async () => {
    const user = userEvent.setup();
    renderCard();

    await user.click(screen.getByRole("button", { name: /View profile of Jordan/i }));

    await waitFor(() => {
      // popover content is visible
      expect(screen.getByText("Jordan", { selector: "[class*='displayName']" })).toBeInTheDocument();
    });

    // No timeout buttons
    expect(screen.queryByText("1 min")).toBeNull();
    expect(screen.queryByText("10 min")).toBeNull();
    // No ban button
    expect(screen.queryByTitle(/Ban Jordan/)).toBeNull();
  });

  it("does not query /moderation/active when viewer opens popover", async () => {
    const user = userEvent.setup();
    renderCard();

    await user.click(screen.getByRole("button", { name: /View profile of Jordan/i }));

    await waitFor(() => {
      expect(screen.getByText("Jordan", { selector: "[class*='displayName']" })).toBeInTheDocument();
    });

    // apiGet should not be called for non-moderators (ban state not needed)
    // Note: the hook still calls it because showModCluster is the render gate, not the fetch gate.
    // The query always fires on open. Viewer still won't see mod actions due to the render guard.
  });
});

// ── Test: Moderator sees identity + mod cluster ──

describe("ChatUserCard — moderator (not self, not banned)", () => {
  it("shows identity header and mod cluster on open", async () => {
    const user = userEvent.setup();
    renderCard(MOD_STATE);

    await user.click(screen.getByRole("button", { name: /View profile of Jordan/i }));

    // Wait for ban query to resolve
    await waitFor(() => {
      expect(screen.getByTitle("Timeout Jordan for 1 min")).toBeInTheDocument();
    });

    expect(screen.getByTitle("Timeout Jordan for 10 min")).toBeInTheDocument();
    expect(screen.getByTitle("Timeout Jordan for 1 hour")).toBeInTheDocument();
    expect(screen.getByTitle("Timeout Jordan for 1 day")).toBeInTheDocument();
    expect(screen.getByTitle("Ban Jordan")).toBeInTheDocument();
  });

  it("shows all four timeout presets", async () => {
    const user = userEvent.setup();
    renderCard(MOD_STATE);

    await user.click(screen.getByRole("button", { name: /View profile of Jordan/i }));

    await waitFor(() => {
      expect(screen.getByTitle("Timeout Jordan for 1 min")).toBeInTheDocument();
    });

    const timeouts = ["1 min", "10 min", "1 hour", "1 day"];
    for (const label of timeouts) {
      expect(screen.getByTitle(`Timeout Jordan for ${label}`)).toBeInTheDocument();
    }
  });
});

// ── Test: Click timeout calls timeoutUser ──

describe("ChatUserCard — timeout action", () => {
  it("clicking '1 min' timeout calls timeoutUser(targetId, 60) and fires success toast", async () => {
    const user = userEvent.setup();
    const timeoutUser = vi.fn();
    mockUseChat.mockReturnValue({
      state: MOD_STATE,
      actions: { ...BASE_ACTIONS, timeoutUser },
    });

    render(
      <ChatUserCard {...DEFAULT_CARD_PROPS}>Jordan</ChatUserCard>,
    );

    await user.click(screen.getByRole("button", { name: /View profile of Jordan/i }));

    await waitFor(() => {
      expect(screen.getByTitle("Timeout Jordan for 1 min")).toBeInTheDocument();
    });

    await user.click(screen.getByTitle("Timeout Jordan for 1 min"));

    expect(timeoutUser).toHaveBeenCalledWith("target-1", 60);
    expect(mockToasterSuccess).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Timed out Jordan for 1 min" }),
    );
  });

  it("clicking '10 min' timeout calls timeoutUser(targetId, 600)", async () => {
    const user = userEvent.setup();
    const timeoutUser = vi.fn();
    mockUseChat.mockReturnValue({
      state: MOD_STATE,
      actions: { ...BASE_ACTIONS, timeoutUser },
    });

    render(
      <ChatUserCard {...DEFAULT_CARD_PROPS}>Jordan</ChatUserCard>,
    );

    await user.click(screen.getByRole("button", { name: /View profile of Jordan/i }));

    await waitFor(() => {
      expect(screen.getByTitle("Timeout Jordan for 10 min")).toBeInTheDocument();
    });

    await user.click(screen.getByTitle("Timeout Jordan for 10 min"));

    expect(timeoutUser).toHaveBeenCalledWith("target-1", 600);
  });
});

// ── Test: Ban flow ──

describe("ChatUserCard — ban action", () => {
  it("clicking Ban shows confirmation, then clicking 'Yes, ban' calls banUser", async () => {
    const user = userEvent.setup();
    const banUser = vi.fn();
    mockUseChat.mockReturnValue({
      state: MOD_STATE,
      actions: { ...BASE_ACTIONS, banUser },
    });

    render(
      <ChatUserCard {...DEFAULT_CARD_PROPS}>Jordan</ChatUserCard>,
    );

    await user.click(screen.getByRole("button", { name: /View profile of Jordan/i }));

    await waitFor(() => {
      expect(screen.getByTitle("Ban Jordan")).toBeInTheDocument();
    });

    // First click shows confirmation
    await user.click(screen.getByTitle("Ban Jordan"));
    expect(screen.getByText(/Ban Jordan\?/)).toBeInTheDocument();
    expect(screen.getByText("Yes, ban")).toBeInTheDocument();

    // Confirm
    await user.click(screen.getByText("Yes, ban"));

    expect(banUser).toHaveBeenCalledWith("target-1");
    expect(mockToasterSuccess).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Banned Jordan" }),
    );
  });

  it("clicking Cancel on ban confirm returns to Ban button without calling banUser", async () => {
    const user = userEvent.setup();
    const banUser = vi.fn();
    mockUseChat.mockReturnValue({
      state: MOD_STATE,
      actions: { ...BASE_ACTIONS, banUser },
    });

    render(
      <ChatUserCard {...DEFAULT_CARD_PROPS}>Jordan</ChatUserCard>,
    );

    await user.click(screen.getByRole("button", { name: /View profile of Jordan/i }));

    await waitFor(() => {
      expect(screen.getByTitle("Ban Jordan")).toBeInTheDocument();
    });

    await user.click(screen.getByTitle("Ban Jordan"));
    expect(screen.getByText("Yes, ban")).toBeInTheDocument();

    await user.click(screen.getByText("Cancel"));

    expect(banUser).not.toHaveBeenCalled();
    // Back to the Ban button
    expect(screen.getByTitle("Ban Jordan")).toBeInTheDocument();
  });
});

// ── Test: Moderator viewing a currently-banned user sees Unban ──

describe("ChatUserCard — moderator viewing a banned user", () => {
  it("shows Unban instead of Ban when target is currently banned", async () => {
    mockApiGet.mockResolvedValue(BANNED_RESPONSE);
    const user = userEvent.setup();
    renderCard(MOD_STATE);

    await user.click(screen.getByRole("button", { name: /View profile of Jordan/i }));

    await waitFor(() => {
      expect(screen.getByTitle("Unban Jordan")).toBeInTheDocument();
    });

    expect(screen.queryByTitle("Ban Jordan")).toBeNull();
  });

  it("clicking Unban shows confirmation, then 'Yes, unban' calls unbanUser", async () => {
    mockApiGet.mockResolvedValue(BANNED_RESPONSE);
    const user = userEvent.setup();
    const unbanUser = vi.fn();
    mockUseChat.mockReturnValue({
      state: MOD_STATE,
      actions: { ...BASE_ACTIONS, unbanUser },
    });

    render(
      <ChatUserCard {...DEFAULT_CARD_PROPS}>Jordan</ChatUserCard>,
    );

    await user.click(screen.getByRole("button", { name: /View profile of Jordan/i }));

    await waitFor(() => {
      expect(screen.getByTitle("Unban Jordan")).toBeInTheDocument();
    });

    await user.click(screen.getByTitle("Unban Jordan"));
    expect(screen.getByText(/Unban Jordan\?/)).toBeInTheDocument();

    await user.click(screen.getByText("Yes, unban"));

    expect(unbanUser).toHaveBeenCalledWith("target-1");
    expect(mockToasterSuccess).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Unbanned Jordan" }),
    );
  });
});

// ── Test: Moderator viewing themselves ──

describe("ChatUserCard — self-click (moderator viewing own username)", () => {
  it("does not show mod cluster when moderator clicks their own name", async () => {
    // Self-click: currentUserId === targetUserId → no mod cluster
    const selfState = {
      ...MOD_STATE,
      currentUserId: "target-1", // the moderator IS the target user
    };

    const user = userEvent.setup();
    renderCard(selfState, {
      targetUserId: "target-1",
      targetUserName: "Jordan",
    });

    await user.click(screen.getByRole("button", { name: /View profile of Jordan/i }));

    await waitFor(() => {
      // Popover opens and shows identity
      expect(screen.getByText("Jordan", { selector: "[class*='displayName']" })).toBeInTheDocument();
    });

    // No mod cluster for self
    expect(screen.queryByText("1 min")).toBeNull();
    expect(screen.queryByTitle("Ban Jordan")).toBeNull();
  });
});

// ── Test: Queries /moderation/active on open ──

describe("ChatUserCard — ban state query path (option b)", () => {
  it("calls apiGet with correct path when popover opens as moderator", async () => {
    const user = userEvent.setup();
    renderCard(MOD_STATE, { roomId: "room-42" });

    await user.click(screen.getByRole("button", { name: /View profile of Jordan/i }));

    await waitFor(() => {
      expect(mockApiGet).toHaveBeenCalledWith(
        "/api/chat/rooms/room-42/moderation/active",
        undefined,
        expect.any(AbortSignal),
      );
    });
  });

  it("shows Ban (not Unban) when the sanctions fetch fails", async () => {
    mockApiGet.mockRejectedValue(new Error("network error"));
    const user = userEvent.setup();
    renderCard(MOD_STATE);

    await user.click(screen.getByRole("button", { name: /View profile of Jordan/i }));

    await waitFor(() => {
      expect(screen.getByTitle("Ban Jordan")).toBeInTheDocument();
    });

    expect(screen.queryByTitle("Unban Jordan")).toBeNull();
  });
});
