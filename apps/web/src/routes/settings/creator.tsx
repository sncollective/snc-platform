import { createFileRoute, redirect } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import type React from "react";
import { z, safeParse, regex } from "zod/mini";

import { BANDCAMP_URL_REGEX, BANDCAMP_EMBED_REGEX } from "@snc/shared";

import { extractFieldErrors } from "../../lib/form-utils.js";
import { fetchAuthState } from "../../lib/auth.js";
import {
  fetchCreatorProfile,
  updateCreatorProfile,
} from "../../lib/creator.js";
import settingsStyles from "../../styles/settings-page.module.css";
import styles from "./creator-settings.module.css";

// ── Private Constants ──

const MAX_EMBEDS = 10;

const BANDCAMP_URL_SCHEMA = z.object({
  bandcampUrl: z.string().check(
    regex(
      new RegExp(`^(?:${BANDCAMP_URL_REGEX.source})?$`),
      "Must be a valid bandcamp.com URL",
    ),
  ),
});

const EMBED_URL_SCHEMA = z.object({
  embedUrl: z.string().check(
    regex(BANDCAMP_EMBED_REGEX, "Must be a valid Bandcamp embed URL"),
  ),
});

// ── Route ──

export const Route = createFileRoute("/settings/creator")({
  beforeLoad: async () => {
    const { user, roles } = await fetchAuthState();
    if (!user) {
      throw redirect({ to: "/login" });
    }
    if (!roles.includes("creator")) {
      throw redirect({ to: "/feed" });
    }
    return { userId: user.id };
  },
  component: CreatorSettingsPage,
});

// ── Component ──

function CreatorSettingsPage(): React.ReactElement {
  // ── Loading State ──
  const [isLoading, setIsLoading] = useState(true);
  const [userId, setUserId] = useState("");

  // ── Bandcamp URL State ──
  const [bandcampUrl, setBandcampUrl] = useState("");
  const [urlError, setUrlError] = useState("");

  // ── Embed List State ──
  const [embeds, setEmbeds] = useState<string[]>([]);
  const [newEmbedUrl, setNewEmbedUrl] = useState("");
  const [embedError, setEmbedError] = useState("");

  // ── Form State ──
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [serverError, setServerError] = useState("");

  // ── Load Profile ──
  useEffect(() => {
    let cancelled = false;

    async function load(): Promise<void> {
      try {
        const { user } = await fetchAuthState();
        if (cancelled || !user) return;
        setUserId(user.id);
        const profile = await fetchCreatorProfile(user.id);
        if (cancelled) return;
        setBandcampUrl(profile.bandcampUrl ?? "");
        setEmbeds([...profile.bandcampEmbeds]);
      } catch {
        if (!cancelled) setServerError("Failed to load profile");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  // ── Bandcamp URL Validation ──
  const validateUrl = useCallback((): boolean => {
    const result = safeParse(BANDCAMP_URL_SCHEMA, { bandcampUrl });
    if (result.success) {
      setUrlError("");
      return true;
    }
    const errs = extractFieldErrors(result.error.issues, ["bandcampUrl"]);
    setUrlError(errs.bandcampUrl ?? "Must be a valid bandcamp.com URL");
    return false;
  }, [bandcampUrl]);

  // ── Embed URL Handlers ──
  const handleAddEmbed = useCallback((): void => {
    const trimmed = newEmbedUrl.trim();
    if (!trimmed) {
      setEmbedError("Please enter an embed URL");
      return;
    }
    const result = safeParse(EMBED_URL_SCHEMA, { embedUrl: trimmed });
    if (!result.success) {
      const errs = extractFieldErrors(result.error.issues, ["embedUrl"]);
      setEmbedError(errs.embedUrl ?? "Must be a valid Bandcamp embed URL");
      return;
    }
    if (embeds.includes(trimmed)) {
      setEmbedError("This embed URL has already been added");
      return;
    }
    setEmbedError("");
    setEmbeds((prev) => [...prev, trimmed]);
    setNewEmbedUrl("");
  }, [newEmbedUrl, embeds]);

  const handleRemoveEmbed = useCallback((url: string): void => {
    setEmbeds((prev) => prev.filter((e) => e !== url));
  }, []);

  // ── Save Handler ──
  const handleSubmit = useCallback(
    async (e: FormEvent): Promise<void> => {
      e.preventDefault();
      setSuccessMessage("");
      setServerError("");

      if (!validateUrl()) return;

      setIsSubmitting(true);
      try {
        await updateCreatorProfile(userId, {
          bandcampUrl: bandcampUrl || "",
          bandcampEmbeds: embeds,
        });
        setSuccessMessage("Changes saved successfully");
      } catch (err) {
        setServerError(
          err instanceof Error ? err.message : "Failed to save changes",
        );
      } finally {
        setIsSubmitting(false);
      }
    },
    [bandcampUrl, embeds, userId, validateUrl],
  );

  if (isLoading) {
    return (
      <div className={settingsStyles.page}>
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className={settingsStyles.page}>
      <h1 className={styles.heading}>Creator Settings</h1>

      {serverError && (
        <div className={settingsStyles.error} role="alert">
          {serverError}
        </div>
      )}

      {successMessage && (
        <div className={styles.success} role="status">
          {successMessage}
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate className={styles.form}>
        {/* Bandcamp Profile URL */}
        <div className={styles.fieldGroup}>
          <label htmlFor="bandcamp-url" className={styles.label}>
            Bandcamp Profile URL
          </label>
          <input
            id="bandcamp-url"
            type="url"
            value={bandcampUrl}
            onChange={(e) => setBandcampUrl(e.target.value)}
            onBlur={() => { validateUrl(); }}
            placeholder="https://yourband.bandcamp.com"
            className={
              urlError
                ? `${styles.input} ${styles.inputError}`
                : styles.input
            }
            disabled={isSubmitting}
          />
          {urlError && (
            <span className={styles.fieldError} role="alert">
              {urlError}
            </span>
          )}
        </div>

        {/* Embedded Players */}
        <div className={styles.fieldGroup}>
          <label htmlFor="embed-url" className={styles.label}>
            Embedded Players
          </label>
          <div className={styles.addEmbedRow}>
            <input
              id="embed-url"
              type="url"
              value={newEmbedUrl}
              onChange={(e) => setNewEmbedUrl(e.target.value)}
              placeholder="https://bandcamp.com/EmbeddedPlayer/..."
              className={
                embedError
                  ? `${styles.input} ${styles.inputError}`
                  : styles.input
              }
              disabled={isSubmitting}
            />
            <button
              type="button"
              onClick={handleAddEmbed}
              className={styles.addButton}
              disabled={isSubmitting || embeds.length >= MAX_EMBEDS}
            >
              Add
            </button>
          </div>
          {embedError && (
            <span className={styles.fieldError} role="alert">
              {embedError}
            </span>
          )}
        </div>

        {/* Embed List */}
        {embeds.length > 0 && (
          <ul className={styles.embedList}>
            {embeds.map((url) => (
              <li key={url} className={styles.embedItem}>
                <span className={styles.embedUrl} title={url}>
                  {url}
                </span>
                <button
                  type="button"
                  onClick={() => handleRemoveEmbed(url)}
                  className={styles.removeButton}
                  disabled={isSubmitting}
                  aria-label={`Remove ${url}`}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}

        {/* Save Button */}
        <button
          type="submit"
          className={styles.saveButton}
          disabled={isSubmitting}
        >
          {isSubmitting ? "Saving\u2026" : "Save Changes"}
        </button>
      </form>
    </div>
  );
}
