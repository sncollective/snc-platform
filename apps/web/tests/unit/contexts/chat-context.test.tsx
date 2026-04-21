import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import type { ReactNode } from "react";

// ── Toast mock (hoisted so vi.mock factory can reference it) ──
const { mockToasterError } = vi.hoisted(() => ({
  mockToasterError: vi.fn(),
}));

vi.mock("../../../src/components/ui/toast.js", () => ({
  toaster: {
    success: vi.fn(),
    error: mockToasterError,
  },
}));

import {
  chatReducer,
  INITIAL_STATE,
  ChatProvider,
  useChat,
} from "../../../src/contexts/chat-context.js";
import type { ChatState } from "../../../src/contexts/chat-context.js";
import type { ChatMessage, ChatRoom } from "@snc/shared";

// ── Helpers ──

function makeRoom(overrides: Partial<ChatRoom> = {}): ChatRoom {
  return {
    id: "room-1",
    type: "platform",
    channelId: null,
    name: "Community",
    slowModeSeconds: 0,
    createdAt: "2026-03-01T00:00:00.000Z",
    closedAt: null,
    ...overrides,
  };
}

function makeMessage(overrides: Partial<ChatMessage> = {}): ChatMessage {
  return {
    id: "msg-1",
    roomId: "room-1",
    userId: "user-1",
    userName: "Alice",
    avatarUrl: null,
    badges: [],
    content: "Hello, world!",
    createdAt: "2026-03-01T00:01:00.000Z",
    ...overrides,
  };
}

// ── Tests: chatReducer ──

describe("chatReducer", () => {
  it("SET_ROOMS updates rooms", () => {
    const rooms = [makeRoom(), makeRoom({ id: "room-2", type: "channel" })];
    const result = chatReducer(INITIAL_STATE, { type: "SET_ROOMS", rooms });
    expect(result.rooms).toEqual(rooms);
    expect(result.activeRoomId).toBeNull();
  });

  it("SET_ACTIVE_ROOM clears messages and sets activeRoomId", () => {
    const stateWithMessages: ChatState = {
      ...INITIAL_STATE,
      activeRoomId: "room-1",
      messages: [makeMessage()],
      hasMore: true,
    };
    const result = chatReducer(stateWithMessages, {
      type: "SET_ACTIVE_ROOM",
      roomId: "room-2",
    });
    expect(result.activeRoomId).toBe("room-2");
    expect(result.messages).toEqual([]);
    expect(result.hasMore).toBe(false);
  });

  it("ADD_MESSAGE appends to active room only", () => {
    const stateWithActiveRoom: ChatState = {
      ...INITIAL_STATE,
      activeRoomId: "room-1",
    };
    const msg = makeMessage({ roomId: "room-1" });
    const result = chatReducer(stateWithActiveRoom, {
      type: "ADD_MESSAGE",
      message: msg,
    });
    expect(result.messages).toHaveLength(1);
    expect(result.messages[0]).toEqual(msg);
  });

  it("ADD_MESSAGE ignores messages from other rooms", () => {
    const stateWithActiveRoom: ChatState = {
      ...INITIAL_STATE,
      activeRoomId: "room-1",
    };
    const msg = makeMessage({ roomId: "room-2" });
    const result = chatReducer(stateWithActiveRoom, {
      type: "ADD_MESSAGE",
      message: msg,
    });
    expect(result.messages).toHaveLength(0);
  });

  it("ROOM_CLOSED sets closedAt on matching room", () => {
    const room = makeRoom({ id: "room-1" });
    const stateWithRoom: ChatState = {
      ...INITIAL_STATE,
      rooms: [room],
    };
    const result = chatReducer(stateWithRoom, {
      type: "ROOM_CLOSED",
      roomId: "room-1",
    });
    expect(result.rooms[0]?.closedAt).not.toBeNull();
    expect(typeof result.rooms[0]?.closedAt).toBe("string");
  });

  it("ROOM_CLOSED does not affect other rooms", () => {
    const room1 = makeRoom({ id: "room-1" });
    const room2 = makeRoom({ id: "room-2", type: "channel" });
    const stateWithRooms: ChatState = {
      ...INITIAL_STATE,
      rooms: [room1, room2],
    };
    const result = chatReducer(stateWithRooms, {
      type: "ROOM_CLOSED",
      roomId: "room-1",
    });
    expect(result.rooms[0]?.closedAt).not.toBeNull();
    expect(result.rooms[1]?.closedAt).toBeNull();
  });

  it("SET_HISTORY sets messages and hasMore", () => {
    const messages = [makeMessage(), makeMessage({ id: "msg-2" })];
    const result = chatReducer(INITIAL_STATE, {
      type: "SET_HISTORY",
      messages,
      hasMore: true,
    });
    expect(result.messages).toEqual(messages);
    expect(result.hasMore).toBe(true);
  });

  it("CLEAR_MESSAGES resets messages and hasMore", () => {
    const stateWithMessages: ChatState = {
      ...INITIAL_STATE,
      messages: [makeMessage()],
      hasMore: true,
    };
    const result = chatReducer(stateWithMessages, { type: "CLEAR_MESSAGES" });
    expect(result.messages).toEqual([]);
    expect(result.hasMore).toBe(false);
  });

  it("SET_CONNECTED updates isConnected", () => {
    const result = chatReducer(INITIAL_STATE, {
      type: "SET_CONNECTED",
      isConnected: true,
    });
    expect(result.isConnected).toBe(true);
  });

});

// ── Tests: useChat hook ──

describe("useChat", () => {
  it("throws when used outside ChatProvider", () => {
    expect(() => {
      renderHook(() => useChat());
    }).toThrow("useChat must be used within ChatProvider");
  });

  it("returns context value when used inside ChatProvider", () => {
    // ChatProvider connects WebSocket in useEffect — we rely on jsdom not having real WebSocket
    // so the connection attempt is a no-op (WebSocket constructor is not defined in jsdom)
    const wrapper = ({ children }: { readonly children: ReactNode }) => (
      <ChatProvider>{children}</ChatProvider>
    );

    // Just verify the hook doesn't throw and returns state + actions
    const { result } = renderHook(() => useChat(), { wrapper });
    expect(result.current.state).toBeDefined();
    expect(result.current.actions).toBeDefined();
    expect(result.current.state.rooms).toEqual([]);
    expect(result.current.state.activeRoomId).toBeNull();
  });
});

// ── Tests: chatReducer moderation actions ──

describe("chatReducer moderation actions", () => {
  it("INITIAL_STATE has default moderation fields", () => {
    expect(INITIAL_STATE.slowModeSeconds).toBe(0);
    expect(INITIAL_STATE.isTimedOut).toBe(false);
    expect(INITIAL_STATE.timedOutUntil).toBeNull();
    expect(INITIAL_STATE.isBanned).toBe(false);
    expect(INITIAL_STATE.lastFilteredAt).toBeNull();
    expect(INITIAL_STATE.isModerator).toBe(false);
  });

  it("SET_SLOW_MODE updates slowModeSeconds", () => {
    const result = chatReducer(INITIAL_STATE, { type: "SET_SLOW_MODE", seconds: 30 });
    expect(result.slowModeSeconds).toBe(30);
  });

  it("SET_TIMED_OUT with a date sets isTimedOut and timedOutUntil", () => {
    const until = "2026-04-01T12:00:00.000Z";
    const result = chatReducer(INITIAL_STATE, { type: "SET_TIMED_OUT", until });
    expect(result.isTimedOut).toBe(true);
    expect(result.timedOutUntil).toBe(until);
  });

  it("SET_TIMED_OUT with null clears isTimedOut", () => {
    const stateWithTimeout = { ...INITIAL_STATE, isTimedOut: true, timedOutUntil: "2026-04-01T12:00:00.000Z" };
    const result = chatReducer(stateWithTimeout, { type: "SET_TIMED_OUT", until: null });
    expect(result.isTimedOut).toBe(false);
    expect(result.timedOutUntil).toBeNull();
  });

  it("SET_BANNED sets isBanned to true", () => {
    const result = chatReducer(INITIAL_STATE, { type: "SET_BANNED", banned: true });
    expect(result.isBanned).toBe(true);
  });

  it("SET_BANNED sets isBanned to false", () => {
    const stateWithBan = { ...INITIAL_STATE, isBanned: true };
    const result = chatReducer(stateWithBan, { type: "SET_BANNED", banned: false });
    expect(result.isBanned).toBe(false);
  });

  it("MESSAGE_FILTERED sets lastFilteredAt to a timestamp", () => {
    const before = Date.now();
    const result = chatReducer(INITIAL_STATE, { type: "MESSAGE_FILTERED" });
    const after = Date.now();
    expect(result.lastFilteredAt).not.toBeNull();
    expect(result.lastFilteredAt).toBeGreaterThanOrEqual(before);
    expect(result.lastFilteredAt).toBeLessThanOrEqual(after);
  });

  it("CLEAR_FILTERED resets lastFilteredAt to null", () => {
    const stateWithFilter = { ...INITIAL_STATE, lastFilteredAt: Date.now() };
    const result = chatReducer(stateWithFilter, { type: "CLEAR_FILTERED" });
    expect(result.lastFilteredAt).toBeNull();
  });

  it("SET_MODERATOR sets isModerator", () => {
    const result = chatReducer(INITIAL_STATE, { type: "SET_MODERATOR", isModerator: true });
    expect(result.isModerator).toBe(true);
  });

  it("SET_ACTIVE_ROOM resets moderation state", () => {
    const stateWithModeration = {
      ...INITIAL_STATE,
      slowModeSeconds: 30,
      isTimedOut: true,
      timedOutUntil: "2026-04-01T12:00:00.000Z",
      isBanned: true,
      lastFilteredAt: Date.now(),
      isModerator: true,
    };
    const result = chatReducer(stateWithModeration, {
      type: "SET_ACTIVE_ROOM",
      roomId: "room-2",
    });
    expect(result.slowModeSeconds).toBe(0);
    expect(result.isTimedOut).toBe(false);
    expect(result.timedOutUntil).toBeNull();
    expect(result.isBanned).toBe(false);
    expect(result.lastFilteredAt).toBeNull();
    expect(result.isModerator).toBe(false);
    expect(result.reactions.size).toBe(0);
  });

  it("SET_REACTIONS_BATCH populates reactions map", () => {
    const reactions = {
      "msg-1": [
        { emoji: "👍" as const, count: 2, reactedByMe: false },
      ],
      "msg-2": [
        { emoji: "❤️" as const, count: 1, reactedByMe: true },
      ],
    };
    const result = chatReducer(INITIAL_STATE, {
      type: "SET_REACTIONS_BATCH",
      reactions,
    });
    expect(result.reactions.get("msg-1")).toHaveLength(1);
    expect(result.reactions.get("msg-2")).toHaveLength(1);
    expect(result.reactions.get("msg-1")?.[0]?.emoji).toBe("👍");
  });

  it("UPDATE_REACTION updates single emoji without clobbering others", () => {
    const stateWithReactions: ChatState = {
      ...INITIAL_STATE,
      reactions: new Map([
        ["msg-1", [
          { emoji: "👍" as const, count: 1, reactedByMe: false },
          { emoji: "❤️" as const, count: 2, reactedByMe: true },
        ]],
      ]),
    };
    const result = chatReducer(stateWithReactions, {
      type: "UPDATE_REACTION",
      messageId: "msg-1",
      emoji: "👍",
      count: 3,
      userIds: ["user-1", "user-2", "user-3"],
      currentUserId: "user-1",
    });
    const reactions = result.reactions.get("msg-1") ?? [];
    const thumbsUp = reactions.find((r) => r.emoji === "👍");
    const heart = reactions.find((r) => r.emoji === "❤️");
    expect(thumbsUp?.count).toBe(3);
    expect(thumbsUp?.reactedByMe).toBe(true);
    // Heart emoji should be unchanged
    expect(heart?.count).toBe(2);
    expect(heart?.reactedByMe).toBe(true);
  });

  it("UPDATE_REACTION removes pill when count reaches 0", () => {
    const stateWithReactions: ChatState = {
      ...INITIAL_STATE,
      reactions: new Map([
        ["msg-1", [{ emoji: "👍" as const, count: 1, reactedByMe: true }]],
      ]),
    };
    const result = chatReducer(stateWithReactions, {
      type: "UPDATE_REACTION",
      messageId: "msg-1",
      emoji: "👍",
      count: 0,
      userIds: [],
      currentUserId: "user-1",
    });
    const reactions = result.reactions.get("msg-1") ?? [];
    expect(reactions.find((r) => r.emoji === "👍")).toBeUndefined();
  });

  it("SET_ACTIVE_ROOM clears reactions map", () => {
    const stateWithReactions: ChatState = {
      ...INITIAL_STATE,
      reactions: new Map([
        ["msg-1", [{ emoji: "👍" as const, count: 1, reactedByMe: false }]],
      ]),
    };
    const result = chatReducer(stateWithReactions, {
      type: "SET_ACTIVE_ROOM",
      roomId: "room-2",
    });
    expect(result.reactions.size).toBe(0);
  });
});

// ── Tests: room_state dispatch (reducer level) ──

describe("chatReducer room_state dispatch sequence", () => {
  it("SET_SLOW_MODE + SET_BANNED + SET_TIMED_OUT sets all rehydration fields", () => {
    const until = "2026-05-01T12:00:00.000Z";
    let state = chatReducer(INITIAL_STATE, { type: "SET_SLOW_MODE", seconds: 30 });
    state = chatReducer(state, { type: "SET_BANNED", banned: true });
    state = chatReducer(state, { type: "SET_TIMED_OUT", until });

    expect(state.slowModeSeconds).toBe(30);
    expect(state.isBanned).toBe(true);
    expect(state.isTimedOut).toBe(true);
    expect(state.timedOutUntil).toBe(until);
  });

  it("all-false room_state clears any prior sanction state", () => {
    const stateWithSanctions = {
      ...INITIAL_STATE,
      slowModeSeconds: 60,
      isBanned: true,
      isTimedOut: true,
      timedOutUntil: "2026-05-01T12:00:00.000Z",
    };
    let state = chatReducer(stateWithSanctions, { type: "SET_SLOW_MODE", seconds: 0 });
    state = chatReducer(state, { type: "SET_BANNED", banned: false });
    state = chatReducer(state, { type: "SET_TIMED_OUT", until: null });

    expect(state.slowModeSeconds).toBe(0);
    expect(state.isBanned).toBe(false);
    expect(state.isTimedOut).toBe(false);
    expect(state.timedOutUntil).toBeNull();
  });

  it("SET_ACTIVE_ROOM clears slow/ban/timeout state before room_state arrives", () => {
    const stateWithSanctions = {
      ...INITIAL_STATE,
      slowModeSeconds: 30,
      isBanned: true,
      isTimedOut: true,
      timedOutUntil: "2026-05-01T12:00:00.000Z",
    };
    const result = chatReducer(stateWithSanctions, {
      type: "SET_ACTIVE_ROOM",
      roomId: "room-new",
    });

    expect(result.slowModeSeconds).toBe(0);
    expect(result.isBanned).toBe(false);
    expect(result.isTimedOut).toBe(false);
    expect(result.timedOutUntil).toBeNull();
    expect(result.activeRoomId).toBe("room-new");
  });
});

// ── Tests: WS error handler fires toaster ──

describe("ChatProvider WS error handler", () => {
  // Capture the WebSocket instance created during connect() so we can fire messages
  let capturedOnMessage: ((event: { data: string }) => void) | null = null;

  beforeEach(() => {
    capturedOnMessage = null;
    mockToasterError.mockClear();

    // Provide a controlled WebSocket stub
    vi.stubGlobal("WebSocket", class MockWebSocket {
      onopen: (() => void) | null = null;
      onmessage: ((event: { data: string }) => void) | null = null;
      onclose: (() => void) | null = null;
      readyState = 1; // OPEN

      constructor() {
        // Store reference so tests can fire messages
        // eslint-disable-next-line @typescript-eslint/no-this-alias
        capturedOnMessage = (ev) => this.onmessage?.(ev);
      }

      send() {}
      close() {}
    });
  });

  const fireMessage = (data: unknown) => {
    capturedOnMessage?.({ data: JSON.stringify(data) });
  };

  it("fires toaster.error for USER_BANNED code", () => {
    const wrapper = ({ children }: { readonly children: ReactNode }) => (
      <ChatProvider>{children}</ChatProvider>
    );
    renderHook(() => useChat(), { wrapper });

    act(() => {
      fireMessage({ type: "error", code: "USER_BANNED", message: "You are banned" });
    });

    expect(mockToasterError).toHaveBeenCalledWith(
      expect.objectContaining({ title: "You're banned from this room" }),
    );
  });

  it("fires toaster.error for USER_TIMED_OUT code", () => {
    const wrapper = ({ children }: { readonly children: ReactNode }) => (
      <ChatProvider>{children}</ChatProvider>
    );
    renderHook(() => useChat(), { wrapper });

    act(() => {
      fireMessage({ type: "error", code: "USER_TIMED_OUT", message: "Timeout active" });
    });

    expect(mockToasterError).toHaveBeenCalledWith(
      expect.objectContaining({ title: "You're timed out" }),
    );
  });

  it("fires toaster.error for SLOW_MODE_RATE_LIMIT code", () => {
    const wrapper = ({ children }: { readonly children: ReactNode }) => (
      <ChatProvider>{children}</ChatProvider>
    );
    renderHook(() => useChat(), { wrapper });

    act(() => {
      fireMessage({ type: "error", code: "SLOW_MODE_RATE_LIMIT", message: "Wait 5s" });
    });

    expect(mockToasterError).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Slow mode — please wait" }),
    );
  });

  it("fires toaster.error for UNAUTHORIZED code", () => {
    const wrapper = ({ children }: { readonly children: ReactNode }) => (
      <ChatProvider>{children}</ChatProvider>
    );
    renderHook(() => useChat(), { wrapper });

    act(() => {
      fireMessage({ type: "error", code: "UNAUTHORIZED", message: "Sign in required" });
    });

    expect(mockToasterError).toHaveBeenCalledWith(
      expect.objectContaining({ title: "You need to be signed in" }),
    );
  });

  it("does NOT fire toaster.error for unknown/unlisted error codes", () => {
    const wrapper = ({ children }: { readonly children: ReactNode }) => (
      <ChatProvider>{children}</ChatProvider>
    );
    renderHook(() => useChat(), { wrapper });

    act(() => {
      fireMessage({ type: "error", code: "INTERNAL_ERROR", message: "Something broke" });
    });

    expect(mockToasterError).not.toHaveBeenCalled();
  });

  it("does NOT fire toaster.error for MESSAGE_FILTERED (handled by separate event)", () => {
    // MESSAGE_FILTERED comes via a 'message_filtered' event, not an 'error' event.
    // Verify that even if someone were to send it as error code, it's not in the whitelist.
    const wrapper = ({ children }: { readonly children: ReactNode }) => (
      <ChatProvider>{children}</ChatProvider>
    );
    renderHook(() => useChat(), { wrapper });

    act(() => {
      fireMessage({ type: "error", code: "MESSAGE_FILTERED", message: "Filtered" });
    });

    expect(mockToasterError).not.toHaveBeenCalled();
  });
});
