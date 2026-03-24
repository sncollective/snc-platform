import { useState } from "react";
import type React from "react";

import { clsx } from "clsx/lite";

import styles from "./fediverse-address.module.css";

// ── Public Types ──

export interface FediverseAddressProps {
  readonly handle: string;
  readonly domain: string;
  readonly size?: "sm" | "md";
}

// ── Public API ──

/** Display a fediverse address (`@handle@domain`) as a pill with a copy-to-clipboard button. */
export function FediverseAddress({
  handle,
  domain,
  size = "md",
}: FediverseAddressProps): React.ReactElement {
  const [copied, setCopied] = useState(false);
  const address = `@${handle}@${domain}`;

  const handleCopy = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API not available — ignore
    }
  };

  return (
    <span className={clsx(styles.pill, size === "sm" ? styles.sm : styles.md)}>
      <code className={styles.address}>{address}</code>
      <button
        type="button"
        className={styles.copyButton}
        onClick={handleCopy}
        aria-label={copied ? "Copied!" : `Copy ${address}`}
        title={copied ? "Copied!" : "Copy address"}
      >
        {copied ? "Copied!" : "Copy"}
      </button>
    </span>
  );
}
