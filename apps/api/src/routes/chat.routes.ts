import { Hono } from "hono";
import type { WSContext } from "hono/ws";
import { describeRoute, resolver, validator } from "hono-openapi";
import { z } from "zod";

import {
  AppError,
  ClientEventSchema,
  ChatHistoryQuerySchema,
  ChatHistoryResponseSchema,
  ActiveRoomsResponseSchema,
  ModerationHistoryQuerySchema,
  CreateWordFilterSchema,
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
  getRoomPresence,
  registerClient,
  unregisterClient,
} from "../services/chat-rooms.js";
import type { ChatClient } from "../services/chat-rooms.js";
import {
  timeoutUser,
  banUser,
  unbanUser,
  setSlowMode,
  getModerationHistory,
  getActiveSanctions,
} from "../services/chat-moderation.js";
import {
  addWordFilter,
  removeWordFilter,
  getWordFilters,
} from "../services/chat-word-filters.js";
import {
  addReaction,
  removeReaction,
  getReactionsForMessage,
  getReactionsBatch,
} from "../services/chat-reactions.js";
import { upgradeWebSocket } from "../ws.js";
import { ERROR_400 } from "../lib/openapi-errors.js";

// ── Param Schemas ──

const RoomIdParam = z.object({ roomId: z.string().min(1) });

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
  validator("param", RoomIdParam),
  validator("query", ChatHistoryQuerySchema),
  async (c) => {
    const { roomId } = c.req.valid("param" as never) as { roomId: string };
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
        registerClient(client);
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

            // Send current presence state to the joining client
            const presence = getRoomPresence(parsed.roomId);
            sendEvent(ws, {
              type: "presence",
              roomId: parsed.roomId,
              viewerCount: presence.viewerCount,
              users: presence.users,
            });

            // Send recent history on join, followed by reactions batch
            void getMessageHistory({ roomId: parsed.roomId, limit: 50 }).then(
              async (result) => {
                if (result.ok) {
                  sendEvent(ws, {
                    type: "history",
                    roomId: parsed.roomId,
                    messages: result.value.messages,
                    hasMore: result.value.hasMore,
                  });

                  // Send reactions for the history batch immediately after
                  const messageIds = result.value.messages.map((m) => m.id);
                  const reactionsResult = await getReactionsBatch(messageIds, client.userId);
                  if (reactionsResult.ok) {
                    sendEvent(ws, {
                      type: "reactions_batch",
                      roomId: parsed.roomId,
                      reactions: reactionsResult.value,
                    });
                  }
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
                if (result.error.code === "MESSAGE_FILTERED") {
                  sendEvent(ws, { type: "message_filtered", roomId: parsed.roomId });
                  return;
                }
                // Defense-in-depth: only forward known AppError messages
                const errorMessage = result.error instanceof AppError
                  ? result.error.message
                  : "An error occurred";
                sendError(ws, result.error.code ?? "INTERNAL_ERROR", errorMessage);
                return;
              }
              broadcastToRoom(parsed.roomId, {
                type: "message",
                message: result.value,
              });
            });
            break;
          }

          case "timeout": {
            if (!client.userId || !client.userName) {
              sendError(ws, "UNAUTHORIZED", "Authentication required");
              return;
            }
            void timeoutUser({
              roomId: parsed.roomId,
              targetUserId: parsed.targetUserId,
              moderatorUserId: client.userId,
              moderatorUserName: client.userName,
              durationSeconds: parsed.durationSeconds,
              reason: parsed.reason,
            }).then((result) => {
              if (!result.ok) {
                const errorMessage = result.error instanceof AppError
                  ? result.error.message
                  : "An error occurred";
                sendError(ws, result.error.code ?? "INTERNAL_ERROR", errorMessage);
                return;
              }
              broadcastToRoom(parsed.roomId, {
                type: "user_timed_out",
                roomId: parsed.roomId,
                targetUserId: parsed.targetUserId,
                targetUserName: result.value.targetUserName,
                moderatorUserName: client.userName!,
                durationSeconds: parsed.durationSeconds,
                expiresAt: result.value.expiresAt!,
              });
            });
            break;
          }

          case "ban": {
            if (!client.userId || !client.userName) {
              sendError(ws, "UNAUTHORIZED", "Authentication required");
              return;
            }
            void banUser({
              roomId: parsed.roomId,
              targetUserId: parsed.targetUserId,
              moderatorUserId: client.userId,
              moderatorUserName: client.userName,
              reason: parsed.reason,
            }).then((result) => {
              if (!result.ok) {
                const errorMessage = result.error instanceof AppError
                  ? result.error.message
                  : "An error occurred";
                sendError(ws, result.error.code ?? "INTERNAL_ERROR", errorMessage);
                return;
              }
              broadcastToRoom(parsed.roomId, {
                type: "user_banned",
                roomId: parsed.roomId,
                targetUserId: parsed.targetUserId,
                targetUserName: result.value.targetUserName,
                moderatorUserName: client.userName!,
              });
            });
            break;
          }

          case "unban": {
            if (!client.userId || !client.userName) {
              sendError(ws, "UNAUTHORIZED", "Authentication required");
              return;
            }
            void unbanUser({
              roomId: parsed.roomId,
              targetUserId: parsed.targetUserId,
              moderatorUserId: client.userId,
              moderatorUserName: client.userName,
            }).then((result) => {
              if (!result.ok) {
                const errorMessage = result.error instanceof AppError
                  ? result.error.message
                  : "An error occurred";
                sendError(ws, result.error.code ?? "INTERNAL_ERROR", errorMessage);
                return;
              }
              broadcastToRoom(parsed.roomId, {
                type: "user_unbanned",
                roomId: parsed.roomId,
                targetUserId: parsed.targetUserId,
                targetUserName: result.value.targetUserName,
                moderatorUserName: client.userName!,
              });
            });
            break;
          }

          case "set_slow_mode": {
            if (!client.userId || !client.userName) {
              sendError(ws, "UNAUTHORIZED", "Authentication required");
              return;
            }
            void setSlowMode({
              roomId: parsed.roomId,
              moderatorUserId: client.userId,
              seconds: parsed.seconds,
            }).then((result) => {
              if (!result.ok) {
                const errorMessage = result.error instanceof AppError
                  ? result.error.message
                  : "An error occurred";
                sendError(ws, result.error.code ?? "INTERNAL_ERROR", errorMessage);
                return;
              }
              broadcastToRoom(parsed.roomId, {
                type: "slow_mode_changed",
                roomId: parsed.roomId,
                seconds: parsed.seconds,
                moderatorUserName: client.userName!,
              });
            });
            break;
          }

          case "add_reaction": {
            if (!client.userId) {
              sendError(ws, "UNAUTHORIZED", "Authentication required to react");
              return;
            }
            void addReaction({
              messageId: parsed.messageId,
              roomId: parsed.roomId,
              userId: client.userId,
              emoji: parsed.emoji,
            }).then((result) => {
              if (!result.ok) {
                const errorMessage = result.error instanceof AppError
                  ? result.error.message
                  : "An error occurred";
                sendError(ws, result.error.code ?? "INTERNAL_ERROR", errorMessage);
                return;
              }
              broadcastToRoom(parsed.roomId, {
                type: "reaction_updated",
                roomId: parsed.roomId,
                messageId: parsed.messageId,
                emoji: parsed.emoji,
                count: result.value.count,
                reactedByUserId: client.userId!,
                userIds: result.value.userIds,
              });
            });
            break;
          }

          case "remove_reaction": {
            if (!client.userId) {
              sendError(ws, "UNAUTHORIZED", "Authentication required to react");
              return;
            }
            void removeReaction({
              messageId: parsed.messageId,
              roomId: parsed.roomId,
              userId: client.userId,
              emoji: parsed.emoji,
            }).then((result) => {
              if (!result.ok) {
                const errorMessage = result.error instanceof AppError
                  ? result.error.message
                  : "An error occurred";
                sendError(ws, result.error.code ?? "INTERNAL_ERROR", errorMessage);
                return;
              }
              broadcastToRoom(parsed.roomId, {
                type: "reaction_updated",
                roomId: parsed.roomId,
                messageId: parsed.messageId,
                emoji: parsed.emoji,
                count: result.value.count,
                reactedByUserId: null,
                userIds: result.value.userIds,
              });
            });
            break;
          }
        }
      },

      onClose() {
        leaveAllRooms(client);
        unregisterClient(client);
      },
    };
  }),
);

// ── REST: Get Moderation History ──

chatRoutes.get(
  "/rooms/:roomId/moderation",
  describeRoute({
    description: "Get moderation action history for a room",
    tags: ["chat"],
  }),
  optionalAuth,
  validator("param", RoomIdParam),
  validator("query", ModerationHistoryQuerySchema),
  async (c) => {
    const user = c.get("user");
    if (!user) {
      throw new AppError("UNAUTHORIZED", "Authentication required", 401);
    }
    const { roomId } = c.req.valid("param" as never) as { roomId: string };
    const { before, limit } = c.req.valid("query" as never) as {
      before?: string;
      limit: number;
    };

    const result = await getModerationHistory({ roomId, before, limit });
    if (!result.ok) throw result.error;

    return c.json(result.value);
  },
);

// ── REST: Get Active Sanctions ──

chatRoutes.get(
  "/rooms/:roomId/moderation/active",
  describeRoute({
    description: "Get active bans and timeouts for a room",
    tags: ["chat"],
  }),
  optionalAuth,
  validator("param", RoomIdParam),
  async (c) => {
    const user = c.get("user");
    if (!user) {
      throw new AppError("UNAUTHORIZED", "Authentication required", 401);
    }
    const { roomId } = c.req.valid("param" as never) as { roomId: string };

    const result = await getActiveSanctions(roomId);
    if (!result.ok) throw result.error;

    return c.json({ sanctions: result.value });
  },
);

// ── REST: List Word Filters ──

chatRoutes.get(
  "/rooms/:roomId/filters",
  describeRoute({
    description: "List word filters for a room",
    tags: ["chat"],
  }),
  optionalAuth,
  validator("param", RoomIdParam),
  async (c) => {
    const user = c.get("user");
    if (!user) {
      throw new AppError("UNAUTHORIZED", "Authentication required", 401);
    }
    const { roomId } = c.req.valid("param" as never) as { roomId: string };

    const result = await getWordFilters(roomId);
    if (!result.ok) throw result.error;

    return c.json({ filters: result.value });
  },
);

// ── REST: Add Word Filter ──

chatRoutes.post(
  "/rooms/:roomId/filters",
  describeRoute({
    description: "Add a word filter to a room",
    tags: ["chat"],
    responses: {
      400: ERROR_400,
    },
  }),
  optionalAuth,
  validator("param", RoomIdParam),
  validator("json", CreateWordFilterSchema),
  async (c) => {
    const user = c.get("user");
    if (!user) {
      throw new AppError("UNAUTHORIZED", "Authentication required", 401);
    }
    const { roomId } = c.req.valid("param" as never) as { roomId: string };
    const body = c.req.valid("json" as never) as {
      pattern: string;
      isRegex: boolean;
    };

    const result = await addWordFilter({
      roomId,
      moderatorUserId: user.id,
      pattern: body.pattern,
      isRegex: body.isRegex,
    });
    if (!result.ok) throw result.error;

    return c.json(result.value, 201);
  },
);

// ── REST: Remove Word Filter ──

chatRoutes.delete(
  "/rooms/:roomId/filters/:filterId",
  describeRoute({
    description: "Remove a word filter from a room",
    tags: ["chat"],
  }),
  optionalAuth,
  validator("param", z.object({ roomId: z.string().min(1), filterId: z.string().min(1) })),
  async (c) => {
    const user = c.get("user");
    if (!user) {
      throw new AppError("UNAUTHORIZED", "Authentication required", 401);
    }
    const { filterId } = c.req.valid("param" as never) as {
      roomId: string;
      filterId: string;
    };

    const result = await removeWordFilter({
      filterId,
      moderatorUserId: user.id,
    });
    if (!result.ok) throw result.error;

    return c.body(null, 204);
  },
);

// ── REST: Get Reactions for a Message ──

const MessageReactionParams = z.object({
  roomId: z.string().min(1),
  messageId: z.string().min(1),
});

chatRoutes.get(
  "/rooms/:roomId/messages/:messageId/reactions",
  describeRoute({
    description: "Get all reactions for a message (lazy load)",
    tags: ["chat"],
    responses: {
      200: {
        description: "Reactions by emoji",
        content: { "application/json": { schema: resolver(z.object({ reactions: z.array(z.object({})) })) } },
      },
    },
  }),
  optionalAuth,
  validator("param", MessageReactionParams),
  async (c) => {
    const user = c.get("user");
    const { messageId } = c.req.valid("param" as never) as {
      roomId: string;
      messageId: string;
    };

    const result = await getReactionsForMessage(messageId, user?.id ?? null);
    if (!result.ok) throw result.error;

    return c.json({ reactions: result.value });
  },
);
