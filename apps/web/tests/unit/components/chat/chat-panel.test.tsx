import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { createRouterMock } from "../../../helpers/router-mock.js";

// jsdom does not implement scrollIntoView
window.HTMLElement.prototype.scrollIntoView = vi.fn();

// Mock @tanstack/react-router (needed for the Sign-in Link in anon branch)
vi.mock("@tanstack/react-router", () => createRouterMock());

// Mock chat context
const { mockUseChat } = vi.hoisted(() => ({
  mockUseChat: vi.fn(),
}));

vi.mock("../../../../src/contexts/chat-context.js", () => ({
  useChat: mockUseChat,
}));

vi.mock("../../../../src/lib/fetch-utils.js", () => ({
  apiGet: vi.fn().mockResolvedValue({ rooms: [] }),
}));

import { ChatPanel } from "../../../../src/components/chat/chat-panel.js";

const DEFAULT_CHAT_STATE = {
  rooms: [],
  activeRoomId: null,
  messages: [],
  hasMore: false,
  isConnected: true,
  viewerCount: 0,
  users: [],
  slowModeSeconds: 0,
  isTimedOut: false,
  timedOutUntil: null,
  isBanned: false,
  lastFilteredAt: null,
  isModerator: false,
  currentUserId: null,
  reactions: new Map(),
};

const DEFAULT_CHAT_ACTIONS = {
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

beforeEach(() => {
  mockUseChat.mockReturnValue({
    state: DEFAULT_CHAT_STATE,
    actions: DEFAULT_CHAT_ACTIONS,
  });
});

const makeMessage = (overrides?: Partial<{
  id: string;
  roomId: string;
  userId: string;
  userName: string;
  avatarUrl: string | null;
  badges: string[];
  content: string;
  createdAt: string;
}>) => ({
  id: "msg-1",
  roomId: "room-1",
  userId: "user-1",
  userName: "Alice",
  avatarUrl: null,
  badges: [] as string[],
  content: "Hello world",
  createdAt: "2026-03-01T10:05:00.000Z",
  ...overrides,
});

// Shared open-room fixture
const OPEN_ROOM = {
  id: "room-1",
  type: "platform",
  channelId: null,
  name: "Community",
  slowModeSeconds: 0,
  createdAt: "2026-03-01T00:00:00.000Z",
  closedAt: null,
};

describe("ChatPanel collapse button", () => {
  it("does not render collapse button when onCollapse is omitted", () => {
    render(<ChatPanel />);
    expect(screen.queryByLabelText("Collapse chat")).toBeNull();
  });

  it("renders collapse button when onCollapse is provided", () => {
    render(<ChatPanel onCollapse={vi.fn()} />);
    expect(screen.getByLabelText("Collapse chat")).toBeInTheDocument();
  });

  it("calls onCollapse when collapse button is clicked", async () => {
    const user = userEvent.setup();
    const onCollapse = vi.fn();
    render(<ChatPanel onCollapse={onCollapse} />);

    await user.click(screen.getByLabelText("Collapse chat"));

    expect(onCollapse).toHaveBeenCalledOnce();
  });
});

describe("ChatPanel badge rendering", () => {
  it("renders no badge markup for empty badges array", () => {
    mockUseChat.mockReturnValue({
      state: { ...DEFAULT_CHAT_STATE, messages: [makeMessage({ badges: [] })] },
      actions: DEFAULT_CHAT_ACTIONS,
    });

    render(<ChatPanel />);
    expect(screen.queryByTitle("Patron")).toBeNull();
    expect(screen.queryByTitle("Sub")).toBeNull();
  });

  it("renders platform badge with correct label and data attribute", () => {
    mockUseChat.mockReturnValue({
      state: { ...DEFAULT_CHAT_STATE, messages: [makeMessage({ badges: ["platform"] })] },
      actions: DEFAULT_CHAT_ACTIONS,
    });

    render(<ChatPanel />);
    const badge = screen.getByTitle("Patron");
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveAttribute("data-badge", "platform");
    expect(badge).toHaveTextContent("Patron");
  });

  it("renders creator badge with correct label and data attribute", () => {
    mockUseChat.mockReturnValue({
      state: { ...DEFAULT_CHAT_STATE, messages: [makeMessage({ badges: ["creator"] })] },
      actions: DEFAULT_CHAT_ACTIONS,
    });

    render(<ChatPanel />);
    const badge = screen.getByTitle("Sub");
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveAttribute("data-badge", "creator");
    expect(badge).toHaveTextContent("Sub");
  });

  it("renders both badges in order (platform first, then creator)", () => {
    mockUseChat.mockReturnValue({
      state: {
        ...DEFAULT_CHAT_STATE,
        messages: [makeMessage({ badges: ["platform", "creator"] })],
      },
      actions: DEFAULT_CHAT_ACTIONS,
    });

    render(<ChatPanel />);
    const badges = screen.getAllByTitle(/Patron|Sub/);
    expect(badges).toHaveLength(2);
    expect(badges[0]).toHaveAttribute("data-badge", "platform");
    expect(badges[1]).toHaveAttribute("data-badge", "creator");
  });
});

describe("ChatPanel moderation status banners", () => {
  it("does not show slow mode banner when slowModeSeconds is 0", () => {
    render(<ChatPanel />);
    expect(screen.queryByText(/Slow mode/)).toBeNull();
  });

  it("shows slow mode banner when slowModeSeconds > 0", () => {
    mockUseChat.mockReturnValue({
      state: { ...DEFAULT_CHAT_STATE, slowModeSeconds: 10 },
      actions: DEFAULT_CHAT_ACTIONS,
    });

    render(<ChatPanel />);
    expect(screen.getByText(/Slow mode: 10s/)).toBeInTheDocument();
  });

  it("shows timed out banner when isTimedOut is true", () => {
    mockUseChat.mockReturnValue({
      state: {
        ...DEFAULT_CHAT_STATE,
        isTimedOut: true,
        timedOutUntil: "2026-04-01T12:00:00.000Z",
      },
      actions: DEFAULT_CHAT_ACTIONS,
    });

    render(<ChatPanel />);
    expect(screen.getByText(/timed out until/)).toBeInTheDocument();
  });

  it("shows banned banner when isBanned is true", () => {
    mockUseChat.mockReturnValue({
      state: { ...DEFAULT_CHAT_STATE, isBanned: true },
      actions: DEFAULT_CHAT_ACTIONS,
    });

    render(<ChatPanel />);
    expect(screen.getByText(/banned from this room/)).toBeInTheDocument();
  });

  it("shows filtered flash when lastFilteredAt is set", () => {
    mockUseChat.mockReturnValue({
      state: { ...DEFAULT_CHAT_STATE, lastFilteredAt: Date.now() },
      actions: DEFAULT_CHAT_ACTIONS,
    });

    render(<ChatPanel />);
    expect(screen.getByText(/blocked by filter/)).toBeInTheDocument();
  });

  it("disables input when timed out", () => {
    mockUseChat.mockReturnValue({
      state: {
        ...DEFAULT_CHAT_STATE,
        rooms: [OPEN_ROOM],
        activeRoomId: "room-1",
        isTimedOut: true,
        timedOutUntil: "2026-04-01T12:00:00.000Z",
        // Signed-in so we reach the auth branch where the real input lives
        currentUserId: "user-1",
      },
      actions: DEFAULT_CHAT_ACTIONS,
    });

    render(<ChatPanel />);
    const input = screen.getByRole("textbox", { name: /chat message/i });
    expect(input).toBeDisabled();
  });

  it("disables input when banned", () => {
    mockUseChat.mockReturnValue({
      state: {
        ...DEFAULT_CHAT_STATE,
        rooms: [OPEN_ROOM],
        activeRoomId: "room-1",
        isBanned: true,
        // Signed-in so we reach the auth branch where the real input lives
        currentUserId: "user-1",
      },
      actions: DEFAULT_CHAT_ACTIONS,
    });

    render(<ChatPanel />);
    const input = screen.getByRole("textbox", { name: /chat message/i });
    expect(input).toBeDisabled();
  });
});

describe("ChatPanel reaction pills", () => {
  it("renders reaction pills for messages with reactions (count > 0)", () => {
    const reactions = new Map([
      ["msg-1", [{ emoji: "👍" as const, count: 2, reactedByMe: false }]],
    ]);
    mockUseChat.mockReturnValue({
      state: {
        ...DEFAULT_CHAT_STATE,
        messages: [makeMessage({ id: "msg-1" })],
        reactions,
      },
      actions: DEFAULT_CHAT_ACTIONS,
    });

    render(<ChatPanel />);
    expect(screen.getByRole("button", { name: "👍 2" })).toBeInTheDocument();
  });

  it("does not render reaction row for messages with no reactions", () => {
    mockUseChat.mockReturnValue({
      state: {
        ...DEFAULT_CHAT_STATE,
        messages: [makeMessage({ id: "msg-1" })],
        reactions: new Map(),
        isConnected: false,
      },
      actions: DEFAULT_CHAT_ACTIONS,
    });

    render(<ChatPanel />);
    // No reaction pills
    expect(screen.queryByRole("button", { name: /👍|❤️|😂|😮|😢|🔥/ })).toBeNull();
  });

  it("active pill has aria-pressed=true when reactedByMe is true", () => {
    const reactions = new Map([
      ["msg-1", [{ emoji: "👍" as const, count: 1, reactedByMe: true }]],
    ]);
    mockUseChat.mockReturnValue({
      state: {
        ...DEFAULT_CHAT_STATE,
        messages: [makeMessage({ id: "msg-1" })],
        reactions,
      },
      actions: DEFAULT_CHAT_ACTIONS,
    });

    render(<ChatPanel />);
    const pill = screen.getByRole("button", { name: "👍 1" });
    expect(pill).toHaveAttribute("aria-pressed", "true");
  });

  it("clicking an inactive pill calls addReaction", async () => {
    const user = userEvent.setup();
    const addReaction = vi.fn();
    const reactions = new Map([
      ["msg-1", [{ emoji: "👍" as const, count: 1, reactedByMe: false }]],
    ]);
    mockUseChat.mockReturnValue({
      state: {
        ...DEFAULT_CHAT_STATE,
        messages: [makeMessage({ id: "msg-1" })],
        reactions,
      },
      actions: { ...DEFAULT_CHAT_ACTIONS, addReaction },
    });

    render(<ChatPanel />);
    const pill = screen.getByRole("button", { name: "👍 1" });
    await user.click(pill);

    expect(addReaction).toHaveBeenCalledWith("msg-1", "👍");
  });

  it("clicking an active pill calls removeReaction", async () => {
    const user = userEvent.setup();
    const removeReaction = vi.fn();
    const reactions = new Map([
      ["msg-1", [{ emoji: "👍" as const, count: 1, reactedByMe: true }]],
    ]);
    mockUseChat.mockReturnValue({
      state: {
        ...DEFAULT_CHAT_STATE,
        messages: [makeMessage({ id: "msg-1" })],
        reactions,
      },
      actions: { ...DEFAULT_CHAT_ACTIONS, removeReaction },
    });

    render(<ChatPanel />);
    const pill = screen.getByRole("button", { name: "👍 1" });
    await user.click(pill);

    expect(removeReaction).toHaveBeenCalledWith("msg-1", "👍");
  });
});

describe("ChatPanel anonymous pre-gate", () => {
  it("shows disabled input with 'Sign in to chat' placeholder when anonymous and room is open", () => {
    mockUseChat.mockReturnValue({
      state: {
        ...DEFAULT_CHAT_STATE,
        rooms: [OPEN_ROOM],
        activeRoomId: "room-1",
        currentUserId: null,
      },
      actions: DEFAULT_CHAT_ACTIONS,
    });

    render(<ChatPanel />);
    const input = screen.getByRole("textbox", { name: /sign in to send/i });
    expect(input).toBeDisabled();
    expect(input).toHaveAttribute("placeholder", "Sign in to chat");
  });

  it("shows a sign-in link with returnTo=/live when anonymous and room is open", () => {
    mockUseChat.mockReturnValue({
      state: {
        ...DEFAULT_CHAT_STATE,
        rooms: [OPEN_ROOM],
        activeRoomId: "room-1",
        currentUserId: null,
      },
      actions: DEFAULT_CHAT_ACTIONS,
    });

    render(<ChatPanel />);
    const link = screen.getByRole("link", { name: /sign in/i });
    expect(link).toBeInTheDocument();
    // StubLink encodes the search params into the href
    expect(link).toHaveAttribute("href", expect.stringContaining("/login"));
    expect(link).toHaveAttribute("href", expect.stringMatching(/returnTo/i));
  });

  it("does not show an enabled Send button when anonymous and room is open", () => {
    mockUseChat.mockReturnValue({
      state: {
        ...DEFAULT_CHAT_STATE,
        rooms: [OPEN_ROOM],
        activeRoomId: "room-1",
        currentUserId: null,
      },
      actions: DEFAULT_CHAT_ACTIONS,
    });

    render(<ChatPanel />);
    expect(screen.queryByRole("button", { name: /send/i })).toBeNull();
  });

  it("shows enabled input and Send button when signed in and room is open", () => {
    mockUseChat.mockReturnValue({
      state: {
        ...DEFAULT_CHAT_STATE,
        rooms: [OPEN_ROOM],
        activeRoomId: "room-1",
        currentUserId: "user-1",
      },
      actions: DEFAULT_CHAT_ACTIONS,
    });

    render(<ChatPanel />);
    const input = screen.getByRole("textbox", { name: /^chat message$/i });
    expect(input).not.toBeDisabled();
    expect(screen.getByRole("button", { name: /send/i })).toBeInTheDocument();
  });
});

describe("ChatPanel empty state", () => {
  it("shows 'No messages yet' when messages array is empty", () => {
    render(<ChatPanel />);
    expect(screen.getByText("No messages yet")).toBeInTheDocument();
  });

  it("does not show 'No messages yet' when there are messages", () => {
    mockUseChat.mockReturnValue({
      state: {
        ...DEFAULT_CHAT_STATE,
        messages: [makeMessage()],
      },
      actions: DEFAULT_CHAT_ACTIONS,
    });

    render(<ChatPanel />);
    expect(screen.queryByText("No messages yet")).toBeNull();
  });
});

describe("ChatPanel unavailable state", () => {
  it("does not show 'Chat unavailable' before rooms fetch resolves", () => {
    // apiGet is mocked to resolve asynchronously; check synchronously right after render
    render(<ChatPanel />);
    expect(screen.queryByText("Chat unavailable")).toBeNull();
  });

  it("shows 'Chat unavailable' after rooms fetch resolves with no joinable room", async () => {
    // State has no activeRoom and no rooms — loadRooms resolves { rooms: [] }
    render(<ChatPanel />);
    const banner = await screen.findByText("Chat unavailable");
    expect(banner).toBeInTheDocument();
  });
});

describe("ChatPanel viewer count accessible name", () => {
  it("renders aria-label '1 viewer in this room' when viewerCount is 1", () => {
    mockUseChat.mockReturnValue({
      state: { ...DEFAULT_CHAT_STATE, viewerCount: 1 },
      actions: DEFAULT_CHAT_ACTIONS,
    });

    render(<ChatPanel />);
    expect(
      screen.getByLabelText("1 viewer in this room"),
    ).toBeInTheDocument();
  });

  it("renders aria-label '3 viewers in this room' when viewerCount is 3", () => {
    mockUseChat.mockReturnValue({
      state: { ...DEFAULT_CHAT_STATE, viewerCount: 3 },
      actions: DEFAULT_CHAT_ACTIONS,
    });

    render(<ChatPanel />);
    expect(
      screen.getByLabelText("3 viewers in this room"),
    ).toBeInTheDocument();
  });
});
