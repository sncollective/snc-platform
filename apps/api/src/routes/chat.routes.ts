import { Hono } from "hono";
import type { WSContext } from "hono/ws";
import { describeRoute, resolver, validator } from "hono-openapi";

import {
  ClientEventSchema,
  ChatHistoryQuerySchema,
  ChatHistoryResponseSchema,
  ActiveRoomsResponseSchema,
} from "@snc/shared";
import type { ClientEvent, ServerEvent } from "@snc/shared";

import { optionalAuth } from "../middleware/optional-auth.js";
import type { OptionalAuthEnv } from "../middleware/optional-auth.js";
import {
  createMessage,
  getMessageHistory,
  getActiveRooms,
} from "../services/chat.js";
import {
  joinRoom,
  leaveRoom,
  leaveAllRooms,
  broadcastToRoom,
} from "../services/chat-rooms.js";
import type { ChatClient } from "../services/chat-rooms.js";
import { upgradeWebSocket } from "../ws.js";
import { ERROR_400 } from "../lib/openapi-errors.js";

// ── Private Helpers ──

const sendEvent = (ws: WSContext, event: ServerEvent): void => {
  ws.send(JSON.stringify(event));
};

const sendError = (ws: WSContext, code: string, message: string): void => {
  sendEvent(ws, { type: "error", code, message });
};

// ── Public API ──

/** WebSocket chat room management and history. */
export const chatRoutes = new Hono<OptionalAuthEnv>();

// ── REST: Get Active Rooms ──

chatRoutes.get(
  "/rooms",
  describeRoute({
    description: "List active (non-closed) chat rooms",
    tags: ["chat"],
    responses: {
      200: {
        description: "Active rooms",
        content: {
          "application/json": { schema: resolver(ActiveRoomsResponseSchema) },
        },
      },
    },
  }),
  async (c) => {
    const rooms = await getActiveRooms();
    return c.json({ rooms });
  },
);

// ── REST: Get Message History ──

chatRoutes.get(
  "/rooms/:roomId/messages",
  describeRoute({
    description: "Get message history for a chat room (cursor-paginated)",
    tags: ["chat"],
    responses: {
      200: {
        description: "Message history",
        content: {
          "application/json": { schema: resolver(ChatHistoryResponseSchema) },
        },
      },
      400: ERROR_400,
    },
  }),
  validator("query", ChatHistoryQuerySchema),
  async (c) => {
    const roomId = c.req.param("roomId");
    const { before, limit } = c.req.valid("query" as never) as {
      before?: string;
      limit: number;
    };

    const result = await getMessageHistory({ roomId, before, limit });
    if (!result.ok) throw result.error;

    return c.json(result.value);
  },
);

// ── WebSocket: Chat ──

chatRoutes.get(
  "/ws",
  optionalAuth,
  upgradeWebSocket((c) => {
    const user = c.get("user");

    const client: ChatClient = {
      ws: null as unknown as WSContext,
      userId: user?.id ?? null,
      userName: user?.name ?? null,
      avatarUrl: user?.image ?? null,
    };

    return {
      onOpen(_event, ws) {
        // Patch the ws reference now that it's available
        (client as { ws: WSContext }).ws = ws;
      },

      onMessage(event, ws) {
        const raw = typeof event.data === "string" ? event.data : "";

        let parsed: ClientEvent;
        try {
          parsed = ClientEventSchema.parse(JSON.parse(raw));
        } catch {
          sendError(ws, "INVALID_MESSAGE", "Invalid message format");
          return;
        }

        switch (parsed.type) {
          case "join": {
            joinRoom(parsed.roomId, client);
            // Send recent history on join
            void getMessageHistory({ roomId: parsed.roomId, limit: 50 }).then(
              (result) => {
                if (result.ok) {
                  sendEvent(ws, {
                    type: "history",
                    roomId: parsed.roomId,
                    messages: result.value.messages,
                    hasMore: result.value.hasMore,
                  });
                }
              },
            );
            break;
          }

          case "leave": {
            leaveRoom(parsed.roomId, client);
            break;
          }

          case "message": {
            if (!client.userId || !client.userName) {
              sendError(ws, "UNAUTHORIZED", "Authentication required to send messages");
              return;
            }

            void createMessage({
              roomId: parsed.roomId,
              userId: client.userId,
              userName: client.userName,
              avatarUrl: client.avatarUrl,
              content: parsed.content,
            }).then((result) => {
              if (!result.ok) {
                sendError(ws, result.error.code, result.error.message);
                return;
              }
              broadcastToRoom(parsed.roomId, {
                type: "message",
                message: result.value,
              });
            });
            break;
          }
        }
      },

      onClose() {
        leaveAllRooms(client);
      },
    };
  }),
);
