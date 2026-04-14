import { describe, it, expect, vi } from "vitest";

import {
  joinRoom,
  leaveRoom,
  leaveAllRooms,
  broadcastToRoom,
  getRoomClientCount,
  getRoomPresence,
  hasOtherConnections,
  registerClient,
  unregisterClient,
  sendToUser,
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
      joinRoom("jr-1", client);
      expect(getRoomClientCount("jr-1")).toBe(1);
      cleanupClient(client);
    });

    it("allows multiple clients in the same room", () => {
      const client1 = makeClient({ userId: "user-1" });
      const client2 = makeClient({ userId: "user-2" });
      joinRoom("jr-2", client1);
      joinRoom("jr-2", client2);
      expect(getRoomClientCount("jr-2")).toBe(2);
      cleanupClient(client1);
      cleanupClient(client2);
    });

    it("broadcasts presence event to all existing members on join", () => {
      const existing = makeClient({ userId: "user-a" });
      joinRoom("jr-3", existing);
      vi.clearAllMocks();

      const joiner = makeClient({ userId: "user-b", userName: "Bob" });
      joinRoom("jr-3", joiner);

      // existing should receive user_joined + presence
      const existingSend = existing.ws.send as ReturnType<typeof vi.fn>;
      expect(existingSend).toHaveBeenCalledTimes(2);
      const calls = existingSend.mock.calls.map((c) => JSON.parse(c[0] as string));
      expect(calls[0]).toMatchObject({ type: "user_joined", userId: "user-b" });
      expect(calls[1]).toMatchObject({ type: "presence", viewerCount: 2 });

      cleanupClient(existing);
      cleanupClient(joiner);
    });

    it("broadcasts only presence (no user_joined) for anonymous join", () => {
      const existing = makeClient({ userId: "user-a" });
      joinRoom("jr-4", existing);
      vi.clearAllMocks();

      const anon = makeClient({ userId: null, userName: null, avatarUrl: null });
      joinRoom("jr-4", anon);

      const existingSend = existing.ws.send as ReturnType<typeof vi.fn>;
      const calls = existingSend.mock.calls.map((c) => JSON.parse(c[0] as string));
      expect(calls.every((c) => c.type !== "user_joined")).toBe(true);
      expect(calls.some((c) => c.type === "presence")).toBe(true);

      cleanupClient(existing);
      cleanupClient(anon);
    });

    it("broadcasts only presence (no user_joined) for second tab of same user", () => {
      const tab1 = makeClient({ userId: "user-a" });
      joinRoom("jr-5", tab1);
      vi.clearAllMocks();

      const tab2 = makeClient({ userId: "user-a", userName: "Alice" });
      joinRoom("jr-5", tab2);

      const tab1Send = tab1.ws.send as ReturnType<typeof vi.fn>;
      const calls = tab1Send.mock.calls.map((c) => JSON.parse(c[0] as string));
      expect(calls.every((c) => c.type !== "user_joined")).toBe(true);
      expect(calls.some((c) => c.type === "presence")).toBe(true);

      cleanupClient(tab1);
      cleanupClient(tab2);
    });
  });

  describe("leaveRoom", () => {
    it("removes client from room and decrements count", () => {
      const client = makeClient();
      joinRoom("lr-1", client);
      expect(getRoomClientCount("lr-1")).toBe(1);
      leaveRoom("lr-1", client);
      expect(getRoomClientCount("lr-1")).toBe(0);
    });

    it("cleans up empty room after last client leaves", () => {
      const client = makeClient();
      joinRoom("lr-2", client);
      leaveRoom("lr-2", client);
      // Room should be deleted — count returns 0 (default)
      expect(getRoomClientCount("lr-2")).toBe(0);
    });

    it("does nothing when room does not exist", () => {
      const client = makeClient();
      // Should not throw
      expect(() => leaveRoom("nonexistent", client)).not.toThrow();
    });

    it("broadcasts user_left + presence when last connection for that user leaves", () => {
      const stayer = makeClient({ userId: "user-a" });
      const leaver = makeClient({ userId: "user-b", userName: "Bob" });
      joinRoom("lr-3", stayer);
      joinRoom("lr-3", leaver);
      vi.clearAllMocks();

      leaveRoom("lr-3", leaver);

      const stayerSend = stayer.ws.send as ReturnType<typeof vi.fn>;
      const calls = stayerSend.mock.calls.map((c) => JSON.parse(c[0] as string));
      expect(calls[0]).toMatchObject({ type: "user_left", userId: "user-b" });
      expect(calls[1]).toMatchObject({ type: "presence", viewerCount: 1 });

      cleanupClient(stayer);
    });

    it("broadcasts only presence (no user_left) when another tab remains", () => {
      const stayer = makeClient({ userId: "user-a" });
      const tab1 = makeClient({ userId: "user-b", userName: "Bob" });
      const tab2 = makeClient({ userId: "user-b", userName: "Bob" });
      joinRoom("lr-4", stayer);
      joinRoom("lr-4", tab1);
      joinRoom("lr-4", tab2);
      vi.clearAllMocks();

      leaveRoom("lr-4", tab1);

      const stayerSend = stayer.ws.send as ReturnType<typeof vi.fn>;
      const calls = stayerSend.mock.calls.map((c) => JSON.parse(c[0] as string));
      expect(calls.every((c) => c.type !== "user_left")).toBe(true);
      expect(calls.some((c) => c.type === "presence")).toBe(true);

      cleanupClient(stayer);
      cleanupClient(tab2);
    });

    it("does not broadcast when last member leaves (room deleted)", () => {
      const solo = makeClient({ userId: "user-a" });
      joinRoom("lr-5", solo);
      vi.clearAllMocks();

      leaveRoom("lr-5", solo);

      // No one to broadcast to — send should not be called
      expect((solo.ws.send as ReturnType<typeof vi.fn>)).not.toHaveBeenCalled();
    });
  });

  describe("leaveAllRooms", () => {
    it("removes client from all rooms on disconnect", () => {
      const client = makeClient();
      joinRoom("lar-1a", client);
      joinRoom("lar-1b", client);
      expect(getRoomClientCount("lar-1a")).toBe(1);
      expect(getRoomClientCount("lar-1b")).toBe(1);

      leaveAllRooms(client);

      expect(getRoomClientCount("lar-1a")).toBe(0);
      expect(getRoomClientCount("lar-1b")).toBe(0);
    });

    it("broadcasts presence to remaining members in each room", () => {
      const stayer = makeClient({ userId: "user-a" });
      const leaver = makeClient({ userId: "user-b", userName: "Bob" });
      joinRoom("lar-2a", stayer);
      joinRoom("lar-2a", leaver);
      joinRoom("lar-2b", stayer);
      joinRoom("lar-2b", leaver);
      vi.clearAllMocks();

      leaveAllRooms(leaver);

      // stayer should receive broadcasts for both rooms
      const stayerSend = stayer.ws.send as ReturnType<typeof vi.fn>;
      expect(stayerSend.mock.calls.length).toBeGreaterThanOrEqual(2);

      cleanupClient(stayer);
    });
  });

  describe("broadcastToRoom", () => {
    it("sends to all clients with readyState OPEN (1)", () => {
      const client1 = makeClient({ userId: "user-1" });
      const client2 = makeClient({ userId: "user-2" });
      joinRoom("br-1", client1);
      joinRoom("br-1", client2);
      vi.clearAllMocks();

      broadcastToRoom("br-1", { type: "message", content: "Hello" });

      expect((client1.ws.send as ReturnType<typeof vi.fn>)).toHaveBeenCalledTimes(1);
      expect((client2.ws.send as ReturnType<typeof vi.fn>)).toHaveBeenCalledTimes(1);

      cleanupClient(client1);
      cleanupClient(client2);
    });

    it("skips clients with closed readyState", () => {
      const openClient = makeClient({ userId: "user-1" });
      const closedWs = makeMockWs(3); // CLOSED
      const closedClient = makeClient({
        userId: "user-2",
        ws: closedWs as unknown as ChatClient["ws"],
      });

      joinRoom("br-2", openClient);
      joinRoom("br-2", closedClient);
      vi.clearAllMocks();

      broadcastToRoom("br-2", { type: "message", content: "Hello" });

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

  describe("getRoomPresence", () => {
    it("returns empty presence for nonexistent room", () => {
      expect(getRoomPresence("grp-nonexistent")).toEqual({
        viewerCount: 0,
        users: [],
      });
    });

    it("returns single authenticated user", () => {
      const client = makeClient({ userId: "u1", userName: "Alice", avatarUrl: null });
      joinRoom("grp-1", client);

      const presence = getRoomPresence("grp-1");
      expect(presence.viewerCount).toBe(1);
      expect(presence.users).toHaveLength(1);
      expect(presence.users[0]).toMatchObject({ userId: "u1", userName: "Alice" });

      cleanupClient(client);
    });

    it("deduplicates multi-tab user — appears once in users list", () => {
      const tab1 = makeClient({ userId: "u1", userName: "Alice" });
      const tab2 = makeClient({ userId: "u1", userName: "Alice" });
      joinRoom("grp-2", tab1);
      joinRoom("grp-2", tab2);

      const presence = getRoomPresence("grp-2");
      expect(presence.viewerCount).toBe(2); // both tabs count
      expect(presence.users).toHaveLength(1); // but one user entry

      cleanupClient(tab1);
      cleanupClient(tab2);
    });

    it("counts anonymous viewers but excludes them from users list", () => {
      const auth = makeClient({ userId: "u1", userName: "Alice" });
      const anon = makeClient({ userId: null, userName: null, avatarUrl: null });
      joinRoom("grp-3", auth);
      joinRoom("grp-3", anon);

      const presence = getRoomPresence("grp-3");
      expect(presence.viewerCount).toBe(2);
      expect(presence.users).toHaveLength(1);
      expect(presence.users[0]).toMatchObject({ userId: "u1" });

      cleanupClient(auth);
      cleanupClient(anon);
    });

    it("returns only anonymous viewers with empty users list", () => {
      const anon1 = makeClient({ userId: null, userName: null, avatarUrl: null });
      const anon2 = makeClient({ userId: null, userName: null, avatarUrl: null });
      joinRoom("grp-4", anon1);
      joinRoom("grp-4", anon2);

      const presence = getRoomPresence("grp-4");
      expect(presence.viewerCount).toBe(2);
      expect(presence.users).toHaveLength(0);

      cleanupClient(anon1);
      cleanupClient(anon2);
    });
  });

  describe("hasOtherConnections", () => {
    it("returns true when another connection exists for that userId", () => {
      const tab1 = makeClient({ userId: "u1" });
      const tab2 = makeClient({ userId: "u1" });
      joinRoom("hoc-1", tab1);
      joinRoom("hoc-1", tab2);

      expect(hasOtherConnections("hoc-1", "u1", tab1)).toBe(true);

      cleanupClient(tab1);
      cleanupClient(tab2);
    });

    it("returns false when the excluded client is the only connection for that userId", () => {
      const client = makeClient({ userId: "u1" });
      joinRoom("hoc-2", client);

      expect(hasOtherConnections("hoc-2", "u1", client)).toBe(false);

      cleanupClient(client);
    });

    it("returns false for nonexistent room", () => {
      const client = makeClient({ userId: "u1" });
      expect(hasOtherConnections("hoc-nonexistent", "u1", client)).toBe(false);
    });

    it("returns false when only other connections belong to different users", () => {
      const client1 = makeClient({ userId: "u1" });
      const client2 = makeClient({ userId: "u2" });
      joinRoom("hoc-3", client1);
      joinRoom("hoc-3", client2);

      expect(hasOtherConnections("hoc-3", "u1", client1)).toBe(false);

      cleanupClient(client1);
      cleanupClient(client2);
    });
  });

  describe("registerClient / unregisterClient", () => {
    it("registerClient adds authenticated client to connectedUsers", () => {
      const client = makeClient({ userId: "ru-1" });
      registerClient(client);

      // sendToUser should deliver to this client
      sendToUser("ru-1", { type: "notification_count", count: 1 });
      expect((client.ws.send as ReturnType<typeof vi.fn>)).toHaveBeenCalledTimes(1);

      unregisterClient(client);
    });

    it("unregisterClient removes client from connectedUsers", () => {
      const client = makeClient({ userId: "uc-1" });
      registerClient(client);
      unregisterClient(client);

      vi.clearAllMocks();
      sendToUser("uc-1", { type: "notification_count", count: 0 });
      expect((client.ws.send as ReturnType<typeof vi.fn>)).not.toHaveBeenCalled();
    });

    it("handles multiple tabs for the same user", () => {
      const tab1 = makeClient({ userId: "mt-1" });
      const tab2 = makeClient({ userId: "mt-1" });
      registerClient(tab1);
      registerClient(tab2);

      sendToUser("mt-1", { type: "notification_count", count: 2 });
      expect((tab1.ws.send as ReturnType<typeof vi.fn>)).toHaveBeenCalledTimes(1);
      expect((tab2.ws.send as ReturnType<typeof vi.fn>)).toHaveBeenCalledTimes(1);

      unregisterClient(tab1);
      unregisterClient(tab2);
    });

    it("skips anonymous clients (null userId)", () => {
      const anon = makeClient({ userId: null, userName: null, avatarUrl: null });
      // Should not throw
      expect(() => registerClient(anon)).not.toThrow();
      expect(() => unregisterClient(anon)).not.toThrow();
    });
  });

  describe("sendToUser", () => {
    it("delivers JSON message to all connected clients for a userId", () => {
      const client = makeClient({ userId: "stu-1" });
      registerClient(client);

      sendToUser("stu-1", { type: "notification_count", count: 5 });

      const send = client.ws.send as ReturnType<typeof vi.fn>;
      expect(send).toHaveBeenCalledTimes(1);
      expect(JSON.parse(send.mock.calls[0]?.[0] as string)).toEqual({
        type: "notification_count",
        count: 5,
      });

      unregisterClient(client);
    });

    it("is a no-op for unknown userId", () => {
      // Should not throw
      expect(() => sendToUser("unknown-user", { type: "notification_count", count: 0 })).not.toThrow();
    });

    it("skips clients with closed readyState", () => {
      const closedWs = makeMockWs(3); // CLOSED
      const client = makeClient({
        userId: "closed-1",
        ws: closedWs as unknown as ChatClient["ws"],
      });
      registerClient(client);

      sendToUser("closed-1", { type: "notification_count", count: 1 });
      expect(closedWs.send).not.toHaveBeenCalled();

      unregisterClient(client);
    });
  });
});
