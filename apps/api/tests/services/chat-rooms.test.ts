import { describe, it, expect, vi } from "vitest";

import {
  joinRoom,
  leaveRoom,
  leaveAllRooms,
  broadcastToRoom,
  getRoomClientCount,
} from "../../src/services/chat-rooms.js";
import type { ChatClient } from "../../src/services/chat-rooms.js";

// ── Helpers ──

const makeMockWs = (readyState = 1) => ({
  readyState,
  send: vi.fn(),
});

const makeClient = (overrides?: Partial<ChatClient>): ChatClient => ({
  ws: makeMockWs() as unknown as ChatClient["ws"],
  userId: "user-1",
  userName: "Alice",
  avatarUrl: null,
  ...overrides,
});

// ── Cleanup helper ──

// Since rooms is module-level state, clean up after each test
const cleanupClient = (client: ChatClient) => leaveAllRooms(client);

// ── Tests ──

describe("chat room manager", () => {
  describe("joinRoom", () => {
    it("adds client to room and increments count", () => {
      const client = makeClient();
      joinRoom("room-1", client);
      expect(getRoomClientCount("room-1")).toBe(1);
      cleanupClient(client);
    });

    it("allows multiple clients in the same room", () => {
      const client1 = makeClient({ userId: "user-1" });
      const client2 = makeClient({ userId: "user-2" });
      joinRoom("room-2", client1);
      joinRoom("room-2", client2);
      expect(getRoomClientCount("room-2")).toBe(2);
      cleanupClient(client1);
      cleanupClient(client2);
    });
  });

  describe("leaveRoom", () => {
    it("removes client from room and decrements count", () => {
      const client = makeClient();
      joinRoom("room-3", client);
      expect(getRoomClientCount("room-3")).toBe(1);
      leaveRoom("room-3", client);
      expect(getRoomClientCount("room-3")).toBe(0);
    });

    it("cleans up empty room after last client leaves", () => {
      const client = makeClient();
      joinRoom("room-4", client);
      leaveRoom("room-4", client);
      // Room should be deleted — count returns 0 (default)
      expect(getRoomClientCount("room-4")).toBe(0);
    });

    it("does nothing when room does not exist", () => {
      const client = makeClient();
      // Should not throw
      expect(() => leaveRoom("nonexistent", client)).not.toThrow();
    });
  });

  describe("leaveAllRooms", () => {
    it("removes client from all rooms on disconnect", () => {
      const client = makeClient();
      joinRoom("room-5a", client);
      joinRoom("room-5b", client);
      expect(getRoomClientCount("room-5a")).toBe(1);
      expect(getRoomClientCount("room-5b")).toBe(1);

      leaveAllRooms(client);

      expect(getRoomClientCount("room-5a")).toBe(0);
      expect(getRoomClientCount("room-5b")).toBe(0);
    });
  });

  describe("broadcastToRoom", () => {
    it("sends to all clients with readyState OPEN (1)", () => {
      const client1 = makeClient();
      const client2 = makeClient({ userId: "user-2" });
      joinRoom("room-6", client1);
      joinRoom("room-6", client2);

      broadcastToRoom("room-6", { type: "message", content: "Hello" });

      expect((client1.ws.send as ReturnType<typeof vi.fn>)).toHaveBeenCalledTimes(1);
      expect((client2.ws.send as ReturnType<typeof vi.fn>)).toHaveBeenCalledTimes(1);

      cleanupClient(client1);
      cleanupClient(client2);
    });

    it("skips clients with closed readyState", () => {
      const openClient = makeClient();
      const closedWs = makeMockWs(3); // CLOSED
      const closedClient = makeClient({
        userId: "user-2",
        ws: closedWs as unknown as ChatClient["ws"],
      });

      joinRoom("room-7", openClient);
      joinRoom("room-7", closedClient);

      broadcastToRoom("room-7", { type: "message", content: "Hello" });

      expect((openClient.ws.send as ReturnType<typeof vi.fn>)).toHaveBeenCalledTimes(1);
      expect(closedWs.send).not.toHaveBeenCalled();

      cleanupClient(openClient);
      cleanupClient(closedClient);
    });

    it("does nothing when room does not exist", () => {
      // Should not throw
      expect(() => broadcastToRoom("nonexistent", { type: "ping" })).not.toThrow();
    });
  });

  describe("getRoomClientCount", () => {
    it("returns 0 for nonexistent room", () => {
      expect(getRoomClientCount("does-not-exist")).toBe(0);
    });
  });
});
