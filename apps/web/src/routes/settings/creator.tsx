import { createFileRoute, redirect } from "@tanstack/react-router";
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

import { CreateCreatorForm } from "../../components/creator/create-creator-form.js";
import { FediverseAddress } from "../../components/federation/fediverse-address.js";
import { CreatorSelector } from "../../components/creator/creator-selector.js";
import { TeamSection } from "../../components/creator/team-section.js";

import { extractFieldErrors } from "../../lib/form-utils.js";
import { fetchAuthState } from "../../lib/auth.js";
import { fetchAuthStateServer } from "../../lib/api-server.js";
import { isFeatureEnabled } from "../../lib/config.js";
import {
  fetchCreatorProfile,
  updateCreatorProfile,
  uploadCreatorAvatar,
  uploadCreatorBanner,
  fetchMyCreatorPages,
} from "../../lib/creator.js";
import type { CreatorProfileResponse } from "@snc/shared";
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
    if (!isFeatureEnabled("creator")) throw redirect({ to: "/" });

    const { user, roles } = await fetchAuthStateServer();
    if (!user) {
      throw redirect({ to: "/login" });
    }
    if (!roles.includes("stakeholder") && !roles.includes("admin")) {
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

  // ── Multi-Entity State ──
  const [creatorPages, setCreatorPages] = useState<CreatorProfileResponse[]>([]);
  const [selectedCreatorId, setSelectedCreatorId] = useState("");

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

  // ── Load Creator Pages ──
  useEffect(() => {
    let cancelled = false;

    async function load(): Promise<void> {
      try {
        const { user } = await fetchAuthState();
        if (cancelled || !user) return;
        setUserId(user.id);
        const pages = await fetchMyCreatorPages();
        if (cancelled) return;
        setCreatorPages(pages);
        if (pages.length > 0) {
          setSelectedCreatorId(pages[0]!.id);
        }
      } catch {
        if (!cancelled) setServerError("Failed to load creator pages");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  // ── Load Profile for Selected Creator ──
  useEffect(() => {
    if (!selectedCreatorId) return;
    let cancelled = false;

    async function loadProfile(): Promise<void> {
      try {
        const profile = await fetchCreatorProfile(selectedCreatorId);
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
  }, [selectedCreatorId]);

  // ── Add Link Handler ──
  const handleAddLink = (): void => {
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
      await updateCreatorProfile(selectedCreatorId, {
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

  // ── Avatar Upload Handler ──
  const handleAvatarUpload = async (): Promise<void> => {
    if (!avatarFile || !selectedCreatorId) return;
    setIsUploadingAvatar(true);
    setServerError("");
    try {
      const updated = await uploadCreatorAvatar(selectedCreatorId, avatarFile);
      setAvatarUrl(updated.avatarUrl);
      setAvatarFile(null);
      setSuccessMessage("Avatar uploaded");
    } catch (err) {
      setServerError(err instanceof Error ? err.message : "Failed to upload avatar");
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  // ── Banner Upload Handler ──
  const handleBannerUpload = async (): Promise<void> => {
    if (!bannerFile || !selectedCreatorId) return;
    setIsUploadingBanner(true);
    setServerError("");
    try {
      const updated = await uploadCreatorBanner(selectedCreatorId, bannerFile);
      setBannerUrl(updated.bannerUrl);
      setBannerFile(null);
      setSuccessMessage("Banner uploaded");
    } catch (err) {
      setServerError(err instanceof Error ? err.message : "Failed to upload banner");
    } finally {
      setIsUploadingBanner(false);
    }
  };

  const handleCreated = (profile: CreatorProfileResponse): void => {
    setCreatorPages((prev) => [...prev, profile]);
    setSelectedCreatorId(profile.id);
  };

  if (isLoading) {
    return (
      <div className={settingsStyles.page}>
        <p>Loading...</p>
      </div>
    );
  }

  if (creatorPages.length === 0) {
    return (
      <div className={settingsStyles.page}>
        <h1 className={`${pageHeadingStyles.heading} ${styles.heading}`}>Creator Settings</h1>
        {serverError && (
          <div className={errorStyles.error} role="alert">
            {serverError}
          </div>
        )}
        <p>You don't have a creator page yet. Create one to get started.</p>
        <CreateCreatorForm onCreated={handleCreated} />
      </div>
    );
  }

  return (
    <div className={settingsStyles.page}>
      <h1 className={`${pageHeadingStyles.heading} ${styles.heading}`}>Creator Settings</h1>

      <CreatorSelector
        creators={creatorPages}
        selectedId={selectedCreatorId}
        onChange={setSelectedCreatorId}
      />

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
            <img src={avatarUrl} alt="Avatar preview" className={styles.avatarPreview} />
          )}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            onChange={(e) => setAvatarFile(e.target.files?.[0] ?? null)}
            disabled={isUploadingAvatar}
          />
          <button
            type="button"
            className={`${buttonStyles.primaryButton} ${styles.uploadButton}`}
            onClick={handleAvatarUpload}
            disabled={!avatarFile || isUploadingAvatar}
          >
            {isUploadingAvatar ? "Uploading\u2026" : "Upload Avatar"}
          </button>
        </div>

        <div className={styles.imageField}>
          <span className={formStyles.label}>Banner</span>
          {bannerUrl && (
            <img src={bannerUrl} alt="Banner preview" className={styles.bannerPreview} />
          )}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            onChange={(e) => setBannerFile(e.target.files?.[0] ?? null)}
            disabled={isUploadingBanner}
          />
          <button
            type="button"
            className={`${buttonStyles.primaryButton} ${styles.uploadButton}`}
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

      {isFeatureEnabled("federation") && handle.length > 0 && (
        <section className={styles.federationSection}>
          <h2 className={styles.federationHeading}>Fediverse</h2>
          <p className={styles.federationDescription}>
            Anyone on Mastodon, Pixelfed, or other Fediverse platforms can follow you using this address.
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

      {selectedCreatorId && (
        <TeamSection creatorId={selectedCreatorId} currentUserId={userId} />
      )}
    </div>
  );
}
