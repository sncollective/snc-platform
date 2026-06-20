import { useState, useEffect } from "react";
import type React from "react";
import type { FormEvent } from "react";

import type {
  SimulcastDestination,
  SimulcastPlatform,
  CreateSimulcastDestination,
  UpdateSimulcastDestination,
} from "@snc/shared";
import { SIMULCAST_PLATFORMS, SIMULCAST_PLATFORM_KEYS, RTMP_URL_REGEX } from "@snc/shared";

import { ConfirmDialog } from "../ui/confirm-dialog.js";
import { ResponsiveTable } from "../ui/responsive-table.js";
import { toaster } from "../ui/toast.js";
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

  // Delete confirmation
  const [destPendingDelete, setDestPendingDelete] = useState<SimulcastDestination | null>(null);

  // Form fields
  const [platform, setPlatform] = useState<SimulcastPlatform>("twitch");
  const [label, setLabel] = useState("");
  const [rtmpUrl, setRtmpUrl] = useState<string>(SIMULCAST_PLATFORMS.twitch.rtmpPrefix ?? "");
  const [streamKey, setStreamKey] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [rtmpUrlError, setRtmpUrlError] = useState<string | null>(null);

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
    setRtmpUrlError(null);
  };

  const handleEdit = (dest: SimulcastDestination): void => {
    setEditingId(dest.id);
    setPlatform(dest.platform);
    setLabel(dest.label);
    setRtmpUrl(dest.rtmpUrl);
    setStreamKey(""); // stream key is write-only; user must re-enter to change
    setFormError(null);
    setRtmpUrlError(null);
    setShowForm(true);
  };

  const handleSubmit = async (e: FormEvent): Promise<void> => {
    e.preventDefault();
    setFormError(null);
    setRtmpUrlError(null);

    // Validate RTMP scheme before calling the API — browser type="url" accepts any scheme.
    if (!RTMP_URL_REGEX.test(rtmpUrl)) {
      setRtmpUrlError("Must be an rtmp:// or rtmps:// URL");
      return;
    }

    setIsSubmitting(true);

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
      toaster.success({ title: dest.isActive ? "Destination deactivated" : "Destination activated" });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update destination");
    }
  };

  const handleDeleteConfirm = async (): Promise<void> => {
    const dest = destPendingDelete;
    setDestPendingDelete(null);
    if (dest === null) return;
    try {
      await deleteDestination(dest.id);
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
      <p className={styles.semanticsNote}>Changes to active destinations take effect immediately on the live stream.</p>

      {showForm && (
        <form
          className={styles.form}
          aria-label={editingId !== null ? "Edit Destination" : "Add Destination"}
          onSubmit={(e) => { void handleSubmit(e); }}
        >
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
              onChange={(e) => { setRtmpUrl(e.target.value); setRtmpUrlError(null); }}
              placeholder="rtmp://..."
              required
              aria-describedby={rtmpUrlError !== null ? "dest-rtmpUrl-error" : undefined}
            />
            {rtmpUrlError !== null && (
              <span id="dest-rtmpUrl-error" className={styles.fieldError} role="alert">
                {rtmpUrlError}
              </span>
            )}
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
      ) : (
        <ResponsiveTable<SimulcastDestination>
          columns={[
            { key: "platform", header: "Platform", cardRole: "title", cell: (d) => SIMULCAST_PLATFORMS[d.platform].label },
            { key: "label", header: "Label", cell: (d) => d.label },
            { key: "rtmpUrl", header: "RTMP URL", cardRole: "hidden", cell: (d) => d.rtmpUrl },
            { key: "streamKey", header: "Stream Key", cell: (d) => <span className={styles.masked}>{"\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022"}{d.streamKeyPrefix}</span> },
            { key: "status", header: "Status", cell: (d) => <span className={d.isActive ? styles.active : styles.inactive}>{d.isActive ? "Active" : "Inactive"}</span> },
          ]}
          rows={destinations}
          rowKey={(d) => d.id}
          label="Simulcast destinations"
          cardAriaLabel={(d) => d.label}
          tableAt="md"
          mode={variant === "list" ? "cards" : "auto"}
          actions={(d) => (
            <>
              <button
                type="button"
                className={styles.toggleButton}
                onClick={() => { void handleToggleActive(d); }}
              >
                {d.isActive ? "Deactivate" : "Activate"}
              </button>
              <button
                type="button"
                className={styles.editButton}
                onClick={() => { handleEdit(d); }}
              >
                Edit
              </button>
              <button
                type="button"
                className={styles.deleteButton}
                onClick={() => { setDestPendingDelete(d); }}
              >
                Delete
              </button>
            </>
          )}
        />
      )}

      <ConfirmDialog
        open={destPendingDelete !== null}
        title="Delete destination?"
        confirmLabel="Delete destination"
        onConfirm={() => { void handleDeleteConfirm(); }}
        onCancel={() => { setDestPendingDelete(null); }}
      >
        {destPendingDelete !== null && (
          <>Deleting &ldquo;{destPendingDelete.label}&rdquo; stops simulcasting to it. This cannot be undone.</>
        )}
      </ConfirmDialog>
    </>
  );
}
