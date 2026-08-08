import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import type React from "react";
import type { FormEvent } from "react";

import type {
  PressContent,
  PressImage,
  PressStreamingLink,
  ReleaseOneSheet,
} from "@snc/shared";

import { PressImageField } from "../../../../components/press/index.js";
import { fetchPressConfig, updatePressConfig } from "../../../../lib/press.js";
import buttonStyles from "../../../../styles/button.module.css";
import errorStyles from "../../../../styles/error-alert.module.css";
import formStyles from "../../../../styles/form.module.css";
import successStyles from "../../../../styles/success-alert.module.css";
import styles from "./manage-press.module.css";

export const Route = createFileRoute("/creators/$creatorId/manage/press")({
  head: () => ({ meta: [{ title: "Manage Press Page — S/NC" }] }),
  component: ManagePressPage,
});

const EMPTY_RELEASE: ReleaseOneSheet = {
  slug: "",
  title: "",
  personnel: [],
  fcc: null,
};

function splitList(value: string): string[] {
  return value
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeConfig(input: PressContent): PressContent {
  return {
    ...input,
    enabled: input.enabled ?? false,
    shortBio: input.shortBio ?? null,
    longBio: input.longBio ?? null,
    forFansOf: input.forFansOf ?? [],
    streamingLinks: input.streamingLinks ?? [],
    liveDatesUrl: input.liveDatesUrl ?? null,
    standoutTrack: input.standoutTrack
      ? {
          title: input.standoutTrack.title,
          url: input.standoutTrack.url ?? null,
          streamsLabel: input.standoutTrack.streamsLabel ?? null,
        }
      : null,
    pressContactEmail: input.pressContactEmail ?? null,
    location: input.location ?? null,
    photos: input.photos ?? [],
    gallery: input.gallery ?? [],
    releases: (input.releases ?? []).map((release) => ({
      ...release,
      catalogNumber: release.catalogNumber ?? null,
      releaseDate: release.releaseDate ?? null,
      format: release.format ?? null,
      genre: release.genre ?? null,
      isrc: release.isrc ?? null,
      upc: release.upc ?? null,
      duration: release.duration ?? null,
      writtenBy: release.writtenBy ?? null,
      producedBy: release.producedBy ?? null,
      mixedMasteredBy: release.mixedMasteredBy ?? null,
      copyrightLine: release.copyrightLine ?? null,
      publisherLine: release.publisherLine ?? null,
      label: release.label ?? null,
      artKey: release.artKey ?? null,
      personnel: release.personnel ?? [],
      fcc: release.fcc ?? null,
    })),
  };
}

function ManagePressPage(): React.ReactElement {
  const { creatorId } = Route.useParams();
  const [enabled, setEnabled] = useState(false);
  const [shortBio, setShortBio] = useState("");
  const [longBio, setLongBio] = useState("");
  const [forFansOf, setForFansOf] = useState("");
  const [streamingLinks, setStreamingLinks] = useState<PressStreamingLink[]>([]);
  const [newLinkLabel, setNewLinkLabel] = useState("");
  const [newLinkUrl, setNewLinkUrl] = useState("");
  const [liveDatesUrl, setLiveDatesUrl] = useState("");
  const [standoutTitle, setStandoutTitle] = useState("");
  const [standoutUrl, setStandoutUrl] = useState("");
  const [streamsLabel, setStreamsLabel] = useState("");
  const [pressContactEmail, setPressContactEmail] = useState("");
  const [location, setLocation] = useState("");
  const [gallery, setGallery] = useState<PressImage[]>([]);
  const [legacyBlankAltKeys, setLegacyBlankAltKeys] = useState<Set<string>>(() => new Set());
  const [releases, setReleases] = useState<ReleaseOneSheet[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    void fetchPressConfig(creatorId)
      .then((raw) => {
        if (cancelled) return;
        const config = normalizeConfig(raw);
        setEnabled(config.enabled);
        setShortBio(config.shortBio ?? "");
        setLongBio(config.longBio ?? "");
        setForFansOf(config.forFansOf.join("\n"));
        setStreamingLinks([...config.streamingLinks]);
        setLiveDatesUrl(config.liveDatesUrl ?? "");
        setStandoutTitle(config.standoutTrack?.title ?? "");
        setStandoutUrl(config.standoutTrack?.url ?? "");
        setStreamsLabel(config.standoutTrack?.streamsLabel ?? "");
        setPressContactEmail(config.pressContactEmail ?? "");
        setLocation(config.location ?? "");
        setGallery([...config.gallery]);
        setLegacyBlankAltKeys(new Set(
          config.gallery
            .filter((image) => !image.alt.trim())
            .map((image) => image.key),
        ));
        setReleases([...config.releases]);
        setError("");
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load press page");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [creatorId]);

  const updateLink = (index: number, patch: Partial<PressStreamingLink>): void => {
    setStreamingLinks((current) => current.map((link, i) => i === index ? { ...link, ...patch } : link));
  };

  const addLink = (): void => {
    if (!newLinkLabel.trim() || !newLinkUrl.trim()) return;
    setStreamingLinks((current) => [
      ...current,
      { label: newLinkLabel.trim(), url: newLinkUrl.trim() },
    ]);
    setNewLinkLabel("");
    setNewLinkUrl("");
  };

  const updateRelease = (index: number, patch: Partial<ReleaseOneSheet>): void => {
    setReleases((current) => current.map((release, i) => i === index ? { ...release, ...patch } : release));
  };

  const save = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
    const newImageWithoutAlt = gallery.find(
      (image) => !image.alt.trim() && !legacyBlankAltKeys.has(image.key),
    );
    if (newImageWithoutAlt) {
      setSaved(false);
      setError("Alternative text is required for newly selected press photos.");
      return;
    }

    const normalizedGallery = gallery.map((image) => ({
      ...image,
      alt: image.alt.trim(),
      credit: image.credit?.trim() || null,
    }));
    setIsSaving(true);
    setSaved(false);
    setError("");
    try {
      const standoutTrack = standoutTitle.trim()
        ? {
            title: standoutTitle.trim(),
            url: standoutUrl.trim() || null,
            streamsLabel: streamsLabel.trim() || null,
          }
        : null;
      const next = await updatePressConfig(creatorId, {
        enabled,
        shortBio: shortBio.trim() || null,
        longBio: longBio.trim() || null,
        forFansOf: splitList(forFansOf),
        streamingLinks: streamingLinks.map((link) => ({
          label: link.label.trim(),
          url: link.url.trim(),
        })),
        liveDatesUrl: liveDatesUrl.trim() || null,
        standoutTrack,
        pressContactEmail: pressContactEmail.trim() || null,
        location: location.trim() || null,
        gallery: normalizedGallery,
        photos: normalizedGallery.map((image) => image.key),
        releases,
      });
      const config = normalizeConfig(next);
      setEnabled(config.enabled);
      setGallery([...config.gallery]);
      setReleases([...config.releases]);
      setSaved(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save press page");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) return <div className={styles.page}><p>Loading press page…</p></div>;

  return (
    <div className={styles.page}>
      <h1 className={styles.heading}>Press page</h1>
      <p className={styles.lead}>Keep the public EPK current for press, radio, and playlisters.</p>

      {error && <div className={errorStyles.error} role="alert">{error}</div>}
      {saved && <div className={successStyles.success} role="status">Changes saved</div>}

      <form className={styles.form} onSubmit={(event) => void save(event)} noValidate>
        <label className={styles.toggle}>
          <input type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} />
          <span>Publish the public press page</span>
        </label>

        <Field label="Short bio" id="press-short-bio">
          <textarea id="press-short-bio" className={formStyles.textarea} rows={4} value={shortBio} onChange={(event) => setShortBio(event.target.value)} />
        </Field>
        <Field label="Long bio" id="press-long-bio">
          <textarea id="press-long-bio" className={formStyles.textarea} rows={8} value={longBio} onChange={(event) => setLongBio(event.target.value)} />
        </Field>
        <Field label="For fans of" id="press-for-fans">
          <textarea id="press-for-fans" className={formStyles.textarea} rows={3} value={forFansOf} onChange={(event) => setForFansOf(event.target.value)} placeholder="One artist per line or comma-separated" />
        </Field>

        <section className={styles.section} aria-labelledby="streaming-heading">
          <h2 id="streaming-heading" className={styles.subheading}>Streaming and video links</h2>
          {streamingLinks.map((link, index) => (
            <div key={`${link.label}-${index}`} className={styles.linkRow}>
              <input className={formStyles.input} aria-label={`Link ${index + 1} label`} value={link.label} onChange={(event) => updateLink(index, { label: event.target.value })} />
              <input className={formStyles.input} type="url" aria-label={`Link ${index + 1} URL`} value={link.url} onChange={(event) => updateLink(index, { url: event.target.value })} />
              <button type="button" className={styles.removeButton} onClick={() => setStreamingLinks((current) => current.filter((_, i) => i !== index))}>Remove</button>
            </div>
          ))}
          <div className={styles.linkRow}>
            <input className={formStyles.input} aria-label="New link label" placeholder="Spotify" value={newLinkLabel} onChange={(event) => setNewLinkLabel(event.target.value)} />
            <input className={formStyles.input} type="url" aria-label="New link URL" placeholder="https://…" value={newLinkUrl} onChange={(event) => setNewLinkUrl(event.target.value)} />
            <button type="button" className={styles.secondaryButton} onClick={addLink}>Add link</button>
          </div>
        </section>

        <Field label="Live dates URL" id="press-live-dates">
          <input id="press-live-dates" className={formStyles.input} type="url" value={liveDatesUrl} onChange={(event) => setLiveDatesUrl(event.target.value)} placeholder="https://…" />
        </Field>

        <section className={styles.section} aria-labelledby="standout-heading">
          <h2 id="standout-heading" className={styles.subheading}>Standout track</h2>
          <Field label="Track title" id="press-track-title"><input id="press-track-title" className={formStyles.input} value={standoutTitle} onChange={(event) => setStandoutTitle(event.target.value)} /></Field>
          <Field label="Track URL" id="press-track-url"><input id="press-track-url" className={formStyles.input} type="url" value={standoutUrl} onChange={(event) => setStandoutUrl(event.target.value)} /></Field>
          <Field label="Streams label" id="press-streams-label"><input id="press-streams-label" className={formStyles.input} value={streamsLabel} onChange={(event) => setStreamsLabel(event.target.value)} placeholder="14.5k streams and climbing" /></Field>
        </section>

        <Field label="Press contact email" id="press-contact">
          <textarea id="press-contact" className={formStyles.textarea} rows={1} value={pressContactEmail} onChange={(event) => setPressContactEmail(event.target.value)} />
        </Field>
        <Field label="Location" id="press-location">
          <input id="press-location" className={formStyles.input} value={location} onChange={(event) => setLocation(event.target.value)} />
        </Field>

        <section className={styles.section} aria-labelledby="photos-heading">
          <h2 id="photos-heading" className={styles.subheading}>Press photos</h2>
          <p>Choose reusable library images. Changes appear here immediately and are published when you save.</p>
          <div className={styles.photoGrid}>
            {gallery.map((image, index) => (
              <PressImageField
                key={`${image.key}-${index}`}
                creatorId={creatorId}
                label={`Press photo ${index + 1}`}
                slot="gallery"
                value={image}
                onChange={(next) => setGallery((current) => next
                  ? current.map((candidate, candidateIndex) => candidateIndex === index ? next : candidate)
                  : current.filter((_, candidateIndex) => candidateIndex !== index))}
              />
            ))}
            <PressImageField
              creatorId={creatorId}
              label="Add press photo"
              slot="gallery"
              value={null}
              onChange={(next) => { if (next) setGallery((current) => [...current, next]); }}
            />
          </div>
        </section>

        <section className={styles.section} aria-labelledby="releases-heading">
          <div className={styles.sectionHeader}>
            <h2 id="releases-heading" className={styles.subheading}>Release one-sheets</h2>
            <button type="button" className={styles.secondaryButton} onClick={() => setReleases((current) => [...current, { ...EMPTY_RELEASE }])}>Add release</button>
          </div>
          {releases.map((release, index) => (
            <ReleaseEditor key={`release-${index}`} release={release} index={index} updateRelease={updateRelease} onRemove={() => setReleases((current) => current.filter((_, i) => i !== index))} />
          ))}
        </section>

        <button type="submit" className={buttonStyles.primaryButton} disabled={isSaving}>
          {isSaving ? "Saving…" : "Save press page"}
        </button>
      </form>
    </div>
  );
}

function Field({ label, id, children }: { label: string; id: string; children: React.ReactNode }): React.ReactElement {
  return <div className={styles.field}><label className={formStyles.label} htmlFor={id}>{label}</label>{children}</div>;
}

function ReleaseEditor({ release, index, updateRelease, onRemove }: { release: ReleaseOneSheet; index: number; updateRelease: (index: number, patch: Partial<ReleaseOneSheet>) => void; onRemove: () => void }): React.ReactElement {
  const field = (key: keyof ReleaseOneSheet, value: string): void => updateRelease(index, { [key]: value || null } as Partial<ReleaseOneSheet>);
  return (
    <fieldset className={styles.release}>
      <legend>Release {index + 1}</legend>
      <div className={styles.releaseGrid}>
        <Field label="Slug" id={`release-${index}-slug`}><input id={`release-${index}-slug`} className={formStyles.input} value={release.slug} onChange={(event) => updateRelease(index, { slug: event.target.value })} required /></Field>
        <Field label="Title" id={`release-${index}-title`}><input id={`release-${index}-title`} className={formStyles.input} value={release.title} onChange={(event) => updateRelease(index, { title: event.target.value })} required /></Field>
        <Field label="Catalog number" id={`release-${index}-catalog`}><input id={`release-${index}-catalog`} className={formStyles.input} value={release.catalogNumber ?? ""} onChange={(event) => field("catalogNumber", event.target.value)} /></Field>
        <Field label="Release date" id={`release-${index}-date`}><input id={`release-${index}-date`} className={formStyles.input} type="date" value={release.releaseDate ?? ""} onChange={(event) => field("releaseDate", event.target.value)} /></Field>
        <Field label="Format" id={`release-${index}-format`}><input id={`release-${index}-format`} className={formStyles.input} value={release.format ?? ""} onChange={(event) => field("format", event.target.value)} /></Field>
        <Field label="Genre" id={`release-${index}-genre`}><input id={`release-${index}-genre`} className={formStyles.input} value={release.genre ?? ""} onChange={(event) => field("genre", event.target.value)} /></Field>
        <Field label="ISRC" id={`release-${index}-isrc`}><input id={`release-${index}-isrc`} className={formStyles.input} value={release.isrc ?? ""} onChange={(event) => field("isrc", event.target.value)} /></Field>
        <Field label="UPC" id={`release-${index}-upc`}><input id={`release-${index}-upc`} className={formStyles.input} value={release.upc ?? ""} onChange={(event) => field("upc", event.target.value)} /></Field>
        <Field label="Duration" id={`release-${index}-duration`}><input id={`release-${index}-duration`} className={formStyles.input} value={release.duration ?? ""} onChange={(event) => field("duration", event.target.value)} /></Field>
        <Field label="FCC" id={`release-${index}-fcc`}><select id={`release-${index}-fcc`} className={formStyles.select} value={release.fcc ?? ""} onChange={(event) => updateRelease(index, { fcc: event.target.value === "" ? null : event.target.value as "clean" | "explicit" })}><option value="">Not set</option><option value="clean">Clean</option><option value="explicit">Explicit</option></select></Field>
        <Field label="Label" id={`release-${index}-label`}><input id={`release-${index}-label`} className={formStyles.input} value={release.label ?? ""} onChange={(event) => field("label", event.target.value)} /></Field>
        <Field label="Personnel" id={`release-${index}-personnel`}><textarea id={`release-${index}-personnel`} className={formStyles.textarea} rows={3} value={release.personnel.join("\n")} onChange={(event) => updateRelease(index, { personnel: splitList(event.target.value) })} placeholder="One person per line" /></Field>
        <Field label="Written by" id={`release-${index}-written`}><input id={`release-${index}-written`} className={formStyles.input} value={release.writtenBy ?? ""} onChange={(event) => field("writtenBy", event.target.value)} /></Field>
        <Field label="Produced by" id={`release-${index}-produced`}><input id={`release-${index}-produced`} className={formStyles.input} value={release.producedBy ?? ""} onChange={(event) => field("producedBy", event.target.value)} /></Field>
        <Field label="Mixed / mastered by" id={`release-${index}-mixed`}><input id={`release-${index}-mixed`} className={formStyles.input} value={release.mixedMasteredBy ?? ""} onChange={(event) => field("mixedMasteredBy", event.target.value)} /></Field>
        <Field label="Copyright line" id={`release-${index}-copyright`}><input id={`release-${index}-copyright`} className={formStyles.input} value={release.copyrightLine ?? ""} onChange={(event) => field("copyrightLine", event.target.value)} /></Field>
        <Field label="Publisher line" id={`release-${index}-publisher`}><input id={`release-${index}-publisher`} className={formStyles.input} value={release.publisherLine ?? ""} onChange={(event) => field("publisherLine", event.target.value)} /></Field>
        <Field label="Artwork key" id={`release-${index}-art-key`}><input id={`release-${index}-art-key`} className={formStyles.input} value={release.artKey ?? ""} onChange={(event) => field("artKey", event.target.value)} /></Field>
      </div>
      <button type="button" className={styles.removeButton} onClick={onRemove}>Remove release</button>
    </fieldset>
  );
}
