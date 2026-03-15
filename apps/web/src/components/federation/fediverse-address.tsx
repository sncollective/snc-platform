import { useState } from "react";
import type React from "react";

import styles from "./fediverse-address.module.css";

// ── Public Types ──

export interface FediverseAddressProps {
  readonly handle: string;
  readonly domain: string;
  readonly size?: "sm" | "md";
}

// ── Public API ──

export function FediverseAddress({
  handle,
  domain,
  size = "md",
}: FediverseAddressProps): React.ReactElement {
  const [copied, setCopied] = useState(false);
  const address = `@${handle}@${domain}`;

  const handleCopy = (): void => {
    void navigator.clipboard.writeText(address).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <span className={`${styles.pill} ${size === "sm" ? styles.sm : styles.md}`}>
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
