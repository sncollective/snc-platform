import { createFileRoute, getRouteApi } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import type React from "react";
import type { FormEvent } from "react";

import type {
  StreamKeyResponse,
  StreamKeyCreatedResponse,
  SimulcastDestination,
  SimulcastPlatform,
} from "@snc/shared";
import {
  SIMULCAST_PLATFORMS,
  SIMULCAST_PLATFORM_KEYS,
  MAX_CREATOR_SIMULCAST_DESTINATIONS,
} from "@snc/shared";

import {
  fetchStreamKeys,
  createStreamKey,
  revokeStreamKey,
  fetchCreatorSimulcastDestinations,
  createCreatorSimulcastDestination,
  updateCreatorSimulcastDestination,
  deleteCreatorSimulcastDestination,
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

  // ── Simulcast State ──
  const [destinations, setDestinations] = useState<SimulcastDestination[]>([]);
  const [showDestForm, setShowDestForm] = useState(false);
  const [editingDestId, setEditingDestId] = useState<string | null>(null);
  const [destPlatform, setDestPlatform] = useState<SimulcastPlatform>("twitch");
  const [destLabel, setDestLabel] = useState("");
  const [destRtmpUrl, setDestRtmpUrl] = useState(
    SIMULCAST_PLATFORMS.twitch.rtmpPrefix ?? "",
  );
  const [destStreamKey, setDestStreamKey] = useState("");
  const [isDestSubmitting, setIsDestSubmitting] = useState(false);
  const [destError, setDestError] = useState("");

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

  const loadDestinations = useCallback(async () => {
    try {
      const res = await fetchCreatorSimulcastDestinations(creatorId);
      setDestinations(res.destinations);
    } catch {
      setDestError("Failed to load simulcast destinations");
    }
  }, [creatorId]);

  useEffect(() => {
    if (isOwner) void loadDestinations();
  }, [isOwner, loadDestinations]);

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

  const handleDestPlatformChange = (p: SimulcastPlatform): void => {
    setDestPlatform(p);
    const prefix = SIMULCAST_PLATFORMS[p].rtmpPrefix;
    setDestRtmpUrl(prefix !== null ? prefix : "");
  };

  const resetDestForm = (): void => {
    setShowDestForm(false);
    setEditingDestId(null);
    setDestPlatform("twitch");
    setDestLabel("");
    setDestRtmpUrl(SIMULCAST_PLATFORMS.twitch.rtmpPrefix ?? "");
    setDestStreamKey("");
    setDestError("");
  };

  const handleEditDest = (dest: SimulcastDestination): void => {
    setEditingDestId(dest.id);
    setDestPlatform(dest.platform);
    setDestLabel(dest.label);
    setDestRtmpUrl(dest.rtmpUrl);
    setDestStreamKey("");
    setDestError("");
    setShowDestForm(true);
  };

  const handleDestSubmit = async (e: FormEvent): Promise<void> => {
    e.preventDefault();
    setIsDestSubmitting(true);
    setDestError("");

    try {
      if (editingDestId !== null) {
        const body: Record<string, unknown> = {
          platform: destPlatform,
          label: destLabel,
          rtmpUrl: destRtmpUrl,
        };
        if (destStreamKey.length > 0) body.streamKey = destStreamKey;
        await updateCreatorSimulcastDestination(creatorId, editingDestId, body as never);
      } else {
        await createCreatorSimulcastDestination(creatorId, {
          platform: destPlatform,
          label: destLabel,
          rtmpUrl: destRtmpUrl,
          streamKey: destStreamKey,
        });
      }
      resetDestForm();
      await loadDestinations();
    } catch (err) {
      setDestError(err instanceof Error ? err.message : "Failed to save destination");
    } finally {
      setIsDestSubmitting(false);
    }
  };

  const handleToggleDest = async (dest: SimulcastDestination): Promise<void> => {
    try {
      await updateCreatorSimulcastDestination(creatorId, dest.id, {
        isActive: !dest.isActive,
      });
      await loadDestinations();
    } catch (err) {
      setDestError(
        err instanceof Error ? err.message : "Failed to update destination",
      );
    }
  };

  const handleDeleteDest = async (id: string): Promise<void> => {
    if (!window.confirm("Delete this simulcast destination?")) return;
    try {
      await deleteCreatorSimulcastDestination(creatorId, id);
      await loadDestinations();
    } catch (err) {
      setDestError(
        err instanceof Error ? err.message : "Failed to delete destination",
      );
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

      {/* ── Simulcast Destinations ── */}
      <section className={styles.simulcastSection}>
        <h2 className={styles.heading}>Simulcast Destinations</h2>
        <p className={styles.description}>
          Simulcast your stream to external platforms like Twitch and YouTube.
          Destinations stay active across all your streams until you toggle them off.
        </p>

        {destError && (
          <div className={errorStyles.error} role="alert">
            {destError}
          </div>
        )}

        <div className={styles.simulcastHeader}>
          <span className={styles.destCount}>
            {destinations.length} of {MAX_CREATOR_SIMULCAST_DESTINATIONS} destinations
          </span>
          <button
            type="button"
            className={styles.addDestButton}
            onClick={() => {
              resetDestForm();
              setShowDestForm(true);
            }}
            disabled={
              showDestForm ||
              destinations.length >= MAX_CREATOR_SIMULCAST_DESTINATIONS
            }
          >
            Add Destination
          </button>
        </div>

        {showDestForm && (
          <form
            className={styles.destForm}
            onSubmit={(e) => {
              void handleDestSubmit(e);
            }}
          >
            <h3 className={styles.subheading}>
              {editingDestId !== null ? "Edit Destination" : "Add Destination"}
            </h3>

            <div className={styles.destFormRow}>
              <label htmlFor="dest-platform">Platform</label>
              <select
                id="dest-platform"
                value={destPlatform}
                onChange={(e) => {
                  handleDestPlatformChange(e.target.value as SimulcastPlatform);
                }}
                required
              >
                {SIMULCAST_PLATFORM_KEYS.map((key) => (
                  <option key={key} value={key}>
                    {SIMULCAST_PLATFORMS[key].label}
                  </option>
                ))}
              </select>
            </div>

            <div className={styles.destFormRow}>
              <label htmlFor="dest-label">Label</label>
              <input
                id="dest-label"
                type="text"
                value={destLabel}
                onChange={(e) => {
                  setDestLabel(e.target.value);
                }}
                placeholder="e.g. My Twitch"
                maxLength={100}
                required
              />
            </div>

            <div className={styles.destFormRow}>
              <label htmlFor="dest-rtmpUrl">RTMP URL</label>
              <input
                id="dest-rtmpUrl"
                type="url"
                value={destRtmpUrl}
                onChange={(e) => {
                  setDestRtmpUrl(e.target.value);
                }}
                placeholder="rtmp://..."
                required
              />
            </div>

            <div className={styles.destFormRow}>
              <label htmlFor="dest-streamKey">
                Stream Key
                {editingDestId !== null ? " (leave blank to keep existing)" : ""}
              </label>
              <input
                id="dest-streamKey"
                type="password"
                value={destStreamKey}
                onChange={(e) => {
                  setDestStreamKey(e.target.value);
                }}
                placeholder="Stream key"
                maxLength={500}
                required={editingDestId === null}
              />
            </div>

            <div className={styles.destFormActions}>
              <button
                type="submit"
                className={styles.destSaveButton}
                disabled={isDestSubmitting}
              >
                {isDestSubmitting ? "Saving\u2026" : "Save"}
              </button>
              <button
                type="button"
                className={styles.destCancelButton}
                onClick={resetDestForm}
                disabled={isDestSubmitting}
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {destinations.length === 0 && !showDestForm ? (
          <p className={styles.emptyDest}>No simulcast destinations configured.</p>
        ) : destinations.length > 0 ? (
          <ul className={styles.destList}>
            {destinations.map((dest) => (
              <li key={dest.id} className={styles.destItem}>
                <div className={styles.destInfo}>
                  <span className={styles.destPlatform}>
                    {SIMULCAST_PLATFORMS[dest.platform].label}
                  </span>
                  <span className={styles.destLabel}>{dest.label}</span>
                  <code className={styles.destMaskedKey}>
                    {"\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022"}
                    {dest.streamKeyPrefix}
                  </code>
                  <span
                    className={
                      dest.isActive ? styles.destActive : styles.destInactive
                    }
                  >
                    {dest.isActive ? "Active" : "Inactive"}
                  </span>
                </div>
                <div className={styles.destActions}>
                  <button
                    type="button"
                    className={styles.destToggleButton}
                    onClick={() => {
                      void handleToggleDest(dest);
                    }}
                  >
                    {dest.isActive ? "Deactivate" : "Activate"}
                  </button>
                  <button
                    type="button"
                    className={styles.destEditButton}
                    onClick={() => {
                      handleEditDest(dest);
                    }}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className={styles.destDeleteButton}
                    onClick={() => {
                      void handleDeleteDest(dest.id);
                    }}
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        ) : null}
      </section>
    </div>
  );
}
