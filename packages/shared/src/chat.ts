import { z } from "zod";

// ── Chat Room ──

export const CHAT_ROOM_TYPES = ["channel", "platform"] as const;
export type ChatRoomType = (typeof CHAT_ROOM_TYPES)[number];

export const ChatRoomSchema = z.object({
  id: z.string(),
  type: z.enum(CHAT_ROOM_TYPES),
  channelId: z.string().nullable(),
  name: z.string(),
  createdAt: z.string().datetime(),
  closedAt: z.string().datetime().nullable(),
});

export type ChatRoom = z.infer<typeof ChatRoomSchema>;

// ── Chat Message ──

export const ChatMessageSchema = z.object({
  id: z.string(),
  roomId: z.string(),
  userId: z.string(),
  userName: z.string(),
  avatarUrl: z.string().nullable(),
  content: z.string(),
  createdAt: z.string().datetime(),
});

export type ChatMessage = z.infer<typeof ChatMessageSchema>;

// ── WebSocket Events: Client → Server ──

export const ClientJoinEventSchema = z.object({
  type: z.literal("join"),
  roomId: z.string(),
});

export const ClientLeaveEventSchema = z.object({
  type: z.literal("leave"),
  roomId: z.string(),
});

export const ClientMessageEventSchema = z.object({
  type: z.literal("message"),
  roomId: z.string(),
  content: z.string().min(1).max(500),
});

export const ClientEventSchema = z.discriminatedUnion("type", [
  ClientJoinEventSchema,
  ClientLeaveEventSchema,
  ClientMessageEventSchema,
]);

export type ClientEvent = z.infer<typeof ClientEventSchema>;

// ── WebSocket Events: Server → Client ──

export type ServerMessageEvent = {
  readonly type: "message";
  readonly message: ChatMessage;
};

export type ServerHistoryEvent = {
  readonly type: "history";
  readonly roomId: string;
  readonly messages: ChatMessage[];
  readonly hasMore: boolean;
};

export type ServerRoomClosedEvent = {
  readonly type: "room_closed";
  readonly roomId: string;
};

export type ServerErrorEvent = {
  readonly type: "error";
  readonly code: string;
  readonly message: string;
};

export type ServerEvent =
  | ServerMessageEvent
  | ServerHistoryEvent
  | ServerRoomClosedEvent
  | ServerErrorEvent;

// ── Chat History Request (REST) ──

export const ChatHistoryQuerySchema = z.object({
  before: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export type ChatHistoryQuery = z.infer<typeof ChatHistoryQuerySchema>;

export const ChatHistoryResponseSchema = z.object({
  messages: z.array(ChatMessageSchema),
  hasMore: z.boolean(),
});

export type ChatHistoryResponse = z.infer<typeof ChatHistoryResponseSchema>;

// ── Active Rooms Response (REST) ──

export const ActiveRoomsResponseSchema = z.object({
  rooms: z.array(ChatRoomSchema),
});

export type ActiveRoomsResponse = z.infer<typeof ActiveRoomsResponseSchema>;
