import { useState, useEffect } from "react";
import type React from "react";
import type { FormEvent } from "react";

import type {
  SimulcastDestination,
  SimulcastPlatform,
  CreateSimulcastDestination,
  UpdateSimulcastDestination,
} from "@snc/shared";
import { SIMULCAST_PLATFORMS, SIMULCAST_PLATFORM_KEYS } from "@snc/shared";

import errorStyles from "../../styles/error-alert.module.css";
import styles from "./simulcast-destination-manager.module.css";

// ── Types ──

interface SimulcastDestinationManagerProps {
  /** Fetch the current list of destinations. */
  readonly fetchDestinations: () => Promise<{ readonly destinations: readonly SimulcastDestination[] }>;
  /** Create a new destination. */
  readonly createDestination: (input: CreateSimulcastDestination) => Promise<unknown>;
  /** Update an existing destination. */
  readonly updateDestination: (id: string, input: UpdateSimulcastDestination) => Promise<unknown>;
  /** Delete a destination by ID. */
  readonly deleteDestination: (id: string) => Promise<unknown>;
  /** Optional maximum number of destinations. When set, a counter is shown and the add button is disabled at the limit. */
  readonly maxDestinations?: number;
  /** Render style: "table" shows a full table (admin), "list" shows a card list (creator). */
  readonly variant?: "table" | "list";
}

// ── Component ──

/** Manages CRUD for simulcast destinations with form, list, and toggle/edit/delete actions. */
export function SimulcastDestinationManager({
  fetchDestinations,
  createDestination,
  updateDestination,
  deleteDestination,
  maxDestinations,
  variant = "table",
}: SimulcastDestinationManagerProps): React.ReactElement {
  // List state
  const [destinations, setDestinations] = useState<SimulcastDestination[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form visibility
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form fields
  const [platform, setPlatform] = useState<SimulcastPlatform>("twitch");
  const [label, setLabel] = useState("");
  const [rtmpUrl, setRtmpUrl] = useState<string>(SIMULCAST_PLATFORMS.twitch.rtmpPrefix ?? "");
  const [streamKey, setStreamKey] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // ── Load destinations ──

  const loadDestinations = async (): Promise<void> => {
    try {
      const data = await fetchDestinations();
      setDestinations([...data.destinations]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load destinations");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadDestinations();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fetchDestinations identity is stable per parent
  }, []);

  // ── Handlers ──

  const handlePlatformChange = (p: SimulcastPlatform): void => {
    setPlatform(p);
    const prefix = SIMULCAST_PLATFORMS[p].rtmpPrefix;
    if (prefix !== null) {
      setRtmpUrl(prefix);
    } else {
      setRtmpUrl("");
    }
  };

  const resetForm = (): void => {
    setShowForm(false);
    setEditingId(null);
    setPlatform("twitch");
    setLabel("");
    setRtmpUrl(SIMULCAST_PLATFORMS.twitch.rtmpPrefix ?? "");
    setStreamKey("");
    setFormError(null);
  };

  const handleEdit = (dest: SimulcastDestination): void => {
    setEditingId(dest.id);
    setPlatform(dest.platform);
    setLabel(dest.label);
    setRtmpUrl(dest.rtmpUrl);
    setStreamKey(""); // stream key is write-only; user must re-enter to change
    setFormError(null);
    setShowForm(true);
  };

  const handleSubmit = async (e: FormEvent): Promise<void> => {
    e.preventDefault();
    setIsSubmitting(true);
    setFormError(null);

    try {
      if (editingId !== null) {
        const body: UpdateSimulcastDestination = {
          platform,
          label,
          rtmpUrl,
          ...(streamKey.length > 0 && { streamKey }),
        };
        await updateDestination(editingId, body);
      } else {
        await createDestination({ platform, label, rtmpUrl, streamKey });
      }
      resetForm();
      await loadDestinations();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Failed to save destination");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleActive = async (dest: SimulcastDestination): Promise<void> => {
    try {
      await updateDestination(dest.id, { isActive: !dest.isActive });
      await loadDestinations();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update destination");
    }
  };

  const handleDelete = async (id: string): Promise<void> => {
    if (!window.confirm("Delete this simulcast destination?")) return;
    try {
      await deleteDestination(id);
      await loadDestinations();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete destination");
    }
  };

  // ── Render ──

  const atLimit = maxDestinations !== undefined && destinations.length >= maxDestinations;

  return (
    <>
      {error !== null && (
        <div className={errorStyles.error} role="alert">{error}</div>
      )}

      <div className={styles.header}>
        {maxDestinations !== undefined && (
          <span className={styles.destCount}>
            {destinations.length} of {maxDestinations} destinations
          </span>
        )}
        <button
          className={styles.addButton}
          onClick={() => {
            resetForm();
            setShowForm(true);
          }}
          disabled={showForm || atLimit}
          type="button"
        >
          Add Destination
        </button>
      </div>

      {showForm && (
        <form className={styles.form} onSubmit={(e) => { void handleSubmit(e); }}>
          <h2>{editingId !== null ? "Edit Destination" : "Add Destination"}</h2>

          {formError !== null && (
            <div className={errorStyles.error} role="alert">{formError}</div>
          )}

          <div className={styles.formRow}>
            <label htmlFor="dest-platform">Platform</label>
            <select
              id="dest-platform"
              value={platform}
              onChange={(e) => { handlePlatformChange(e.target.value as SimulcastPlatform); }}
              required
            >
              {SIMULCAST_PLATFORM_KEYS.map((key) => (
                <option key={key} value={key}>
                  {SIMULCAST_PLATFORMS[key].label}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.formRow}>
            <label htmlFor="dest-label">Label</label>
            <input
              id="dest-label"
              type="text"
              value={label}
              onChange={(e) => { setLabel(e.target.value); }}
              placeholder="e.g. My Twitch"
              maxLength={100}
              required
            />
          </div>

          <div className={styles.formRow}>
            <label htmlFor="dest-rtmpUrl">RTMP URL</label>
            <input
              id="dest-rtmpUrl"
              type="url"
              value={rtmpUrl}
              onChange={(e) => { setRtmpUrl(e.target.value); }}
              placeholder="rtmp://..."
              required
            />
          </div>

          <div className={styles.formRow}>
            <label htmlFor="dest-streamKey">
              Stream Key{editingId !== null ? " (leave blank to keep existing)" : ""}
            </label>
            <input
              id="dest-streamKey"
              type="password"
              value={streamKey}
              onChange={(e) => { setStreamKey(e.target.value); }}
              placeholder="Stream key"
              maxLength={500}
              required={editingId === null}
            />
          </div>

          <div className={styles.formActions}>
            <button
              type="submit"
              className={styles.saveButton}
              disabled={isSubmitting}
            >
              {isSubmitting ? "Saving\u2026" : "Save"}
            </button>
            <button
              type="button"
              className={styles.cancelButton}
              onClick={resetForm}
              disabled={isSubmitting}
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {isLoading ? (
        <p className={styles.emptyState}>Loading\u2026</p>
      ) : destinations.length === 0 ? (
        <p className={styles.emptyState}>No simulcast destinations configured.</p>
      ) : variant === "table" ? (
        <table className={styles.destinationList}>
          <thead>
            <tr>
              <th>Platform</th>
              <th>Label</th>
              <th>RTMP URL</th>
              <th>Stream Key</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {destinations.map((dest) => (
              <tr key={dest.id} className={styles.destinationRow}>
                <td>{SIMULCAST_PLATFORMS[dest.platform].label}</td>
                <td>{dest.label}</td>
                <td>{dest.rtmpUrl}</td>
                <td>
                  <span className={styles.masked}>
                    {"\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022"}{dest.streamKeyPrefix}
                  </span>
                </td>
                <td>
                  <span className={dest.isActive ? styles.active : styles.inactive}>
                    {dest.isActive ? "Active" : "Inactive"}
                  </span>
                </td>
                <td>
                  <div className={styles.actions}>
                    <button
                      type="button"
                      className={styles.toggleButton}
                      onClick={() => { void handleToggleActive(dest); }}
                    >
                      {dest.isActive ? "Deactivate" : "Activate"}
                    </button>
                    <button
                      type="button"
                      className={styles.editButton}
                      onClick={() => { handleEdit(dest); }}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className={styles.deleteButton}
                      onClick={() => { void handleDelete(dest.id); }}
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <ul className={styles.destList}>
          {destinations.map((dest) => (
            <li key={dest.id} className={styles.destItem}>
              <div className={styles.destInfo}>
                <span className={styles.destPlatform}>
                  {SIMULCAST_PLATFORMS[dest.platform].label}
                </span>
                <span className={styles.destLabel}>{dest.label}</span>
                <code className={styles.masked}>
                  {"\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022"}{dest.streamKeyPrefix}
                </code>
                <span className={dest.isActive ? styles.active : styles.inactive}>
                  {dest.isActive ? "Active" : "Inactive"}
                </span>
              </div>
              <div className={styles.actions}>
                <button
                  type="button"
                  className={styles.toggleButton}
                  onClick={() => { void handleToggleActive(dest); }}
                >
                  {dest.isActive ? "Deactivate" : "Activate"}
                </button>
                <button
                  type="button"
                  className={styles.editButton}
                  onClick={() => { handleEdit(dest); }}
                >
                  Edit
                </button>
                <button
                  type="button"
                  className={styles.deleteButton}
                  onClick={() => { void handleDelete(dest.id); }}
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
