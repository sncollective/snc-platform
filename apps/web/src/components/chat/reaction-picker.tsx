import { useState } from "react";
import type React from "react";

import { REACTION_EMOJIS } from "@snc/shared";
import type { MessageReaction, ReactionEmoji } from "@snc/shared";

import { PopoverRoot, PopoverTrigger, PopoverContent } from "../ui/popover.js";
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

  return (
    <PopoverRoot
      open={open}
      onOpenChange={(details) => { setOpen(details.open); }}
      unmountOnExit
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          className={styles.trigger}
          aria-label="Add reaction"
        >
          +
        </button>
      </PopoverTrigger>
      <PopoverContent aria-label="Reaction picker" className={styles.panel}>
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
      </PopoverContent>
    </PopoverRoot>
  );
}
