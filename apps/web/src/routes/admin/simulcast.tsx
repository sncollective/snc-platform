import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState, useCallback, useEffect } from "react";
import type React from "react";
import type { FormEvent } from "react";
import type {
  SimulcastDestination,
  SimulcastPlatform,
} from "@snc/shared";
import { SIMULCAST_PLATFORMS, SIMULCAST_PLATFORM_KEYS } from "@snc/shared";

import { RouteErrorBoundary } from "../../components/error/route-error-boundary.js";
import { isFeatureEnabled } from "../../lib/config.js";
import { apiGet, apiMutate } from "../../lib/fetch-utils.js";
import errorStyles from "../../styles/error-alert.module.css";
import listingStyles from "../../styles/listing-page.module.css";
import pageHeadingStyles from "../../styles/page-heading.module.css";
import styles from "./simulcast.module.css";

// ── Route ──

export const Route = createFileRoute("/admin/simulcast")({
  beforeLoad: async () => {
    if (!isFeatureEnabled("streaming")) {
      throw redirect({ to: "/" });
    }
  },
  head: () => ({ meta: [{ title: "Simulcast — S/NC" }] }),
  errorComponent: RouteErrorBoundary,
  component: SimulcastPage,
});

// ── Component ──

function SimulcastPage(): React.ReactElement {
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
  const [rtmpUrl, setRtmpUrl] = useState(SIMULCAST_PLATFORMS.twitch.rtmpPrefix ?? "");
  const [streamKey, setStreamKey] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // ── Load destinations ──

  const loadDestinations = useCallback(async () => {
    try {
      const data = await apiGet<{ destinations: SimulcastDestination[] }>("/api/simulcast");
      setDestinations(data.destinations);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load destinations");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDestinations();
  }, [loadDestinations]);

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
        const body: Record<string, unknown> = { platform, label, rtmpUrl };
        if (streamKey.length > 0) body.streamKey = streamKey;
        await apiMutate(`/api/simulcast/${editingId}`, { method: "PATCH", body });
      } else {
        await apiMutate("/api/simulcast", {
          method: "POST",
          body: { platform, label, rtmpUrl, streamKey },
        });
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
      await apiMutate(`/api/simulcast/${dest.id}`, {
        method: "PATCH",
        body: { isActive: !dest.isActive },
      });
      await loadDestinations();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update destination");
    }
  };

  const handleDelete = async (id: string): Promise<void> => {
    if (!window.confirm("Delete this simulcast destination?")) return;
    try {
      await apiMutate(`/api/simulcast/${id}`, { method: "DELETE" });
      await loadDestinations();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete destination");
    }
  };

  // ── Render ──

  return (
    <div>
      <div className={pageHeadingStyles.heading}>
        <h1 className={pageHeadingStyles.title}>Simulcast</h1>
        <p className={pageHeadingStyles.subtitle}>
          Manage external RTMP destinations for S/NC TV simulcasting.
        </p>
      </div>

      {error !== null && (
        <div className={errorStyles.errorAlert}>{error}</div>
      )}

      <div className={listingStyles.heading}>
        <button
          className={styles.addButton}
          onClick={() => {
            resetForm();
            setShowForm(true);
          }}
          disabled={showForm}
          type="button"
        >
          Add Destination
        </button>
      </div>

      {showForm && (
        <form className={styles.form} onSubmit={(e) => { void handleSubmit(e); }}>
          <h2>{editingId !== null ? "Edit Destination" : "Add Destination"}</h2>

          {formError !== null && (
            <div className={errorStyles.errorAlert}>{formError}</div>
          )}

          <div className={styles.formRow}>
            <label htmlFor="platform">Platform</label>
            <select
              id="platform"
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
            <label htmlFor="label">Label</label>
            <input
              id="label"
              type="text"
              value={label}
              onChange={(e) => { setLabel(e.target.value); }}
              placeholder="e.g. S/NC Twitch"
              maxLength={100}
              required
            />
          </div>

          <div className={styles.formRow}>
            <label htmlFor="rtmpUrl">RTMP URL</label>
            <input
              id="rtmpUrl"
              type="url"
              value={rtmpUrl}
              onChange={(e) => { setRtmpUrl(e.target.value); }}
              placeholder="rtmp://..."
              required
            />
          </div>

          <div className={styles.formRow}>
            <label htmlFor="streamKey">
              Stream Key{editingId !== null ? " (leave blank to keep existing)" : ""}
            </label>
            <input
              id="streamKey"
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
              {isSubmitting ? "Saving…" : "Save"}
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
        <p className={styles.emptyState}>Loading…</p>
      ) : destinations.length === 0 ? (
        <p className={styles.emptyState}>No simulcast destinations configured.</p>
      ) : (
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
                    {"••••••••"}{dest.streamKeyPrefix}
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
      )}
    </div>
  );
}
