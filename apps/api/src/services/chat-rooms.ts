import type { WSContext } from "hono/ws";

// ── Types ──

export type ChatClient = {
  readonly ws: WSContext;
  readonly userId: string | null;
  readonly userName: string | null;
  readonly avatarUrl: string | null;
};

// ── Room Manager ──

/** In-memory room membership for WebSocket message broadcasting. */
const rooms = new Map<string, Set<ChatClient>>();

/** Add a client to a room. */
export const joinRoom = (roomId: string, client: ChatClient): void => {
  if (!rooms.has(roomId)) {
    rooms.set(roomId, new Set());
  }
  rooms.get(roomId)!.add(client);
};

/** Remove a client from a room. */
export const leaveRoom = (roomId: string, client: ChatClient): void => {
  const members = rooms.get(roomId);
  if (!members) return;
  members.delete(client);
  if (members.size === 0) rooms.delete(roomId);
};

/** Remove a client from all rooms (on disconnect). */
export const leaveAllRooms = (client: ChatClient): void => {
  for (const [roomId, members] of rooms) {
    members.delete(client);
    if (members.size === 0) rooms.delete(roomId);
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
