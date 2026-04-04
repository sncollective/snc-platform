import type { WSContext } from "hono/ws";

import type {
  PresenceUser,
  RoomPresence,
  ServerPresenceEvent,
  ServerUserJoinedEvent,
  ServerUserLeftEvent,
} from "@snc/shared";

// ── Types ──

/** Represents a connected WebSocket client in a chat room. */
export type ChatClient = {
  readonly ws: WSContext;
  readonly userId: string | null;
  readonly userName: string | null;
  readonly avatarUrl: string | null;
};

// ── Room Manager ──

/** In-memory room membership for WebSocket message broadcasting. */
const rooms = new Map<string, Set<ChatClient>>();

// ── Presence Helpers ──

/** Derive deduplicated presence state for a room. */
export const getRoomPresence = (roomId: string): RoomPresence => {
  const members = rooms.get(roomId);
  if (!members) return { viewerCount: 0, users: [] };

  const seen = new Set<string>();
  const users: PresenceUser[] = [];

  for (const client of members) {
    if (client.userId && client.userName && !seen.has(client.userId)) {
      seen.add(client.userId);
      users.push({
        userId: client.userId,
        userName: client.userName,
        avatarUrl: client.avatarUrl,
      });
    }
  }

  return { viewerCount: members.size, users };
};

/**
 * Check if a userId has any other connections in a room besides the given client.
 *
 * Used to determine whether a join/leave should fire user_joined/user_left events.
 */
export const hasOtherConnections = (
  roomId: string,
  userId: string,
  excludeClient: ChatClient,
): boolean => {
  const members = rooms.get(roomId);
  if (!members) return false;
  for (const client of members) {
    if (client !== excludeClient && client.userId === userId) return true;
  }
  return false;
};

/** Get all room IDs a client belongs to. */
export const getClientRooms = (client: ChatClient): string[] => {
  const result: string[] = [];
  for (const [roomId, members] of rooms) {
    if (members.has(client)) result.push(roomId);
  }
  return result;
};

// ── Room Manager ──

/** Add a client to a room and broadcast presence events to existing members. */
export const joinRoom = (roomId: string, client: ChatClient): void => {
  if (!rooms.has(roomId)) {
    rooms.set(roomId, new Set());
  }

  // Check before adding — hasOtherConnections reflects pre-join state
  const isNewUser =
    client.userId != null && !hasOtherConnections(roomId, client.userId, client);

  rooms.get(roomId)!.add(client);

  // Broadcast user_joined if this is a new authenticated user (not a second tab)
  if (isNewUser && client.userId && client.userName) {
    broadcastToRoom(roomId, {
      type: "user_joined",
      roomId,
      userId: client.userId,
      userName: client.userName,
      avatarUrl: client.avatarUrl,
    } satisfies ServerUserJoinedEvent);
  }

  // Always broadcast updated presence (viewerCount changed)
  broadcastToRoom(roomId, {
    type: "presence",
    roomId,
    ...getRoomPresence(roomId),
  } satisfies ServerPresenceEvent);
};

/** Remove a client from a room and broadcast presence events to remaining members. */
export const leaveRoom = (roomId: string, client: ChatClient): void => {
  const members = rooms.get(roomId);
  if (!members) return;
  members.delete(client);

  // Check after removing — hasOtherConnections reflects post-leave state
  const wasLastConnection =
    client.userId != null && !hasOtherConnections(roomId, client.userId, client);

  if (members.size === 0) {
    rooms.delete(roomId);
    return; // No one left to notify
  }

  if (wasLastConnection && client.userId && client.userName) {
    broadcastToRoom(roomId, {
      type: "user_left",
      roomId,
      userId: client.userId,
      userName: client.userName,
    } satisfies ServerUserLeftEvent);
  }

  broadcastToRoom(roomId, {
    type: "presence",
    roomId,
    ...getRoomPresence(roomId),
  } satisfies ServerPresenceEvent);
};

/** Remove a client from all rooms on disconnect, broadcasting presence updates. */
export const leaveAllRooms = (client: ChatClient): void => {
  const clientRooms = getClientRooms(client);
  for (const roomId of clientRooms) {
    leaveRoom(roomId, client);
  }
};

/** Broadcast a JSON message to all clients in a room. */
export const broadcastToRoom = (roomId: string, data: unknown): void => {
  const members = rooms.get(roomId);
  if (!members) return;
  const json = JSON.stringify(data);
  for (const client of members) {
    if (client.ws.readyState === 1) {
      client.ws.send(json);
    }
  }
};

/** Get the number of connected clients in a room. */
export const getRoomClientCount = (roomId: string): number => {
  return rooms.get(roomId)?.size ?? 0;
};

// ── Connected Users Index ──

/**
 * In-memory index of userId → connected WebSocket clients.
 * Used by the notification service to push unread counts to online users
 * without coupling to chat room membership.
 */
const connectedUsers = new Map<string, Set<ChatClient>>();

/** Register a client in the connected users index. Call on WebSocket open. */
export const registerClient = (client: ChatClient): void => {
  if (!client.userId) return;
  if (!connectedUsers.has(client.userId)) {
    connectedUsers.set(client.userId, new Set());
  }
  connectedUsers.get(client.userId)!.add(client);
};

/** Unregister a client from the connected users index. Call on WebSocket close. */
export const unregisterClient = (client: ChatClient): void => {
  if (!client.userId) return;
  const clients = connectedUsers.get(client.userId);
  if (!clients) return;
  clients.delete(client);
  if (clients.size === 0) connectedUsers.delete(client.userId);
};

/** Send a JSON message to all connected WebSocket clients for a given userId. */
export const sendToUser = (userId: string, data: unknown): void => {
  const clients = connectedUsers.get(userId);
  if (!clients) return;
  const json = JSON.stringify(data);
  for (const client of clients) {
    if (client.ws.readyState === 1) {
      client.ws.send(json);
    }
  }
};

/** Check whether a user has any connected WebSocket clients. */
export const isUserConnected = (userId: string): boolean => {
  return (connectedUsers.get(userId)?.size ?? 0) > 0;
};
