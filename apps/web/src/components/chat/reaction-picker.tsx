import { useState, useRef, useEffect } from "react";
import type React from "react";

import { REACTION_EMOJIS } from "@snc/shared";
import type { MessageReaction, ReactionEmoji } from "@snc/shared";

import styles from "./reaction-picker.module.css";

/** Compact emoji picker for adding or toggling reactions on a chat message. */
export function ReactionPicker({
  messageId: _messageId,
  existingReactions,
  onReact,
  onUnreact,
}: {
  readonly messageId: string;
  readonly existingReactions: readonly MessageReaction[];
  readonly onReact: (emoji: ReactionEmoji) => void;
  readonly onUnreact: (emoji: ReactionEmoji) => void;
}): React.ReactElement {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent): void => {
      if (!containerRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div ref={containerRef} className={styles.container}>
      <button
        type="button"
        className={styles.trigger}
        onClick={() => setOpen((v) => !v)}
        aria-label="Add reaction"
        aria-expanded={open}
        aria-haspopup="true"
      >
        +
      </button>
      {open && (
        <div className={styles.panel} role="dialog" aria-label="Reaction picker">
          {REACTION_EMOJIS.map((emoji) => {
            const existing = existingReactions.find((r) => r.emoji === emoji);
            const isActive = existing?.reactedByMe ?? false;
            return (
              <button
                key={emoji}
                type="button"
                className={isActive ? styles.emojiActive : styles.emoji}
                onClick={() => {
                  if (isActive) {
                    onUnreact(emoji);
                  } else {
                    onReact(emoji);
                  }
                  setOpen(false);
                }}
                aria-label={emoji}
                aria-pressed={isActive}
              >
                {emoji}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
