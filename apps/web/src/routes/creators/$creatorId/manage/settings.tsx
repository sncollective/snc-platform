import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import type React from "react";
import { z, safeParse } from "zod/mini";

import {
  SOCIAL_PLATFORMS,
  PLATFORM_CONFIG,
  MAX_SOCIAL_LINKS,
  FEDERATION_DOMAIN,
} from "@snc/shared";
import type { SocialLink, SocialPlatform } from "@snc/shared";

import { FediverseAddress } from "../../../../components/federation/fediverse-address.js";
import { extractFieldErrors } from "../../../../lib/form-utils.js";
import { isFeatureEnabled } from "../../../../lib/config.js";
import {
  fetchCreatorProfile,
  updateCreatorProfile,
  uploadCreatorAvatar,
  uploadCreatorBanner,
} from "../../../../lib/creator.js";
import { clsx } from "clsx/lite";

import buttonStyles from "../../../../styles/button.module.css";
import errorStyles from "../../../../styles/error-alert.module.css";
import formStyles from "../../../../styles/form.module.css";
import successStyles from "../../../../styles/success-alert.module.css";
import settingsStyles from "../../../../styles/settings-page.module.css";
import styles from "./manage-settings.module.css";

// ── Private Constants ──

const URL_SCHEMA = z.object({
  url: z.string().check(
    z.url("Must be a valid URL"),
  ),
});

// ── Route ──

export const Route = createFileRoute("/creators/$creatorId/manage/settings")({
  component: ManageSettingsPage,
});

// ── Component ──

function ManageSettingsPage(): React.ReactElement {
  const { creatorId } = Route.useParams();

  // ── Profile Fields State ──
  const [displayName, setDisplayName] = useState("");
  const [handle, setHandle] = useState("");
  const [bio, setBio] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [bannerUrl, setBannerUrl] = useState<string | null>(null);

  // ── Image Upload State ──
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [isUploadingBanner, setIsUploadingBanner] = useState(false);

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
    if (!creatorId) return;
    let cancelled = false;

    async function loadProfile(): Promise<void> {
      try {
        const profile = await fetchCreatorProfile(creatorId);
        if (cancelled) return;
        setDisplayName(profile.displayName);
        setHandle(profile.handle ?? "");
        setBio(profile.bio ?? "");
        setAvatarUrl(profile.avatarUrl);
        setBannerUrl(profile.bannerUrl);
        setSocialLinks([...profile.socialLinks]);
        setSuccessMessage("");
        setServerError("");
      } catch {
        if (!cancelled) setServerError("Failed to load profile");
      }
    }

    void loadProfile();

    return () => {
      cancelled = true;
    };
  }, [creatorId]);

  // ── Add Link Handler ──
  const handleAddLink = (): void => {
    const trimmedUrl = newUrl.trim();
    if (!trimmedUrl) {
      setLinkError("Please enter a URL");
      return;
    }

    const result = safeParse(URL_SCHEMA, { url: trimmedUrl });
    if (!result.success) {
      const errs = extractFieldErrors(result.error.issues, ["url"]);
      setLinkError(errs.url ?? "Must be a valid URL");
      return;
    }

    const config = PLATFORM_CONFIG[newPlatform];
    if (config.urlPattern && !config.urlPattern.test(trimmedUrl)) {
      setLinkError(`URL does not match ${config.displayName} format`);
      return;
    }

    if (socialLinks.some((l) => l.platform === newPlatform)) {
      setLinkError(`A ${config.displayName} link has already been added`);
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
  };

  // ── Remove Link Handler ──
  const handleRemoveLink = (platform: SocialPlatform): void => {
    setSocialLinks((prev) => prev.filter((l) => l.platform !== platform));
  };

  // ── Save Handler ──
  const handleSubmit = async (e: FormEvent): Promise<void> => {
    e.preventDefault();
    setSuccessMessage("");
    setServerError("");

    setIsSubmitting(true);
    try {
      await updateCreatorProfile(creatorId, {
        displayName: displayName.trim() || undefined,
        handle: handle.trim() || undefined,
        bio: bio.trim() || undefined,
        socialLinks,
      });
      setSuccessMessage("Changes saved successfully");
    } catch (err) {
      setServerError(
        err instanceof Error ? err.message : "Failed to save changes",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Image Upload Helpers ──
  const handleImageUpload = async (
    file: File | null,
    uploadFn: (id: string, f: File) => Promise<{ avatarUrl?: string | null; bannerUrl?: string | null }>,
    setUrl: (url: string | null) => void,
    setFile: (f: File | null) => void,
    setUploading: (v: boolean) => void,
    urlKey: "avatarUrl" | "bannerUrl",
    label: string,
  ): Promise<void> => {
    if (!file || !creatorId) return;
    setUploading(true);
    setServerError("");
    try {
      const updated = await uploadFn(creatorId, file);
      setUrl(updated[urlKey] ?? null);
      setFile(null);
      setSuccessMessage(`${label} uploaded`);
    } catch (err) {
      setServerError(err instanceof Error ? err.message : `Failed to upload ${label.toLowerCase()}`);
    } finally {
      setUploading(false);
    }
  };

  const handleAvatarUpload = () =>
    handleImageUpload(avatarFile, uploadCreatorAvatar, setAvatarUrl, setAvatarFile, setIsUploadingAvatar, "avatarUrl", "Avatar");

  const handleBannerUpload = () =>
    handleImageUpload(bannerFile, uploadCreatorBanner, setBannerUrl, setBannerFile, setIsUploadingBanner, "bannerUrl", "Banner");

  return (
    <div className={settingsStyles.page}>
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

      {/* ── Avatar / Banner Upload ── */}
      <div className={styles.imageUploads}>
        <div className={styles.imageField}>
          <span className={formStyles.label}>Avatar</span>
          {avatarUrl && (
            <img src={avatarUrl} alt="Avatar preview" className={styles.avatarPreview} decoding="async" width={96} height={96} />
          )}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            aria-label="Upload avatar image"
            onChange={(e) => setAvatarFile(e.target.files?.[0] ?? null)}
            disabled={isUploadingAvatar}
          />
          <button
            type="button"
            className={clsx(buttonStyles.primaryButton, styles.uploadButton)}
            onClick={handleAvatarUpload}
            disabled={!avatarFile || isUploadingAvatar}
          >
            {isUploadingAvatar ? "Uploading\u2026" : "Upload Avatar"}
          </button>
        </div>

        <div className={styles.imageField}>
          <span className={formStyles.label}>Banner</span>
          {bannerUrl && (
            <img src={bannerUrl} alt="Banner preview" className={styles.bannerPreview} decoding="async" width={300} height={100} />
          )}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            aria-label="Upload banner image"
            onChange={(e) => setBannerFile(e.target.files?.[0] ?? null)}
            disabled={isUploadingBanner}
          />
          <button
            type="button"
            className={clsx(buttonStyles.primaryButton, styles.uploadButton)}
            onClick={handleBannerUpload}
            disabled={!bannerFile || isUploadingBanner}
          >
            {isUploadingBanner ? "Uploading\u2026" : "Upload Banner"}
          </button>
        </div>
      </div>

      <form onSubmit={handleSubmit} noValidate className={styles.form}>
        {/* Display Name */}
        <div className={formStyles.fieldGroup}>
          <label htmlFor="creator-display-name" className={formStyles.label}>
            Display Name
          </label>
          <input
            id="creator-display-name"
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className={formStyles.input}
            disabled={isSubmitting}
            maxLength={100}
          />
        </div>

        {/* Handle */}
        <div className={formStyles.fieldGroup}>
          <label htmlFor="creator-handle" className={formStyles.label}>
            Handle
          </label>
          <input
            id="creator-handle"
            type="text"
            value={handle}
            onChange={(e) => setHandle(e.target.value)}
            className={formStyles.input}
            disabled={isSubmitting}
            placeholder="my-creator-page"
          />
          <span className={formStyles.fieldHint}>
            Letters, numbers, and hyphens only. Used in your page URL.
          </span>
        </div>

        {/* Bio */}
        <div className={formStyles.fieldGroup}>
          <label htmlFor="creator-bio" className={formStyles.label}>
            Bio
          </label>
          <textarea
            id="creator-bio"
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            className={formStyles.textarea}
            disabled={isSubmitting}
            maxLength={2000}
            rows={4}
          />
        </div>

        {/* Add Social Link */}
        <div className={formStyles.fieldGroup}>
          <label htmlFor="link-platform" className={formStyles.label}>
            Social Links
          </label>
          <div className={styles.addLinkRow}>
            <select
              id="link-platform"
              value={newPlatform}
              onChange={(e) => {
                const val = e.target.value;
                if ((SOCIAL_PLATFORMS as readonly string[]).includes(val)) {
                  setNewPlatform(val as SocialPlatform);
                }
              }}
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
              aria-label="Social link URL"
              value={newUrl}
              onChange={(e) => setNewUrl(e.target.value)}
              placeholder="https://..."
              className={clsx(formStyles.input, styles.input, linkError && formStyles.inputError)}
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
          className={clsx(buttonStyles.primaryButton, styles.saveButton)}
          disabled={isSubmitting}
        >
          {isSubmitting ? "Saving\u2026" : "Save Changes"}
        </button>
      </form>

      {isFeatureEnabled("federation") && handle.length > 0 && (
        <section className={styles.federationSection}>
          <h2 className={styles.federationHeading}>Fediverse</h2>
          <p className={styles.federationDescription}>
            Anyone on Mastodon, Pixelfed, or other Fediverse platforms can follow you using this
            address.
          </p>
          <FediverseAddress handle={handle} domain={FEDERATION_DOMAIN} />
          <a
            href="https://joinmastodon.org/about"
            className={styles.federationLink}
            target="_blank"
            rel="noopener noreferrer"
          >
            Learn about the Fediverse
          </a>
        </section>
      )}
    </div>
  );
}
