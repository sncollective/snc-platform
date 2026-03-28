import { createFileRoute, getRouteApi } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import type React from "react";
import type { FormEvent } from "react";

import type { StreamKeyResponse, StreamKeyCreatedResponse } from "@snc/shared";

import {
  fetchStreamKeys,
  createStreamKey,
  revokeStreamKey,
} from "../../../../lib/streaming.js";

import buttonStyles from "../../../../styles/button.module.css";
import errorStyles from "../../../../styles/error-alert.module.css";
import formStyles from "../../../../styles/form.module.css";
import successStyles from "../../../../styles/success-alert.module.css";
import settingsStyles from "../../../../styles/settings-page.module.css";
import styles from "./streaming.module.css";

// ── Parent Route Reference ──

const parentRoute = getRouteApi("/creators/$creatorId/manage");

// ── Route ──

export const Route = createFileRoute(
  "/creators/$creatorId/manage/streaming",
)({
  component: StreamingPage,
});

// ── Component ──

function StreamingPage(): React.ReactElement {
  const { creator, memberRole, isAdmin } = parentRoute.useLoaderData();
  const creatorId = creator.id;
  const isOwner = isAdmin || memberRole === "owner";

  const [keys, setKeys] = useState<StreamKeyResponse[]>([]);
  const [newKeyName, setNewKeyName] = useState("");
  const [newlyCreatedKey, setNewlyCreatedKey] = useState<StreamKeyCreatedResponse | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadKeys = useCallback(async () => {
    try {
      const res = await fetchStreamKeys(creatorId);
      setKeys(res.keys);
    } catch {
      setError("Failed to load stream keys");
    }
  }, [creatorId]);

  useEffect(() => {
    if (isOwner) void loadKeys();
  }, [isOwner, loadKeys]);

  const handleCreate = async (e: FormEvent): Promise<void> => {
    e.preventDefault();
    if (!newKeyName.trim()) return;

    setIsCreating(true);
    setError("");
    setSuccess("");
    setNewlyCreatedKey(null);

    try {
      const created = await createStreamKey(creatorId, newKeyName.trim());
      setNewlyCreatedKey(created);
      setNewKeyName("");
      setSuccess(`Key "${created.name}" created. Copy the key now — it won't be shown again.`);
      await loadKeys();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create key");
    } finally {
      setIsCreating(false);
    }
  };

  const handleRevoke = async (keyId: string, keyName: string): Promise<void> => {
    setError("");
    setSuccess("");
    setNewlyCreatedKey(null);

    try {
      await revokeStreamKey(creatorId, keyId);
      setSuccess(`Key "${keyName}" revoked`);
      await loadKeys();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to revoke key");
    }
  };

  if (!isOwner) {
    return (
      <div className={settingsStyles.page}>
        <p>Only creator owners can manage stream keys.</p>
      </div>
    );
  }

  const activeKeys = keys.filter((k) => !k.revokedAt);
  const revokedKeys = keys.filter((k) => k.revokedAt);

  return (
    <div className={settingsStyles.page}>
      <h2 className={styles.heading}>Stream Keys</h2>
      <p className={styles.description}>
        Use these keys to connect OBS or other streaming software. Each key
        identifies your stream — keep them secret.
      </p>

      {error && (
        <div className={errorStyles.error} role="alert">
          {error}
        </div>
      )}

      {success && (
        <div className={successStyles.success} role="status">
          {success}
        </div>
      )}

      {newlyCreatedKey && (
        <div className={styles.newKeyBanner} role="alert">
          <p className={styles.newKeyLabel}>New stream key (copy now):</p>
          <code className={styles.newKeyValue}>{newlyCreatedKey.rawKey}</code>
          <p className={styles.newKeyHint}>
            RTMP URL: <code>rtmp://stream.s-nc.tv/live/livestream?key={newlyCreatedKey.rawKey}</code>
          </p>
        </div>
      )}

      {/* Create Key Form */}
      <form onSubmit={handleCreate} className={styles.createForm}>
        <input
          type="text"
          value={newKeyName}
          onChange={(e) => setNewKeyName(e.target.value)}
          placeholder="Key name (e.g., OBS Home)"
          className={formStyles.input}
          disabled={isCreating}
          maxLength={100}
          aria-label="Stream key name"
        />
        <button
          type="submit"
          className={buttonStyles.primaryButton}
          disabled={isCreating || !newKeyName.trim()}
        >
          {isCreating ? "Creating\u2026" : "Create Key"}
        </button>
      </form>

      {/* Active Keys */}
      {activeKeys.length > 0 && (
        <section>
          <h3 className={styles.subheading}>Active Keys</h3>
          <ul className={styles.keyList}>
            {activeKeys.map((key) => (
              <li key={key.id} className={styles.keyItem}>
                <div className={styles.keyInfo}>
                  <span className={styles.keyName}>{key.name}</span>
                  <code className={styles.keyPrefix}>{key.keyPrefix}\u2026</code>
                  <span className={styles.keyDate}>
                    Created {new Date(key.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <button
                  type="button"
                  className={styles.revokeButton}
                  onClick={() => handleRevoke(key.id, key.name)}
                >
                  Revoke
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Revoked Keys */}
      {revokedKeys.length > 0 && (
        <section>
          <h3 className={styles.subheading}>Revoked Keys</h3>
          <ul className={styles.keyList}>
            {revokedKeys.map((key) => (
              <li key={key.id} className={styles.keyItemRevoked}>
                <div className={styles.keyInfo}>
                  <span className={styles.keyName}>{key.name}</span>
                  <code className={styles.keyPrefix}>{key.keyPrefix}\u2026</code>
                  <span className={styles.keyDate}>
                    Revoked {new Date(key.revokedAt!).toLocaleDateString()}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
