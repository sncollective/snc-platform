import { useEffect, useRef, useState } from "react";
import type React from "react";

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
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [instance, setInstance] = useState("");

  // Sync open state with native <dialog> API
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  // Close on backdrop click
  const handleBackdropClick = (e: React.MouseEvent<HTMLDialogElement>): void => {
    if (e.target === dialogRef.current) {
      onClose();
    }
  };

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
    <dialog
      ref={dialogRef}
      className={styles.dialog}
      onClose={onClose}
      onClick={handleBackdropClick}
    >
      <div className={styles.content}>
        <h2 className={styles.heading}>Follow on the Fediverse</h2>

        <p className={styles.description}>
          Share this address or paste it into any Fediverse app (Mastodon, Pixelfed, etc.):
        </p>

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
      </div>
    </dialog>
  );
}
