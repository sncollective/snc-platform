import { useState } from "react";
import type React from "react";

import type { FeedTokenResponse } from "@snc/shared";

import { fetchFeedToken, generateFeedToken } from "../../lib/calendar.js";
import styles from "./feed-url-card.module.css";

// ── Public Types ──

export interface FeedUrlCardProps {
  readonly initialToken?: FeedTokenResponse | undefined;
}

// ── Public API ──

export function FeedUrlCard({
  initialToken,
}: FeedUrlCardProps): React.ReactElement {
  const [feedData, setFeedData] = useState<FeedTokenResponse | null>(
    initialToken ?? null,
  );
  const [copied, setCopied] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await generateFeedToken();
      setFeedData(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to generate token");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!feedData) return;
    try {
      await navigator.clipboard.writeText(feedData.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback: select text
    }
  };

  return (
    <div className={styles.card}>
      <h3 className={styles.heading}>Calendar Feed</h3>
      <p className={styles.description}>
        Subscribe to S/NC events in your calendar app using this .ics URL.
      </p>

      {error !== null && (
        <div className={styles.error} role="alert">{error}</div>
      )}

      {feedData ? (
        <div className={styles.urlRow}>
          <input
            type="text"
            readOnly
            value={feedData.url}
            className={styles.urlInput}
            aria-label="Calendar feed URL"
            onClick={(e) => e.currentTarget.select()}
          />
          <button
            type="button"
            className={styles.copyButton}
            onClick={handleCopy}
          >
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>
      ) : (
        <p className={styles.noToken}>No feed URL generated yet.</p>
      )}

      <button
        type="button"
        className={styles.generateButton}
        onClick={handleGenerate}
        disabled={isLoading}
      >
        {isLoading
          ? "Generating..."
          : feedData
            ? "Regenerate URL"
            : "Generate Feed URL"}
      </button>
    </div>
  );
}
