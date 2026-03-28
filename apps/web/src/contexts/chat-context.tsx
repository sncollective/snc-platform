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

import type { ChatMessage, ChatRoom, ServerEvent } from "@snc/shared";

// ── Public Types ──

export interface ChatState {
  readonly rooms: ChatRoom[];
  readonly activeRoomId: string | null;
  readonly messages: readonly ChatMessage[];
  readonly hasMore: boolean;
  readonly isConnected: boolean;
}

export interface ChatActions {
  readonly joinRoom: (roomId: string) => void;
  readonly leaveRoom: (roomId: string) => void;
  readonly sendMessage: (content: string) => void;
  readonly setActiveRoom: (roomId: string) => void;
  readonly setRooms: (rooms: ChatRoom[]) => void;
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
};

// ── Reducer ──

type ChatAction =
  | { readonly type: "SET_ROOMS"; readonly rooms: ChatRoom[] }
  | { readonly type: "SET_ACTIVE_ROOM"; readonly roomId: string }
  | { readonly type: "SET_CONNECTED"; readonly isConnected: boolean }
  | { readonly type: "SET_HISTORY"; readonly messages: ChatMessage[]; readonly hasMore: boolean }
  | { readonly type: "ADD_MESSAGE"; readonly message: ChatMessage }
  | { readonly type: "ROOM_CLOSED"; readonly roomId: string }
  | { readonly type: "CLEAR_MESSAGES" };

/** Pure reducer for chat state. Exported for unit testing. */
export function chatReducer(
  state: ChatState,
  action: ChatAction,
): ChatState {
  switch (action.type) {
    case "SET_ROOMS":
      return { ...state, rooms: action.rooms };
    case "SET_ACTIVE_ROOM":
      return { ...state, activeRoomId: action.roomId, messages: [], hasMore: false };
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
}: {
  readonly children: ReactNode;
}): React.ReactElement {
  const [state, dispatch] = useReducer(chatReducer, INITIAL_STATE);
  const wsRef = useRef<WebSocket | null>(null);
  const activeRoomRef = useRef<string | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
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
      if (activeRoomRef.current) {
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

  const actions = useMemo(
    (): ChatActions => ({
      joinRoom: (roomId: string) => {
        wsRef.current?.send(JSON.stringify({ type: "join", roomId }));
      },
      leaveRoom: (roomId: string) => {
        wsRef.current?.send(JSON.stringify({ type: "leave", roomId }));
      },
      sendMessage: (content: string) => {
        if (!activeRoomRef.current) return;
        wsRef.current?.send(
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
          wsRef.current?.send(
            JSON.stringify({ type: "leave", roomId: activeRoomRef.current }),
          );
        }
        dispatch({ type: "SET_ACTIVE_ROOM", roomId });
        // Join new room
        wsRef.current?.send(JSON.stringify({ type: "join", roomId }));
      },
      setRooms: (rooms: ChatRoom[]) => {
        dispatch({ type: "SET_ROOMS", rooms });
      },
    }),
    [],
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
