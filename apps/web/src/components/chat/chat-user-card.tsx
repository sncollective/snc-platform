import { useState, useEffect } from "react";
import type React from "react";

import type { ModerationAction } from "@snc/shared";

import { useChat } from "../../contexts/chat-context.js";
import { apiGet } from "../../lib/fetch-utils.js";
import {
  PopoverRoot,
  PopoverTrigger,
  PopoverContent,
} from "../ui/popover.js";
import { toaster } from "../ui/toast.js";

import styles from "./chat-user-card.module.css";

// ── Constants ──

const TIMEOUT_PRESETS = [
  { label: "1 min", seconds: 60 },
  { label: "10 min", seconds: 600 },
  { label: "1 hour", seconds: 3600 },
  { label: "1 day", seconds: 86_400 },
] as const;

// ── Types ──

interface ActiveSanctionsResponse {
  readonly sanctions: readonly ModerationAction[];
}

// ── Component ──

/**
 * Click-username popover rendering identity (always) and moderator-action
 * cluster (when viewer is a moderator and target is not themselves).
 *
 * Ban-state: queries GET /api/chat/rooms/:roomId/moderation/active on
 * popover open (option b). Filters client-side for `action === "ban"`
 * matching the target user.
 *
 * Toast surface: optimistic-on-send — fires success toast immediately after
 * dispatching the WS action. Server-side rejection is rare and visible
 * retroactively (e.g. the banner does not appear for the target). Error
 * toasts are fired separately if needed for mod-action-specific error codes.
 */
export function ChatUserCard({
  targetUserId,
  targetUserName,
  targetAvatarUrl,
  roomId,
  children,
}: {
  readonly targetUserId: string;
  readonly targetUserName: string;
  readonly targetAvatarUrl?: string | null;
  readonly roomId: string | null;
  readonly children: React.ReactNode;
}): React.ReactElement {
  const { state, actions } = useChat();
  const [open, setOpen] = useState(false);
  const [isBanned, setIsBanned] = useState(false);
  const [banLoading, setBanLoading] = useState(false);
  const [confirmBan, setConfirmBan] = useState(false);
  const [confirmUnban, setConfirmUnban] = useState(false);
  const [actionInFlight, setActionInFlight] = useState(false);

  // Query ban state when popover opens (option b from story spec)
  useEffect(() => {
    if (!open || !roomId) return;
    setConfirmBan(false);
    setConfirmUnban(false);

    setBanLoading(true);
    const controller = new AbortController();

    apiGet<ActiveSanctionsResponse>(
      `/api/chat/rooms/${roomId}/moderation/active`,
      undefined,
      controller.signal,
    )
      .then((res) => {
        const banned = res.sanctions.some(
          (s) => s.action === "ban" && s.targetUserId === targetUserId,
        );
        setIsBanned(banned);
      })
      .catch(() => {
        // Silently degrade — show Ban (not Unban) on fetch failure
        setIsBanned(false);
      })
      .finally(() => {
        setBanLoading(false);
      });

    return () => {
      controller.abort();
    };
  }, [open, roomId, targetUserId]);

  // Whether to show the moderator cluster.
  // Hide when the moderator clicks their own username (cannot sanction yourself).
  const isSelf = targetUserId === state.currentUserId;
  const showModCluster = state.isModerator && !isSelf;

  const handleTimeout = (seconds: number, label: string): void => {
    setActionInFlight(true);
    actions.timeoutUser(targetUserId, seconds);
    toaster.success({ title: `Timed out ${targetUserName} for ${label}`, duration: 3000 });
    setOpen(false);
    setActionInFlight(false);
  };

  const handleBan = (): void => {
    setActionInFlight(true);
    actions.banUser(targetUserId);
    toaster.success({ title: `Banned ${targetUserName}`, duration: 3000 });
    setOpen(false);
    setConfirmBan(false);
    setActionInFlight(false);
  };

  const handleUnban = (): void => {
    setActionInFlight(true);
    actions.unbanUser(targetUserId);
    toaster.success({ title: `Unbanned ${targetUserName}`, duration: 3000 });
    setOpen(false);
    setConfirmUnban(false);
    setActionInFlight(false);
  };

  const handleOpenChange = ({ open: nextOpen }: { open: boolean }): void => {
    setOpen(nextOpen);
  };

  return (
    <PopoverRoot
      open={open}
      onOpenChange={handleOpenChange}
      positioning={{ placement: "top-start", flip: true }}
      lazyMount
      unmountOnExit
    >
      <PopoverTrigger asChild>
        {/* The username span becomes the clickable trigger. stopPropagation
            prevents the click from bubbling to parent message-row handlers. */}
        <span
          className={styles.trigger}
          role="button"
          tabIndex={0}
          aria-label={`View profile of ${targetUserName}`}
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.stopPropagation();
            }
          }}
        >
          {children}
        </span>
      </PopoverTrigger>

      <PopoverContent className={styles.card}>
        {/* Identity header — always shown */}
        <div className={styles.header}>
          {targetAvatarUrl ? (
            <img
              src={targetAvatarUrl}
              alt=""
              className={styles.avatar}
              width={32}
              height={32}
            />
          ) : (
            <div className={styles.avatarPlaceholder} aria-hidden="true">
              {targetUserName.charAt(0).toUpperCase()}
            </div>
          )}
          <div className={styles.identity}>
            <span className={styles.displayName}>{targetUserName}</span>
          </div>
        </div>

        {/* Moderator action cluster — only when isModerator and not self */}
        {showModCluster && (
          <div className={styles.modCluster} aria-label={`Moderation actions for ${targetUserName}`}>
            <div className={styles.section}>
              <span className={styles.sectionLabel}>Timeout</span>
              <div className={styles.timeoutRow}>
                {TIMEOUT_PRESETS.map((preset) => (
                  <button
                    key={preset.seconds}
                    type="button"
                    className={styles.timeoutButton}
                    onClick={() => handleTimeout(preset.seconds, preset.label)}
                    disabled={actionInFlight}
                    title={`Timeout ${targetUserName} for ${preset.label}`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            <div className={styles.section}>
              {banLoading ? (
                <div className={styles.banLoading} aria-label="Checking ban status">
                  <span className={styles.loadingDots}>...</span>
                </div>
              ) : isBanned ? (
                // Show Unban (with confirm) when target is currently banned
                confirmUnban ? (
                  <div className={styles.confirmRow}>
                    <span className={styles.confirmText}>Unban {targetUserName}?</span>
                    <button
                      type="button"
                      className={styles.unbanConfirmButton}
                      onClick={handleUnban}
                      disabled={actionInFlight}
                    >
                      Yes, unban
                    </button>
                    <button
                      type="button"
                      className={styles.cancelButton}
                      onClick={() => setConfirmUnban(false)}
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    className={styles.unbanButton}
                    onClick={() => setConfirmUnban(true)}
                    disabled={actionInFlight}
                    title={`Unban ${targetUserName}`}
                  >
                    Unban
                  </button>
                )
              ) : (
                // Show Ban (with confirm) when target is not banned
                confirmBan ? (
                  <div className={styles.confirmRow}>
                    <span className={styles.confirmText}>Ban {targetUserName}?</span>
                    <button
                      type="button"
                      className={styles.banConfirmButton}
                      onClick={handleBan}
                      disabled={actionInFlight}
                    >
                      Yes, ban
                    </button>
                    <button
                      type="button"
                      className={styles.cancelButton}
                      onClick={() => setConfirmBan(false)}
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    className={styles.banButton}
                    onClick={() => setConfirmBan(true)}
                    disabled={actionInFlight}
                    title={`Ban ${targetUserName}`}
                  >
                    Ban
                  </button>
                )
              )}
            </div>
          </div>
        )}
      </PopoverContent>
    </PopoverRoot>
  );
}
