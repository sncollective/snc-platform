import { createFileRoute, redirect } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import type React from "react";
import { z, safeParse } from "zod/mini";

import {
  SOCIAL_PLATFORMS,
  PLATFORM_CONFIG,
  MAX_SOCIAL_LINKS,
} from "@snc/shared";
import type { SocialLink, SocialPlatform } from "@snc/shared";

import { extractFieldErrors } from "../../lib/form-utils.js";
import { fetchAuthState } from "../../lib/auth.js";
import { fetchAuthStateServer } from "../../lib/api-server.js";
import {
  fetchCreatorProfile,
  updateCreatorProfile,
} from "../../lib/creator.js";
import buttonStyles from "../../styles/button.module.css";
import errorStyles from "../../styles/error-alert.module.css";
import formStyles from "../../styles/form.module.css";
import successStyles from "../../styles/success-alert.module.css";
import pageHeadingStyles from "../../styles/page-heading.module.css";
import settingsStyles from "../../styles/settings-page.module.css";
import styles from "./creator-settings.module.css";

// ── Private Constants ──

const URL_SCHEMA = z.object({
  url: z.string().check(
    z.url("Must be a valid URL"),
  ),
});

// ── Route ──

export const Route = createFileRoute("/settings/creator")({
  beforeLoad: async () => {
    const { user, roles } = await fetchAuthStateServer();
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

  // ── Social Links State ──
  const [socialLinks, setSocialLinks] = useState<SocialLink[]>([]);
  const [newPlatform, setNewPlatform] = useState<SocialPlatform>("bandcamp");
  const [newUrl, setNewUrl] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [linkError, setLinkError] = useState("");

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
        setSocialLinks([...profile.socialLinks]);
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

  // ── Add Link Handler ──
  const handleAddLink = useCallback((): void => {
    const trimmedUrl = newUrl.trim();
    if (!trimmedUrl) {
      setLinkError("Please enter a URL");
      return;
    }

    // Validate URL format
    const result = safeParse(URL_SCHEMA, { url: trimmedUrl });
    if (!result.success) {
      const errs = extractFieldErrors(result.error.issues, ["url"]);
      setLinkError(errs.url ?? "Must be a valid URL");
      return;
    }

    // Check platform-specific pattern
    const config = PLATFORM_CONFIG[newPlatform];
    if (config.urlPattern && !config.urlPattern.test(trimmedUrl)) {
      setLinkError(
        `URL does not match ${config.displayName} format`,
      );
      return;
    }

    // Check for duplicate platform
    if (socialLinks.some((l) => l.platform === newPlatform)) {
      setLinkError(
        `A ${config.displayName} link has already been added`,
      );
      return;
    }

    setLinkError("");
    const link: SocialLink = {
      platform: newPlatform,
      url: trimmedUrl,
      ...(newLabel.trim() ? { label: newLabel.trim() } : {}),
    };
    setSocialLinks((prev) => [...prev, link]);
    setNewUrl("");
    setNewLabel("");
  }, [newUrl, newLabel, newPlatform, socialLinks]);

  // ── Remove Link Handler ──
  const handleRemoveLink = useCallback((platform: SocialPlatform): void => {
    setSocialLinks((prev) => prev.filter((l) => l.platform !== platform));
  }, []);

  // ── Save Handler ──
  const handleSubmit = useCallback(
    async (e: FormEvent): Promise<void> => {
      e.preventDefault();
      setSuccessMessage("");
      setServerError("");

      setIsSubmitting(true);
      try {
        await updateCreatorProfile(userId, { socialLinks });
        setSuccessMessage("Changes saved successfully");
      } catch (err) {
        setServerError(
          err instanceof Error ? err.message : "Failed to save changes",
        );
      } finally {
        setIsSubmitting(false);
      }
    },
    [socialLinks, userId],
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
      <h1 className={`${pageHeadingStyles.heading} ${styles.heading}`}>Creator Settings</h1>

      {serverError && (
        <div className={errorStyles.error} role="alert">
          {serverError}
        </div>
      )}

      {successMessage && (
        <div className={successStyles.success} role="status">
          {successMessage}
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate className={styles.form}>
        {/* Add Social Link */}
        <div className={formStyles.fieldGroup}>
          <label htmlFor="link-platform" className={formStyles.label}>
            Social Links
          </label>
          <div className={styles.addLinkRow}>
            <select
              id="link-platform"
              value={newPlatform}
              onChange={(e) =>
                setNewPlatform(e.target.value as SocialPlatform)
              }
              className={formStyles.select}
              disabled={isSubmitting}
            >
              {SOCIAL_PLATFORMS.map((p) => (
                <option key={p} value={p}>
                  {PLATFORM_CONFIG[p].displayName}
                </option>
              ))}
            </select>
            <input
              id="link-url"
              type="url"
              value={newUrl}
              onChange={(e) => setNewUrl(e.target.value)}
              placeholder="https://..."
              className={
                linkError
                  ? `${formStyles.input} ${styles.input} ${formStyles.inputError}`
                  : `${formStyles.input} ${styles.input}`
              }
              disabled={isSubmitting}
            />
            <button
              type="button"
              onClick={handleAddLink}
              className={styles.addButton}
              disabled={isSubmitting || socialLinks.length >= MAX_SOCIAL_LINKS}
            >
              Add
            </button>
          </div>
          {linkError && (
            <span className={formStyles.fieldError} role="alert">
              {linkError}
            </span>
          )}
        </div>

        {/* Link List */}
        {socialLinks.length > 0 && (
          <ul className={styles.linkList}>
            {socialLinks.map((link) => (
              <li key={link.platform} className={styles.linkItem}>
                <span className={styles.linkPlatform}>
                  {PLATFORM_CONFIG[link.platform].displayName}
                </span>
                <span className={styles.linkUrl} title={link.url}>
                  {link.url}
                </span>
                <button
                  type="button"
                  onClick={() => handleRemoveLink(link.platform)}
                  className={styles.removeButton}
                  disabled={isSubmitting}
                  aria-label={`Remove ${PLATFORM_CONFIG[link.platform].displayName}`}
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
          className={`${buttonStyles.primaryButton} ${styles.saveButton}`}
          disabled={isSubmitting}
        >
          {isSubmitting ? "Saving\u2026" : "Save Changes"}
        </button>
      </form>
    </div>
  );
}
