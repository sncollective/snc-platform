"use no memo";

import {
  createContext,
  useContext,
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
} from "react";
import type React from "react";
import type { ReactNode } from "react";

import type { ChatMessage, ChatRoom, MessageReaction, PresenceUser, ReactionEmoji, ServerEvent } from "@snc/shared";

// ── Public Types ──

export interface ChatState {
  readonly rooms: ChatRoom[];
  readonly activeRoomId: string | null;
  readonly messages: readonly ChatMessage[];
  readonly hasMore: boolean;
  readonly isConnected: boolean;
  readonly viewerCount: number;
  readonly users: readonly PresenceUser[];
  readonly slowModeSeconds: number;
  readonly isTimedOut: boolean;
  readonly timedOutUntil: string | null;
  readonly isBanned: boolean;
  readonly lastFilteredAt: number | null;
  readonly isModerator: boolean;
  /** Map of messageId to per-emoji reaction state */
  readonly reactions: ReadonlyMap<string, readonly MessageReaction[]>;
}

export interface ChatActions {
  readonly joinRoom: (roomId: string) => void;
  readonly leaveRoom: (roomId: string) => void;
  readonly sendMessage: (content: string) => void;
  readonly setActiveRoom: (roomId: string) => void;
  readonly setRooms: (rooms: ChatRoom[]) => void;
  readonly timeoutUser: (targetUserId: string, durationSeconds: number, reason?: string) => void;
  readonly banUser: (targetUserId: string, reason?: string) => void;
  readonly unbanUser: (targetUserId: string) => void;
  readonly setSlowMode: (seconds: number) => void;
  readonly addReaction: (messageId: string, emoji: ReactionEmoji) => void;
  readonly removeReaction: (messageId: string, emoji: ReactionEmoji) => void;
}

export interface ChatContextValue {
  readonly state: ChatState;
  readonly actions: ChatActions;
}

// ── Constants ──

export const INITIAL_STATE: ChatState = {
  rooms: [],
  activeRoomId: null,
  messages: [],
  hasMore: false,
  isConnected: false,
  viewerCount: 0,
  users: [],
  slowModeSeconds: 0,
  isTimedOut: false,
  timedOutUntil: null,
  isBanned: false,
  lastFilteredAt: null,
  isModerator: false,
  reactions: new Map(),
};

// ── Reducer ──

type ChatAction =
  | { readonly type: "SET_ROOMS"; readonly rooms: ChatRoom[] }
  | { readonly type: "SET_ACTIVE_ROOM"; readonly roomId: string }
  | { readonly type: "SET_CONNECTED"; readonly isConnected: boolean }
  | { readonly type: "SET_HISTORY"; readonly messages: ChatMessage[]; readonly hasMore: boolean }
  | { readonly type: "ADD_MESSAGE"; readonly message: ChatMessage }
  | { readonly type: "ROOM_CLOSED"; readonly roomId: string }
  | { readonly type: "CLEAR_MESSAGES" }
  | { readonly type: "SET_PRESENCE"; readonly viewerCount: number; readonly users: readonly PresenceUser[] }
  | { readonly type: "USER_JOINED"; readonly user: PresenceUser }
  | { readonly type: "USER_LEFT"; readonly userId: string }
  | { readonly type: "SET_SLOW_MODE"; readonly seconds: number }
  | { readonly type: "SET_TIMED_OUT"; readonly until: string | null }
  | { readonly type: "SET_BANNED"; readonly banned: boolean }
  | { readonly type: "MESSAGE_FILTERED" }
  | { readonly type: "SET_MODERATOR"; readonly isModerator: boolean }
  | { readonly type: "CLEAR_FILTERED" }
  | { readonly type: "SET_REACTIONS_BATCH"; readonly reactions: Record<string, readonly MessageReaction[]> }
  | { readonly type: "UPDATE_REACTION"; readonly messageId: string; readonly emoji: ReactionEmoji; readonly count: number; readonly userIds: readonly string[]; readonly currentUserId: string | null };

/** Pure reducer for chat state. Exported for unit testing. */
export function chatReducer(
  state: ChatState,
  action: ChatAction,
): ChatState {
  switch (action.type) {
    case "SET_ROOMS":
      return { ...state, rooms: action.rooms };
    case "SET_ACTIVE_ROOM":
      return {
        ...state,
        activeRoomId: action.roomId,
        messages: [],
        hasMore: false,
        viewerCount: 0,
        users: [],
        slowModeSeconds: 0,
        isTimedOut: false,
        timedOutUntil: null,
        isBanned: false,
        lastFilteredAt: null,
        isModerator: false,
        reactions: new Map(),
      };
    case "SET_CONNECTED":
      return { ...state, isConnected: action.isConnected };
    case "SET_HISTORY":
      return { ...state, messages: action.messages, hasMore: action.hasMore };
    case "ADD_MESSAGE":
      return {
        ...state,
        messages: state.activeRoomId === action.message.roomId
          ? [...state.messages, action.message]
          : state.messages,
      };
    case "ROOM_CLOSED":
      return {
        ...state,
        rooms: state.rooms.map((r) =>
          r.id === action.roomId
            ? { ...r, closedAt: new Date().toISOString() }
            : r,
        ),
      };
    case "CLEAR_MESSAGES":
      return { ...state, messages: [], hasMore: false };
    case "SET_PRESENCE":
      return { ...state, viewerCount: action.viewerCount, users: action.users };
    case "USER_JOINED":
      return {
        ...state,
        users: state.users.some((u) => u.userId === action.user.userId)
          ? state.users
          : [...state.users, action.user],
      };
    case "USER_LEFT":
      return {
        ...state,
        users: state.users.filter((u) => u.userId !== action.userId),
      };
    case "SET_SLOW_MODE":
      return { ...state, slowModeSeconds: action.seconds };
    case "SET_TIMED_OUT":
      return {
        ...state,
        isTimedOut: action.until !== null,
        timedOutUntil: action.until,
      };
    case "SET_BANNED":
      return { ...state, isBanned: action.banned };
    case "MESSAGE_FILTERED":
      return { ...state, lastFilteredAt: Date.now() };
    case "CLEAR_FILTERED":
      return { ...state, lastFilteredAt: null };
    case "SET_MODERATOR":
      return { ...state, isModerator: action.isModerator };
    case "SET_REACTIONS_BATCH": {
      const next = new Map(state.reactions);
      for (const [messageId, emojis] of Object.entries(action.reactions)) {
        next.set(messageId, emojis);
      }
      return { ...state, reactions: next };
    }
    case "UPDATE_REACTION": {
      const existing = state.reactions.get(action.messageId) ?? [];
      const otherEmojis = existing.filter((r) => r.emoji !== action.emoji);
      const updated: MessageReaction[] = action.count > 0
        ? [
            ...otherEmojis,
            {
              emoji: action.emoji,
              count: action.count,
              reactedByMe: action.currentUserId !== null
                && action.userIds.includes(action.currentUserId),
            },
          ]
        : otherEmojis;

      const next = new Map(state.reactions);
      next.set(action.messageId, updated);
      return { ...state, reactions: next };
    }
    default:
      return state;
  }
}

// ── Context ──

const ChatContext = createContext<ChatContextValue | null>(null);

// ── Provider ──

/** Manage global chat state and WebSocket connection. Consume with `useChat`. */
export function ChatProvider({
  children,
  userId = null,
}: {
  readonly children: ReactNode;
  readonly userId?: string | null;
}): React.ReactElement {
  const [state, dispatch] = useReducer(chatReducer, INITIAL_STATE);
  const userIdRef = useRef<string | null>(userId);
  userIdRef.current = userId;
  const wsRef = useRef<WebSocket | null>(null);
  const activeRoomRef = useRef<string | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const reconnectAttemptsRef = useRef(0);

  // Keep ref in sync with state for use in WebSocket callbacks
  activeRoomRef.current = state.activeRoomId;

  const connect = useCallback(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(`${protocol}//${window.location.host}/api/chat/ws`);

    ws.onopen = () => {
      dispatch({ type: "SET_CONNECTED", isConnected: true });
      reconnectAttemptsRef.current = 0;

      // Re-join active room on reconnect
      if (activeRoomRef.current && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "join", roomId: activeRoomRef.current }));
      }
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data as string) as ServerEvent;
        switch (data.type) {
          case "message":
            dispatch({ type: "ADD_MESSAGE", message: data.message });
            break;
          case "history":
            dispatch({
              type: "SET_HISTORY",
              messages: data.messages,
              hasMore: data.hasMore,
            });
            break;
          case "room_closed":
            dispatch({ type: "ROOM_CLOSED", roomId: data.roomId });
            break;
          case "error":
            // Errors are displayed by the UI — no dispatch needed
            break;
          case "presence":
            dispatch({
              type: "SET_PRESENCE",
              viewerCount: data.viewerCount,
              users: data.users,
            });
            break;
          case "user_joined":
            dispatch({
              type: "USER_JOINED",
              user: {
                userId: data.userId,
                userName: data.userName,
                avatarUrl: data.avatarUrl,
              },
            });
            break;
          case "user_left":
            dispatch({ type: "USER_LEFT", userId: data.userId });
            break;
          case "notification_count":
            // Handled by NotificationProvider at app root — ignore here
            break;
          case "slow_mode_changed":
            dispatch({ type: "SET_SLOW_MODE", seconds: data.seconds });
            break;
          case "user_timed_out":
            // Note: server broadcasts to all room members; individual UI components
            // should compare targetUserId against the current user before rendering
            // timed-out state. The SET_TIMED_OUT action stores the most recent event.
            dispatch({ type: "SET_TIMED_OUT", until: data.expiresAt });
            break;
          case "user_banned":
            dispatch({ type: "SET_BANNED", banned: true });
            break;
          case "user_unbanned":
            dispatch({ type: "SET_BANNED", banned: false });
            break;
          case "message_filtered":
            dispatch({ type: "MESSAGE_FILTERED" });
            setTimeout(() => dispatch({ type: "CLEAR_FILTERED" }), 3000);
            break;
          case "reactions_batch":
            dispatch({ type: "SET_REACTIONS_BATCH", reactions: data.reactions });
            break;
          case "reaction_updated":
            dispatch({
              type: "UPDATE_REACTION",
              messageId: data.messageId,
              emoji: data.emoji,
              count: data.count,
              userIds: data.userIds,
              currentUserId: userIdRef.current,
            });
            break;
        }
      } catch {
        // Malformed message — ignore
      }
    };

    ws.onclose = () => {
      dispatch({ type: "SET_CONNECTED", isConnected: false });
      wsRef.current = null;

      // Exponential backoff reconnect
      const delay = Math.min(1000 * 2 ** reconnectAttemptsRef.current, 30_000);
      reconnectAttemptsRef.current += 1;
      reconnectTimeoutRef.current = setTimeout(connect, delay);
    };

    wsRef.current = ws;
  }, []);

  useEffect(() => {
    connect();
    return () => {
      clearTimeout(reconnectTimeoutRef.current);
      wsRef.current?.close();
    };
  }, [connect]);

  const safeSend = useCallback((data: string) => {
    const ws = wsRef.current;
    if (ws?.readyState === WebSocket.OPEN) ws.send(data);
  }, []);

  const actions = useMemo(
    (): ChatActions => ({
      joinRoom: (roomId: string) => {
        safeSend(JSON.stringify({ type: "join", roomId }));
      },
      leaveRoom: (roomId: string) => {
        safeSend(JSON.stringify({ type: "leave", roomId }));
      },
      sendMessage: (content: string) => {
        if (!activeRoomRef.current) return;
        safeSend(
          JSON.stringify({
            type: "message",
            roomId: activeRoomRef.current,
            content,
          }),
        );
      },
      setActiveRoom: (roomId: string) => {
        // Leave old room
        if (activeRoomRef.current) {
          safeSend(
            JSON.stringify({ type: "leave", roomId: activeRoomRef.current }),
          );
        }
        dispatch({ type: "SET_ACTIVE_ROOM", roomId });
        // Join new room
        safeSend(JSON.stringify({ type: "join", roomId }));
      },
      setRooms: (rooms: ChatRoom[]) => {
        dispatch({ type: "SET_ROOMS", rooms });
      },
      timeoutUser: (targetUserId: string, durationSeconds: number, reason?: string) => {
        if (!activeRoomRef.current) return;
        safeSend(
          JSON.stringify({
            type: "timeout",
            roomId: activeRoomRef.current,
            targetUserId,
            durationSeconds,
            ...(reason !== undefined ? { reason } : {}),
          }),
        );
      },
      banUser: (targetUserId: string, reason?: string) => {
        if (!activeRoomRef.current) return;
        safeSend(
          JSON.stringify({
            type: "ban",
            roomId: activeRoomRef.current,
            targetUserId,
            ...(reason !== undefined ? { reason } : {}),
          }),
        );
      },
      unbanUser: (targetUserId: string) => {
        if (!activeRoomRef.current) return;
        safeSend(
          JSON.stringify({
            type: "unban",
            roomId: activeRoomRef.current,
            targetUserId,
          }),
        );
      },
      setSlowMode: (seconds: number) => {
        if (!activeRoomRef.current) return;
        safeSend(
          JSON.stringify({
            type: "set_slow_mode",
            roomId: activeRoomRef.current,
            seconds,
          }),
        );
      },
      addReaction: (messageId: string, emoji: ReactionEmoji) => {
        if (!activeRoomRef.current) return;
        safeSend(
          JSON.stringify({
            type: "add_reaction",
            roomId: activeRoomRef.current,
            messageId,
            emoji,
          }),
        );
      },
      removeReaction: (messageId: string, emoji: ReactionEmoji) => {
        if (!activeRoomRef.current) return;
        safeSend(
          JSON.stringify({
            type: "remove_reaction",
            roomId: activeRoomRef.current,
            messageId,
            emoji,
          }),
        );
      },
    }),
    [safeSend],
  );

  const value = useMemo(
    (): ChatContextValue => ({ state, actions }),
    [state, actions],
  );

  return (
    <ChatContext.Provider value={value}>{children}</ChatContext.Provider>
  );
}

// ── Consumer Hook ──

/** Access chat state and actions. Must be used inside ChatProvider. */
export function useChat(): ChatContextValue {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error("useChat must be used within ChatProvider");
  return ctx;
}

/** Access chat state and actions if available. Returns null when used outside ChatProvider. */
export function useChatOptional(): ChatContextValue | null {
  return useContext(ChatContext);
}
