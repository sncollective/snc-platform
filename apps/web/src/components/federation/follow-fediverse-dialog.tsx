import { useState } from "react";
import type React from "react";

import {
  DialogRoot,
  DialogBackdrop,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "../ui/dialog.js";
import { FediverseAddress } from "./fediverse-address.js";
import styles from "./follow-fediverse-dialog.module.css";

// ── Public Types ──

export interface FollowFediverseDialogProps {
  readonly handle: string;
  readonly domain: string;
  readonly open: boolean;
  readonly onClose: () => void;
}

// ── Public API ──

/** Modal dialog that shows a creator's fediverse address and lets the user enter their Mastodon instance to initiate a remote follow via `authorize_interaction`. */
export function FollowFediverseDialog({
  handle,
  domain,
  open,
  onClose,
}: FollowFediverseDialogProps): React.ReactElement {
  const [instance, setInstance] = useState("");

  const handleFollow = (): void => {
    let cleaned = instance.trim();
    cleaned = cleaned.replace(/^https?:\/\//i, "");
    cleaned = cleaned.replace(/^@/, "");
    cleaned = cleaned.trim();
    if (!cleaned) return;

    const actorUri = encodeURIComponent(`https://${domain}/ap/actors/${handle}`);
    const url = `https://${cleaned}/authorize_interaction?uri=${actorUri}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <DialogRoot open={open} onOpenChange={(details) => { if (!details.open) onClose(); }} lazyMount unmountOnExit>
      <DialogBackdrop />
      <DialogContent>
        <DialogTitle>Follow on the Fediverse</DialogTitle>

        <DialogDescription>
          Share this address or paste it into any Fediverse app (Mastodon, Pixelfed, etc.):
        </DialogDescription>

        <FediverseAddress handle={handle} domain={domain} size="md" />

        <div className={styles.instanceSection}>
          <label htmlFor="fediverse-instance" className={styles.label}>
            Your Mastodon server
          </label>
          <div className={styles.inputRow}>
            <input
              id="fediverse-instance"
              type="text"
              value={instance}
              onChange={(e) => setInstance(e.target.value)}
              placeholder="mastodon.social"
              className={styles.input}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleFollow();
              }}
            />
            <button
              type="button"
              className={styles.followButton}
              onClick={handleFollow}
              disabled={!instance.trim()}
            >
              Follow
            </button>
          </div>
        </div>

        <button
          type="button"
          className={styles.closeButton}
          onClick={onClose}
          aria-label="Close dialog"
        >
          Close
        </button>
      </DialogContent>
    </DialogRoot>
  );
}
