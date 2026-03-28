import { useCallback, useEffect, useRef, useState } from "react";
import type React from "react";
import type { FormEvent } from "react";

import type { ActiveRoomsResponse } from "@snc/shared";

import { useChat } from "../../contexts/chat-context.js";
import { apiGet } from "../../lib/fetch-utils.js";

import styles from "./chat-panel.module.css";

// ── Component ──

/** Real-time chat panel. Auto-joins the channel room (by channelId) or the platform room. */
export function ChatPanel({
  channelId,
}: {
  readonly channelId?: string | null;
}): React.ReactElement {
  const { state, actions } = useChat();
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load rooms on mount
  useEffect(() => {
    void apiGet<ActiveRoomsResponse>("/api/chat/rooms").then((res) => {
      actions.setRooms(res.rooms);

      // Auto-join: prefer channel room if available, otherwise platform room
      const channelRoom = channelId
        ? res.rooms.find((r) => r.channelId === channelId)
        : null;
      const platformRoom = res.rooms.find((r) => r.type === "platform");
      const defaultRoom = channelRoom ?? platformRoom;

      if (defaultRoom && !state.activeRoomId) {
        actions.setActiveRoom(defaultRoom.id);
      }
    });
  }, [channelId, actions, state.activeRoomId]);

  // When channelId changes (user switches channel), switch to that channel's room
  const prevChannelIdRef = useRef(channelId);
  useEffect(() => {
    if (!channelId || channelId === prevChannelIdRef.current) return;
    prevChannelIdRef.current = channelId;
    const channelRoom = state.rooms.find((r) => r.channelId === channelId);
    if (channelRoom) {
      actions.setActiveRoom(channelRoom.id);
    }
  }, [channelId, state.rooms, actions]);

  // Auto-scroll on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [state.messages]);

  const handleSubmit = useCallback(
    (e: FormEvent) => {
      e.preventDefault();
      const trimmed = input.trim();
      if (!trimmed) return;
      actions.sendMessage(trimmed);
      setInput("");
    },
    [input, actions],
  );

  const activeRoom = state.rooms.find((r) => r.id === state.activeRoomId);

  // Only show the current channel's room + platform room as tabs
  const visibleRooms = state.rooms.filter(
    (r) => !r.closedAt && (r.type === "platform" || r.channelId === channelId),
  );
  const otherRooms = visibleRooms.filter((r) => r.id !== state.activeRoomId);

  return (
    <div className={styles.panel}>
      {/* Room Header */}
      <div className={styles.header}>
        <span className={styles.roomName}>
          {activeRoom?.name ?? "Chat"}
        </span>
        {!state.isConnected && (
          <span className={styles.disconnected}>Reconnecting...</span>
        )}
      </div>

      {/* Room Tabs */}
      {otherRooms.length > 0 && (
        <div className={styles.tabs}>
          {visibleRooms.map((room) => (
              <button
                key={room.id}
                type="button"
                className={
                  room.id === state.activeRoomId
                    ? styles.tabActive
                    : styles.tab
                }
                onClick={() => actions.setActiveRoom(room.id)}
              >
                {room.name}
              </button>
            ))}
        </div>
      )}

      {/* Messages */}
      <div className={styles.messages}>
        {state.messages.map((msg) => (
          <div key={msg.id} className={styles.message}>
            {msg.avatarUrl && (
              <img
                src={msg.avatarUrl}
                alt=""
                className={styles.avatar}
                width={20}
                height={20}
              />
            )}
            <span className={styles.userName}>{msg.userName}</span>
            <span className={styles.content}>{msg.content}</span>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input (auth-gated) */}
      {activeRoom && !activeRoom.closedAt ? (
        <form onSubmit={handleSubmit} className={styles.inputForm}>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Send a message..."
            className={styles.input}
            maxLength={500}
            disabled={!state.isConnected}
            aria-label="Chat message"
          />
          <button
            type="submit"
            className={styles.sendButton}
            disabled={!state.isConnected || !input.trim()}
          >
            Send
          </button>
        </form>
      ) : (
        activeRoom?.closedAt && (
          <div className={styles.closedBanner}>Stream ended</div>
        )
      )}
    </div>
  );
}
