import { useEffect, useRef, useState } from "react";
import type React from "react";
import type { FormEvent } from "react";

import type { ActiveRoomsResponse, BadgeType } from "@snc/shared";

import { useChat } from "../../contexts/chat-context.js";
import { apiGet } from "../../lib/fetch-utils.js";
import { ChatModerationPanel } from "./chat-moderation-panel.js";
import { ChatUserCard } from "./chat-user-card.js";
import { ReactionPicker } from "./reaction-picker.js";

import styles from "./chat-panel.module.css";

// ── Constants ──

const BADGE_LABELS: Record<BadgeType, string> = {
  platform: "Patron",
  creator: "Sub",
};

// ── Component ──

/** Real-time chat panel. Auto-joins the channel room (by channelId) or the platform room. */
export function ChatPanel({
  channelId,
  onCollapse,
}: {
  readonly channelId?: string | null;
  readonly onCollapse?: () => void;
}): React.ReactElement {
  const { state, actions } = useChat();
  const [input, setInput] = useState("");
  const [usersExpanded, setUsersExpanded] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);


  // Load rooms on mount
  useEffect(() => {
    async function loadRooms(): Promise<void> {
      const res = await apiGet<ActiveRoomsResponse>("/api/chat/rooms");
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
    }
    void loadRooms();
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

  const handleSubmit = (e: FormEvent): void => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed) return;
    actions.sendMessage(trimmed);
    setInput("");
  };

  const activeRoom = state.rooms.find((r) => r.id === state.activeRoomId);

  // Only show the current channel's room + platform room as tabs
  const visibleRooms = state.rooms.filter(
    (r) => !r.closedAt && (r.type === "platform" || r.channelId === channelId),
  );
  const otherRooms = visibleRooms.filter((r) => r.id !== state.activeRoomId);

  return (
    <div className={styles.panel}>
      {/* Tab bar with optional collapse button */}
      <div className={styles.tabBar}>
        {onCollapse && (
          <button
            type="button"
            className={styles.collapseButton}
            onClick={onCollapse}
            aria-label="Collapse chat"
            title="Collapse chat"
          >
            {"\u2192"}
          </button>
        )}
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
        <span className={styles.viewerCount} title="Viewers in this room">
          {state.viewerCount}
        </span>
        {!state.isConnected && (
          <span className={styles.disconnected}>Reconnecting...</span>
        )}
      </div>

      {/* User list (authenticated viewers) */}
      {state.users.length > 0 && (
        <div className={styles.userList}>
          <button
            type="button"
            className={styles.userListToggle}
            onClick={() => setUsersExpanded((prev) => !prev)}
            aria-expanded={usersExpanded}
          >
            {usersExpanded ? "Hide" : "Show"} users ({state.users.length})
          </button>
          {usersExpanded && (
            <ul className={styles.userListItems}>
              {state.users.map((user) => (
                <li key={user.userId} className={styles.userListItem}>
                  {user.avatarUrl && (
                    <img
                      src={user.avatarUrl}
                      alt=""
                      className={styles.userListAvatar}
                      width={16}
                      height={16}
                    />
                  )}
                  <span>{user.userName}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Status banners */}
      {state.slowModeSeconds > 0 && (
        <div className={styles.slowModeBanner}>
          Slow mode: {state.slowModeSeconds}s between messages
        </div>
      )}
      {state.isTimedOut && state.timedOutUntil && (
        <div className={styles.timedOutBanner}>
          You are timed out until {new Date(state.timedOutUntil).toLocaleTimeString()}
        </div>
      )}
      {state.isBanned && (
        <div className={styles.bannedBanner}>
          You are banned from this room
        </div>
      )}
      {state.lastFilteredAt && (
        <div className={styles.filteredFlash}>
          Message blocked by filter
        </div>
      )}

      {/* Moderator controls — slow mode slider. Rendered above messages so
          moderators see it on entry without having to scroll past chat. */}
      {state.isModerator && activeRoom && !activeRoom.closedAt && (
        <ChatModerationPanel
          slowModeSeconds={state.slowModeSeconds}
          onSetSlowMode={actions.setSlowMode}
        />
      )}

      {/* Messages */}
      <div className={styles.messages}>
        {state.messages.map((msg) => {
          const msgReactions = state.reactions.get(msg.id) ?? [];
          return (
            <div
              key={msg.id}
              className={styles.message}
            >
              {msg.avatarUrl && (
                <img
                  src={msg.avatarUrl}
                  alt=""
                  className={styles.avatar}
                  width={20}
                  height={20}
                />
              )}
              <ChatUserCard
                targetUserId={msg.userId}
                targetUserName={msg.userName}
                targetAvatarUrl={msg.avatarUrl}
                roomId={state.activeRoomId}
              >
                {msg.userName}
              </ChatUserCard>
              {msg.badges.length > 0 && (
                <span className={styles.badges}>
                  {msg.badges.map((badge) => (
                    <span
                      key={badge}
                      className={styles.badge}
                      data-badge={badge}
                      title={BADGE_LABELS[badge]}
                    >
                      {BADGE_LABELS[badge]}
                    </span>
                  ))}
                </span>
              )}
              <span className={styles.content}>{msg.content}</span>
              {/* Reaction pills + picker trigger */}
              {(msgReactions.filter((r) => r.count > 0).length > 0 ||
                (state.isConnected && !state.isBanned && activeRoom && !activeRoom.closedAt)) && (
                <div className={styles.reactionRow}>
                  {msgReactions.filter((r) => r.count > 0).map((reaction) => (
                    <button
                      key={reaction.emoji}
                      type="button"
                      className={
                        reaction.reactedByMe
                          ? styles.reactionPillActive
                          : styles.reactionPill
                      }
                      onClick={() =>
                        reaction.reactedByMe
                          ? actions.removeReaction(msg.id, reaction.emoji)
                          : actions.addReaction(msg.id, reaction.emoji)
                      }
                      title={`${reaction.count} reaction${reaction.count !== 1 ? "s" : ""}`}
                      aria-label={`${reaction.emoji} ${reaction.count}`}
                      aria-pressed={reaction.reactedByMe}
                    >
                      {reaction.emoji} {reaction.count}
                    </button>
                  ))}
                  {state.isConnected && !state.isBanned && activeRoom && !activeRoom.closedAt && (
                    <ReactionPicker
                      messageId={msg.id}
                      existingReactions={msgReactions}
                      onReact={(emoji) => actions.addReaction(msg.id, emoji)}
                      onUnreact={(emoji) => actions.removeReaction(msg.id, emoji)}
                    />
                  )}
                </div>
              )}
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Input (auth-gated) */}
      {activeRoom && !activeRoom.closedAt ? (
        <>
          <form onSubmit={handleSubmit} className={styles.inputForm}>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Send a message..."
              className={styles.input}
              maxLength={500}
              disabled={!state.isConnected || state.isTimedOut || state.isBanned}
              aria-label="Chat message"
            />
            <button
              type="submit"
              className={styles.sendButton}
              disabled={!state.isConnected || !input.trim() || state.isTimedOut || state.isBanned}
            >
              Send
            </button>
          </form>
        </>
      ) : (
        activeRoom?.closedAt && (
          <div className={styles.closedBanner}>Stream ended</div>
        )
      )}
    </div>
  );
}
