import { useState } from "react";
import type React from "react";

import {
  DialogRoot,
  DialogBackdrop,
  DialogContent,
  DialogTitle,
} from "../ui/dialog.js";
import { apiMutate } from "../../lib/fetch-utils.js";
import { navigateExternal } from "../../lib/url.js";
import formStyles from "../../styles/form.module.css";
import styles from "./mastodon-login-dialog.module.css";

// ── Private Types ──

interface MastodonStartResponse {
  authorizationUrl: string;
}

// ── Public Types ──

export interface MastodonLoginDialogProps {
  readonly open: boolean;
  readonly onClose: () => void;
}

// ── Public API ──

/** Modal dialog that collects a Mastodon instance domain and initiates OAuth login. */
export function MastodonLoginDialog({
  open,
  onClose,
}: MastodonLoginDialogProps): React.ReactElement {
  const [domain, setDomain] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const cleanDomain = (raw: string): string => {
    let cleaned = raw.trim();
    cleaned = cleaned.replace(/^https?:\/\//i, "");
    cleaned = cleaned.replace(/\/+$/, "");
    cleaned = cleaned.replace(/^@/, "");
    return cleaned.trim();
  };

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setError("");

    const cleaned = cleanDomain(domain);
    if (!cleaned) return;

    setIsSubmitting(true);

    try {
      const result = await apiMutate<MastodonStartResponse>(
        "/api/auth/mastodon/start",
        { body: { domain: cleaned } },
      );
      navigateExternal(result.authorizationUrl);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to connect to Mastodon instance",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <DialogRoot open={open} onOpenChange={(details) => { if (!details.open) onClose(); }} lazyMount unmountOnExit>
      <DialogBackdrop />
      <DialogContent>
        <DialogTitle>Log in with Mastodon</DialogTitle>

        <form onSubmit={(e) => void handleSubmit(e)}>
          {error && (
            <div className={formStyles.serverError} role="alert">
              {error}
            </div>
          )}

          <div className={styles.fieldGroup}>
            <label htmlFor="mastodon-domain" className={styles.label}>
              Your Mastodon instance
            </label>
            <input
              id="mastodon-domain"
              type="text"
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              placeholder="mastodon.social"
              className={styles.input}
              autoComplete="off"
              autoFocus
            />
          </div>

          <button
            type="submit"
            className={formStyles.submitButton}
            disabled={isSubmitting || !domain.trim()}
          >
            {isSubmitting ? "Connecting\u2026" : "Continue"}
          </button>
        </form>

        <button
          type="button"
          className={styles.cancelButton}
          onClick={onClose}
        >
          Cancel
        </button>
      </DialogContent>
    </DialogRoot>
  );
}
