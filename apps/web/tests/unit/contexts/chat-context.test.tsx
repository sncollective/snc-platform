import { describe, it, expect } from "vitest";
import { renderHook } from "@testing-library/react";
import type { ReactNode } from "react";

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
    streamSessionId: null,
    name: "Community",
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
    content: "Hello, world!",
    createdAt: "2026-03-01T00:01:00.000Z",
    ...overrides,
  };
}

// ── Tests: chatReducer ──

describe("chatReducer", () => {
  it("SET_ROOMS updates rooms", () => {
    const rooms = [makeRoom(), makeRoom({ id: "room-2", type: "stream" })];
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
    const room2 = makeRoom({ id: "room-2", type: "stream" });
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
