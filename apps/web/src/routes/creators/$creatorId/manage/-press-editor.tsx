import { useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent } from "react";

import {
  CREATOR_BRAND_COLORS,
  inferService,
} from "@snc/shared";
import type {
  CreatorBrandColor,
  CreatorProfileResponse,
  PressContent,
  PressHighlight,
  PressMember,
  PressStreamingService,
} from "@snc/shared";

import { PressImageField } from "../../../../components/press/index.js";
import {
  DialogBackdrop,
  DialogContent,
  DialogDescription,
  DialogRoot,
  DialogTitle,
} from "../../../../components/ui/dialog.js";
import { fetchCreatorProfile, updateCreatorProfile } from "../../../../lib/creator.js";
import { apiMutate } from "../../../../lib/fetch-utils.js";
import { fetchPressConfig, updatePressConfig } from "../../../../lib/press.js";
import {
  PRESS_EDITOR_TABS,
  cleanEditorContent,
  moveItem,
  normalizeEditorContent,
  validatePressDraft,
} from "./-press-editor-model.js";
import type {
  PdfScheme,
  PressEditorIssue,
  PressEditorTab,
} from "./-press-editor-model.js";
import styles from "./manage-press.module.css";

const STREAMING_SERVICES: ReadonlyArray<{ value: PressStreamingService; label: string }> = [
  { value: "spotify", label: "Spotify" },
  { value: "apple-music", label: "Apple Music" },
  { value: "amazon-music", label: "Amazon Music" },
  { value: "youtube", label: "YouTube" },
  { value: "bandcamp", label: "Bandcamp" },
  { value: "soundcloud", label: "SoundCloud" },
  { value: "tidal", label: "Tidal" },
  { value: "website", label: "Website" },
];

const EMPTY_MEMBER: PressMember = {
  name: "",
  role: null,
  bio: null,
  photo: null,
};

const EMPTY_HIGHLIGHT: PressHighlight = {
  eyebrow: "",
  title: "",
  description: null,
  metric: null,
  url: null,
  coverArt: null,
};

type SaveState = "saved" | "unsaved" | "saving" | "error" | "publishing" | "published";

interface PressEditorProps {
  readonly creatorId: string;
}

const tabLabel = (tab: PressEditorTab): string =>
  PRESS_EDITOR_TABS.find((candidate) => candidate.id === tab)?.label ?? tab;

const stateLabel = (state: SaveState): string => {
  const labels: Record<SaveState, string> = {
    saved: "Saved (draft)",
    unsaved: "Unsaved changes",
    saving: "Saving draft…",
    error: "Error · draft not saved",
    publishing: "Publishing draft…",
    published: "Published to live",
  };
  return labels[state];
};

const stateDetail = (state: SaveState, detail: string): string => {
  if (detail) return detail;
  if (state === "unsaved") return "Changes remain in this browser until you save";
  if (state === "saving") return "The live press page remains unchanged";
  if (state === "publishing") return "Copying this draft to the public press page";
  if (state === "published") return "The live press page and PDF now use this version";
  return "Draft workspace ready · not live until published";
};

export function PressEditor({ creatorId }: PressEditorProps): React.ReactElement {
  const [content, setContent] = useState<PressContent | null>(null);
  const [brandColor, setBrandColor] = useState<CreatorBrandColor | null>(null);
  const [savedBrandColor, setSavedBrandColor] = useState<CreatorBrandColor | null>(null);
  const [creatorName, setCreatorName] = useState("Creator");
  const [activeTab, setActiveTab] = useState<PressEditorTab>("appearance");
  const [dirtyTabs, setDirtyTabs] = useState<Set<PressEditorTab>>(() => new Set());
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [saveDetail, setSaveDetail] = useState("");
  const [loadError, setLoadError] = useState("");
  const [pdfScheme, setPdfScheme] = useState<PdfScheme>("light");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<number | null>(null);
  const [editingHighlight, setEditingHighlight] = useState<number | null>(null);
  const [memberReorderMessage, setMemberReorderMessage] = useState("");
  const [highlightReorderMessage, setHighlightReorderMessage] = useState("");
  const reviewRef = useRef<HTMLElement>(null);
  const tabRefs = useRef(new Map<PressEditorTab, HTMLButtonElement>());

  useEffect(() => {
    let cancelled = false;
    setLoadError("");
    void Promise.all([fetchPressConfig(creatorId), fetchCreatorProfile(creatorId)])
      .then(([press, profile]) => {
        if (cancelled) return;
        setContent(normalizeEditorContent(press));
        setBrandColor(profile.brandColor);
        setSavedBrandColor(profile.brandColor);
        setCreatorName(profile.displayName);
        setSaveState("saved");
        setSaveDetail("Draft workspace ready · not live until published");
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setLoadError(error instanceof Error ? error.message : "Failed to load the press editor");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [creatorId]);

  const issues = useMemo(() => content ? validatePressDraft(content) : [], [content]);
  const issueCountByTab = useMemo(() => {
    const counts = new Map<PressEditorTab, number>();
    issues.forEach((issue) => counts.set(issue.tab, (counts.get(issue.tab) ?? 0) + 1));
    return counts;
  }, [issues]);
  const isBusy = saveState === "saving" || saveState === "publishing";

  const markDirty = (tab: PressEditorTab): void => {
    setDirtyTabs((current) => new Set(current).add(tab));
    setSaveState("unsaved");
    setSaveDetail("");
  };

  const updateContent = (
    tab: PressEditorTab,
    update: (current: PressContent) => PressContent,
  ): void => {
    setContent((current) => current ? update(current) : current);
    markDirty(tab);
  };

  const activateTab = (tab: PressEditorTab, focus = false): void => {
    setActiveTab(tab);
    if (typeof window !== "undefined") window.history.replaceState(null, "", `#${tab}`);
    if (focus) requestAnimationFrame(() => tabRefs.current.get(tab)?.focus());
  };

  const onTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number): void => {
    let target: number | null = null;
    if (event.key === "ArrowRight") target = (index + 1) % PRESS_EDITOR_TABS.length;
    if (event.key === "ArrowLeft") target = (index - 1 + PRESS_EDITOR_TABS.length) % PRESS_EDITOR_TABS.length;
    if (event.key === "Home") target = 0;
    if (event.key === "End") target = PRESS_EDITOR_TABS.length - 1;
    if (target === null) return;
    event.preventDefault();
    activateTab(PRESS_EDITOR_TABS[target]!.id, true);
  };

  const focusIssue = (issue: PressEditorIssue): void => {
    const memberMatch = /^press-member-(\d+)-/.exec(issue.fieldId);
    const highlightMatch = /^press-highlight-(\d+)-/.exec(issue.fieldId);
    if (memberMatch) setEditingMember(Number(memberMatch[1]));
    if (highlightMatch) setEditingHighlight(Number(highlightMatch[1]));
    activateTab(issue.tab);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const container = document.getElementById(issue.fieldId);
        const target = container?.matches("input, textarea, select, button")
          ? container
          : container?.querySelector<HTMLElement>("input, textarea, select, button");
        target?.focus();
        target?.scrollIntoView?.({ block: "center" });
      });
    });
  };

  const persistDraft = async (publishReady = false): Promise<boolean> => {
    if (!content) return false;
    const next = cleanEditorContent(publishReady ? { ...content, enabled: true } : content);
    setSaveState("saving");
    setSaveDetail("The live press page remains unchanged");
    try {
      const saved = await updatePressConfig(creatorId, next);
      if (brandColor !== savedBrandColor) {
        const profile: CreatorProfileResponse = await updateCreatorProfile(creatorId, { brandColor });
        setBrandColor(profile.brandColor);
        setSavedBrandColor(profile.brandColor);
      }
      setContent(normalizeEditorContent(saved));
      setDirtyTabs(new Set());
      setSaveState("saved");
      setSaveDetail("Saved just now · not live until published");
      return true;
    } catch (error: unknown) {
      setSaveState("error");
      setSaveDetail(error instanceof Error ? error.message : "Could not save the draft");
      return false;
    }
  };

  const publishDraft = async (): Promise<void> => {
    if (issues.length > 0) {
      setSaveState("error");
      setSaveDetail(`Resolve ${issues.length} validation ${issues.length === 1 ? "issue" : "issues"} before publishing`);
      document.getElementById("press-error-summary")?.focus();
      return;
    }
    if (!await persistDraft(true)) return;
    setSaveState("publishing");
    setSaveDetail("");
    try {
      const published = await apiMutate<PressContent>(
        `/api/creators/${encodeURIComponent(creatorId)}/press-config/publish`,
        { method: "POST" },
      );
      setContent(normalizeEditorContent(published));
      setSaveState("published");
      setSaveDetail("");
      setDirtyTabs(new Set());
    } catch (error: unknown) {
      setSaveState("error");
      setSaveDetail(error instanceof Error ? error.message : "Could not publish the draft");
    }
  };

  const discardDraft = async (): Promise<void> => {
    setSaveState("saving");
    setSaveDetail("Restoring the currently published press page");
    try {
      const published = await apiMutate<PressContent>(
        `/api/creators/${encodeURIComponent(creatorId)}/press-config/discard-draft`,
        { method: "POST" },
      );
      setContent(normalizeEditorContent(published));
      setBrandColor(savedBrandColor);
      setPdfScheme("light");
      setDirtyTabs(new Set());
      setSaveState("saved");
      setSaveDetail("Draft discarded · published content restored");
    } catch (error: unknown) {
      setSaveState("error");
      setSaveDetail(error instanceof Error ? error.message : "Could not discard the draft");
    }
  };

  const moveMember = (index: number, direction: -1 | 1): void => {
    if (!content) return;
    const member = content.members[index];
    if (!member) return;
    updateContent("members", (current) => ({
      ...current,
      members: moveItem(current.members, index, direction),
    }));
    const nextIndex = index + direction;
    setEditingMember((current) => current === index ? nextIndex : current);
    setMemberReorderMessage(`${member.name || "Member"} moved to position ${nextIndex + 1} of ${content.members.length}.`);
  };

  const moveHighlight = (index: number, direction: -1 | 1): void => {
    if (!content) return;
    const highlight = content.highlights[index];
    if (!highlight) return;
    updateContent("highlights", (current) => ({
      ...current,
      highlights: moveItem(current.highlights, index, direction),
    }));
    const nextIndex = index + direction;
    setEditingHighlight((current) => current === index ? nextIndex : current);
    setHighlightReorderMessage(`${highlight.title || "Highlight"} moved to position ${nextIndex + 1} of ${content.highlights.length}.`);
  };

  if (loadError) {
    return <div className={styles.loadError} role="alert"><h1>Press page</h1><p>{loadError}</p></div>;
  }
  if (!content) return <p className={styles.loading} role="status">Loading press page editor…</p>;

  const liveUrl = `/creators/${encodeURIComponent(creatorId)}/press`;
  const memberPhotos = content.members.filter((member) => member.photo).length;
  const highlightCovers = content.highlights.filter((highlight) => highlight.coverArt).length;

  return (
    <div className={styles.page}>
      <header className={styles.pageHead}>
        <div>
          <h1>Press page</h1>
          <p>Build the draft here. The live page and PDF stay on the published version until you publish.</p>
        </div>
        <div className={styles.headActions}>
          <button type="button" className={styles.button} onClick={() => setPreviewOpen(true)}>Preview draft</button>
          <a className={`${styles.button} ${styles.quietButton}`} href={liveUrl} target="_blank" rel="noreferrer">
            View live <span aria-hidden="true">↗</span>
          </a>
        </div>
      </header>

      <section className={styles.workflowStrip} aria-label="Draft save status and actions">
        <div className={styles.saveState} role="status" aria-live="polite">
          <span className={`${styles.statusDot} ${styles[saveState]}`} aria-hidden="true" />
          <span className={styles.stateCopy}>
            <strong>{stateLabel(saveState)}</strong>
            <small>{stateDetail(saveState, saveDetail)}</small>
          </span>
          <span className={styles.stateLifecycle} aria-label="Possible draft states">
            {(["unsaved", "saving", "saved", "error"] as const).map((state) => (
              <span key={state} className={`${styles.stateChip} ${saveState === state ? styles.currentState : ""}`}>
                {state === "saved" ? "Saved (draft)" : state[0]!.toUpperCase() + state.slice(1)}
              </span>
            ))}
          </span>
        </div>
        <div className={styles.workflowActions}>
          <button type="button" className={styles.button} disabled={isBusy} onClick={() => void persistDraft()}>
            {saveState === "error" ? "Retry save draft" : "Save draft"}
          </button>
          <button
            type="button"
            className={`${styles.button} ${styles.primaryButton}`}
            onClick={() => {
              reviewRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
              requestAnimationFrame(() => reviewRef.current?.querySelector<HTMLElement>("button")?.focus());
            }}
          >
            Review / Publish
          </button>
        </div>
      </section>

      <nav className={styles.tabs} role="tablist" aria-label="Press page editor sections">
        {PRESS_EDITOR_TABS.map((tab, index) => {
          const issueCount = issueCountByTab.get(tab.id) ?? 0;
          const dirty = dirtyTabs.has(tab.id);
          return (
            <button
              key={tab.id}
              ref={(node) => { if (node) tabRefs.current.set(tab.id, node); }}
              id={`press-tab-${tab.id}`}
              type="button"
              className={styles.tab}
              role="tab"
              aria-selected={activeTab === tab.id}
              aria-controls={`press-panel-${tab.id}`}
              tabIndex={activeTab === tab.id ? 0 : -1}
              onClick={() => activateTab(tab.id)}
              onKeyDown={(event) => onTabKeyDown(event, index)}
            >
              <span>{tab.label}</span>
              <span className={`${styles.tabState} ${issueCount ? styles.issueState : dirty ? styles.dirtyState : ""}`}>
                {issueCount ? `${issueCount} ${issueCount === 1 ? "issue" : "issues"}` : dirty ? "Unsaved" : "Complete"}
              </span>
            </button>
          );
        })}
      </nav>

      <form className={styles.panelWrap} onSubmit={(event) => event.preventDefault()} noValidate>
        {issues.length > 0 && (
          <aside
            id="press-error-summary"
            className={styles.errorSummary}
            role="alert"
            aria-labelledby="press-error-title"
            tabIndex={-1}
          >
            <h2 id="press-error-title">{issues.length} {issues.length === 1 ? "issue" : "issues"} across this draft</h2>
            <p>Publishing is blocked. Select an issue to open its tab and focus the field.</p>
            <ul>
              {issues.map((issue, index) => (
                <li key={`${issue.fieldId}-${index}`}>
                  <button type="button" className={styles.errorLink} onClick={() => focusIssue(issue)}>
                    {tabLabel(issue.tab)} — {issue.message}
                  </button>
                </li>
              ))}
            </ul>
          </aside>
        )}

        <section ref={reviewRef} className={styles.reviewPublish} aria-labelledby="press-review-title">
          <div>
            <h2 id="press-review-title">Review draft, then publish to live</h2>
            <p><strong>Save draft</strong> only persists your workspace. <strong>Publish</strong> copies the reviewed draft to the live press page and replaces the PDF source.</p>
            <div className={styles.reviewSteps}>
              <span className={styles.reviewStep}>1 · Save draft</span>
              <span className={issues.length === 0 ? `${styles.reviewStep} ${styles.reviewDone}` : styles.reviewStep}>2 · Resolve issues</span>
              <span className={styles.reviewStep}>3 · Preview draft</span>
              <span className={styles.reviewStep}>4 · Publish</span>
            </div>
          </div>
          <div className={styles.publishSide}>
            <button type="button" className={styles.button} onClick={() => setPreviewOpen(true)}>Open full draft review</button>
            <button
              type="button"
              className={`${styles.button} ${styles.primaryButton}`}
              disabled={issues.length > 0 || isBusy}
              aria-describedby={issues.length ? "press-publish-blocked" : undefined}
              onClick={() => void publishDraft()}
            >
              Publish draft to live
            </button>
            {issues.length > 0 && <small id="press-publish-blocked">Resolve {issues.length} validation {issues.length === 1 ? "issue" : "issues"} to publish</small>}
            <button type="button" className={`${styles.button} ${styles.dangerButton}`} disabled={isBusy} onClick={() => void discardDraft()}>
              Discard draft
            </button>
          </div>
        </section>

        <TabPanel id="appearance" activeTab={activeTab}>
          <PanelHeading title="Appearance & media" description="Choose presentation settings and see every press asset at a glance. Entity images stay with the content they describe; edit member photos, cover art, and gallery images in context." />
          <div className={styles.appearanceGrid}>
            <article className={styles.card} aria-labelledby="press-template-heading">
              <h3 id="press-template-heading">Public-page template</h3>
              <p className={styles.cardIntro}>Templates change the public page’s content rhythm only. PDF layout is selected separately.</p>
              <div className={styles.templateGrid} role="radiogroup" aria-labelledby="press-template-heading">
                {(["A", "B"] as const).map((template) => (
                  <label key={template} className={`${styles.templateChoice} ${content.template === template ? styles.selectedChoice : ""}`}>
                    <input
                      type="radio"
                      name="press-template"
                      value={template}
                      checked={content.template === template}
                      onChange={() => updateContent("appearance", (current) => ({ ...current, template }))}
                    />
                    <span className={`${styles.templatePreview} ${template === "B" ? styles.templateSplit : styles.templateEditorial}`} aria-hidden="true"><i /><i /><i /><i /></span>
                    <strong>{template === "A" ? "Editorial" : "Split profile"}</strong>
                    <small>{template === "A" ? "Full-width banner and story-led reading order." : "Persistent identity column with denser highlights and links."}</small>
                  </label>
                ))}
              </div>
            </article>

            <article className={styles.card} aria-labelledby="press-pdf-heading">
              <h3 id="press-pdf-heading">PDF color scheme</h3>
              <p className={styles.cardIntro}>Preview the independent PDF color treatment. PDF content continues to use the published version.</p>
              <div className={styles.pdfGrid} aria-label="PDF color scheme choices">
                {(["light", "dark", "accent"] as const).map((scheme) => (
                  <button
                    key={scheme}
                    type="button"
                    className={`${styles.pdfChoice} ${styles[`pdf${scheme[0]!.toUpperCase()}${scheme.slice(1)}`]}`}
                    aria-pressed={pdfScheme === scheme}
                    onClick={() => setPdfScheme(scheme)}
                  >
                    <span className={styles.pdfPreview} aria-hidden="true"><i /><i /><i /><i /></span>
                    <strong>{scheme === "accent" ? "Creator Accent" : scheme[0]!.toUpperCase() + scheme.slice(1)}</strong>
                    <small>{scheme === "light" ? "Warm paper, dark type" : scheme === "dark" ? "Ink field, light type" : "Brand band, light body"}</small>
                  </button>
                ))}
              </div>
              <div className={styles.pdfActions}>
                <span>Selected: {pdfScheme === "accent" ? "Creator Accent" : pdfScheme[0]!.toUpperCase() + pdfScheme.slice(1)}</span>
                <a className={styles.button} href={`/api/creators/${encodeURIComponent(creatorId)}/press/one-pager.pdf?theme=${pdfScheme === "accent" ? "brand" : pdfScheme}`} target="_blank" rel="noreferrer">Preview PDF</a>
              </div>
            </article>

            <article className={`${styles.card} ${styles.brandCard}`} aria-labelledby="press-brand-heading">
              <h3 id="press-brand-heading">Creator brand color · site-wide profile setting</h3>
              <div className={styles.brandWarning}><strong>This changes more than the press page.</strong> It updates creator surfaces and the Creator Accent PDF treatment.</div>
              <div className={styles.swatches} aria-label="Accessible brand color presets">
                {CREATOR_BRAND_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    className={styles.swatch}
                    style={{ backgroundColor: color }}
                    aria-label={`${color} brand color${brandColor === color ? ", selected" : ""}`}
                    aria-pressed={brandColor === color}
                    onClick={() => {
                      setBrandColor(color);
                      markDirty("appearance");
                    }}
                  />
                ))}
                <button
                  type="button"
                  className={`${styles.swatch} ${styles.defaultSwatch}`}
                  aria-label="Use platform default brand color"
                  aria-pressed={brandColor === null}
                  onClick={() => {
                    setBrandColor(null);
                    markDirty("appearance");
                  }}
                >×</button>
              </div>
              <p className={styles.help}>Only curated presets meeting contrast requirements are offered. Foreground ink is derived by each consumer.</p>
              <div className={styles.brandSurfaces}>
                <div className={styles.darkSurface}><strong>Creator-page link</strong><span style={{ backgroundColor: brandColor ?? "var(--color-accent)" }}>Listen to {creatorName} →</span><small>Dark surface preview</small></div>
                <div className={styles.lightSurface}><strong>Light PDF</strong><span style={{ backgroundColor: brandColor ?? "var(--color-accent)" }}>{creatorName} · Press kit</span><small>Derived dark ink</small></div>
              </div>
            </article>
          </div>

          <div id="press-banner-image" className={styles.imageField} data-slot="banner">
            <PressImageField creatorId={creatorId} label="Banner image · 3:1" slot="banner" value={content.banner ?? null} onChange={(banner) => updateContent("appearance", (current) => ({ ...current, banner }))} />
          </div>

          <section aria-labelledby="press-assets-heading">
            <h3 id="press-assets-heading">Asset overview</h3>
            <div className={styles.assetOverview}>
              <AssetCard title="About photo" detail={content.aboutPhoto ? "4:5 · selected" : "No image selected"} empty={!content.aboutPhoto} onEdit={() => activateTab("about", true)} />
              <AssetCard title="Member photos" detail={`${memberPhotos} selected · ${Math.max(0, content.members.length - memberPhotos)} empty`} empty={memberPhotos === 0} onEdit={() => activateTab("members", true)} />
              <AssetCard title="Highlight cover art" detail={`${highlightCovers} selected · ${Math.max(0, content.highlights.length - highlightCovers)} empty`} empty={highlightCovers === 0} onEdit={() => activateTab("highlights", true)} />
              <AssetCard title="Gallery" detail={content.gallery.length ? `${content.gallery.length} selected` : "No gallery delivery yet"} empty={content.gallery.length === 0} onEdit={() => activateTab("gallery", true)} />
            </div>
          </section>
        </TabPanel>

        <TabPanel id="about" activeTab={activeTab}>
          <PanelHeading title="About" description="Core story and creator identity shared by both public templates and the PDF." />
          <div className={styles.fields}>
            <Field id="press-tagline" label="Tagline"><input id="press-tagline" value={content.tagline ?? ""} onChange={(event) => updateContent("about", (current) => ({ ...current, tagline: event.target.value }))} /></Field>
            <Field id="press-location" label="Location"><input id="press-location" value={content.location ?? ""} onChange={(event) => updateContent("about", (current) => ({ ...current, location: event.target.value }))} /></Field>
            <Field id="press-short-bio" label="Short bio" hint="Used on cards and at the top of the PDF."><textarea id="press-short-bio" rows={5} value={content.shortBio ?? ""} onChange={(event) => updateContent("about", (current) => ({ ...current, shortBio: event.target.value }))} /></Field>
            <Field id="press-long-bio" label="Long bio"><textarea id="press-long-bio" rows={7} value={content.longBio ?? ""} onChange={(event) => updateContent("about", (current) => ({ ...current, longBio: event.target.value }))} /></Field>
            <Field id="press-for-fans" label="For fans of" hint="One artist per line or comma-separated." wide><textarea id="press-for-fans" rows={3} value={content.forFansOf.join("\n")} onChange={(event) => updateContent("about", (current) => ({ ...current, forFansOf: event.target.value.split(/[\n,]/).map((value) => value.trim()).filter(Boolean) }))} /></Field>
          </div>
          <div id="press-about-image" className={styles.imageField} data-slot="about">
            <PressImageField creatorId={creatorId} label="About photo · 4:5" slot="about" value={content.aboutPhoto ?? null} onChange={(aboutPhoto) => updateContent("about", (current) => ({ ...current, aboutPhoto }))} />
          </div>
        </TabPanel>

        <TabPanel id="members" activeTab={activeTab}>
          <PanelHeading
            title="Members"
            description="Photos live inside each member editor. Use Move up / Move down for keyboard reordering; changes are announced."
            action={<button type="button" className={styles.button} onClick={() => {
              setEditingMember(content.members.length);
              updateContent("members", (current) => ({ ...current, members: [...current.members, { ...EMPTY_MEMBER }] }));
            }}>+ Add member</button>}
          />
          <div className={styles.reorderFeedback} role="status" aria-live="polite">{memberReorderMessage || "Member order is used on the public page and PDF."}</div>
          {content.members.length === 0 ? <EmptyState title="No members added" copy="Add the people who should appear in the press kit. Photos can stay empty until delivery." /> : null}
          <div className={styles.list}>
            {content.members.map((member, index) => (
              <article key={`member-${index}`} className={styles.rowCard}>
                <div className={styles.rowSummary}>
                  <span className={`${styles.thumbnailPlaceholder} ${member.photo ? styles.hasAsset : ""}`} aria-hidden="true">{member.photo ? "Photo" : "Photo pending"}</span>
                  <div><strong>{member.name || `Member ${index + 1}`}</strong><small>{member.role || "Role not set"} · {member.bio ? "Bio complete" : "Bio pending"} · {member.photo ? "Photo selected" : "Photo pending"}</small></div>
                  <div className={styles.rowActions}>
                    <button type="button" className={styles.button} aria-expanded={editingMember === index} onClick={() => setEditingMember((current) => current === index ? null : index)}>Edit</button>
                    <button type="button" className={styles.iconButton} aria-label={`Move ${member.name || `member ${index + 1}`} up`} disabled={index === 0} onClick={() => moveMember(index, -1)}>↑</button>
                    <button type="button" className={styles.iconButton} aria-label={`Move ${member.name || `member ${index + 1}`} down`} disabled={index === content.members.length - 1} onClick={() => moveMember(index, 1)}>↓</button>
                    <button type="button" className={`${styles.iconButton} ${styles.dangerButton}`} aria-label={`Remove ${member.name || `member ${index + 1}`}`} onClick={() => {
                      setEditingMember(null);
                      updateContent("members", (current) => ({ ...current, members: current.members.filter((_, candidate) => candidate !== index) }));
                    }}>×</button>
                  </div>
                </div>
                {editingMember === index && (
                  <div className={styles.entityEditor}>
                    <div className={styles.fields}>
                      <Field id={`press-member-${index}-name`} label="Name"><input id={`press-member-${index}-name`} value={member.name} aria-invalid={!member.name.trim()} onChange={(event) => updateContent("members", (current) => ({ ...current, members: current.members.map((candidate, candidateIndex) => candidateIndex === index ? { ...candidate, name: event.target.value } : candidate) }))} /></Field>
                      <Field id={`press-member-${index}-role`} label="Role"><input id={`press-member-${index}-role`} value={member.role ?? ""} onChange={(event) => updateContent("members", (current) => ({ ...current, members: current.members.map((candidate, candidateIndex) => candidateIndex === index ? { ...candidate, role: event.target.value } : candidate) }))} /></Field>
                      <Field id={`press-member-${index}-bio`} label="Bio" wide><textarea id={`press-member-${index}-bio`} rows={4} value={member.bio ?? ""} onChange={(event) => updateContent("members", (current) => ({ ...current, members: current.members.map((candidate, candidateIndex) => candidateIndex === index ? { ...candidate, bio: event.target.value } : candidate) }))} /></Field>
                    </div>
                    <div id={`press-member-${index}-photo`} className={styles.imageField} data-slot="member">
                      <PressImageField creatorId={creatorId} label={`${member.name || `Member ${index + 1}`} photo · 1:1`} slot="member" value={member.photo ?? null} onChange={(photo) => updateContent("members", (current) => ({ ...current, members: current.members.map((candidate, candidateIndex) => candidateIndex === index ? { ...candidate, photo } : candidate) }))} />
                    </div>
                  </div>
                )}
              </article>
            ))}
          </div>
        </TabPanel>

        <TabPanel id="highlights" activeTab={activeTab}>
          <PanelHeading
            title="Highlights"
            description="Orderable releases, tracks, milestones, and coverage. Cover art stays inside each highlight editor."
            action={<button type="button" className={styles.button} onClick={() => {
              setEditingHighlight(content.highlights.length);
              updateContent("highlights", (current) => ({ ...current, highlights: [...current.highlights, { ...EMPTY_HIGHLIGHT }] }));
            }}>+ Add highlight</button>}
          />
          <div className={styles.reorderFeedback} role="status" aria-live="polite">{highlightReorderMessage || "Highlight order is shared by both public templates."}</div>
          {content.highlights.length === 0 ? <EmptyState title="No highlights yet" copy="Add a release, standout track, milestone, or piece of coverage." /> : null}
          <div className={styles.list}>
            {content.highlights.map((highlight, index) => (
              <article key={`highlight-${index}`} className={styles.rowCard}>
                <div className={styles.rowSummary}>
                  <span className={`${styles.thumbnailPlaceholder} ${highlight.coverArt ? styles.hasAsset : ""}`} aria-hidden="true">{highlight.coverArt ? "Cover" : "Art pending"}</span>
                  <div><strong>{highlight.title || `Highlight ${index + 1}`}</strong><small>{highlight.eyebrow || "Type not set"}{highlight.metric ? ` · ${highlight.metric}` : ""} · {highlight.coverArt ? "Cover selected" : "Cover pending"}</small></div>
                  <div className={styles.rowActions}>
                    <button type="button" className={styles.button} aria-expanded={editingHighlight === index} onClick={() => setEditingHighlight((current) => current === index ? null : index)}>Edit</button>
                    <button type="button" className={styles.iconButton} aria-label={`Move ${highlight.title || `highlight ${index + 1}`} up`} disabled={index === 0} onClick={() => moveHighlight(index, -1)}>↑</button>
                    <button type="button" className={styles.iconButton} aria-label={`Move ${highlight.title || `highlight ${index + 1}`} down`} disabled={index === content.highlights.length - 1} onClick={() => moveHighlight(index, 1)}>↓</button>
                    <button type="button" className={`${styles.iconButton} ${styles.dangerButton}`} aria-label={`Remove ${highlight.title || `highlight ${index + 1}`}`} onClick={() => {
                      setEditingHighlight(null);
                      updateContent("highlights", (current) => ({ ...current, highlights: current.highlights.filter((_, candidate) => candidate !== index) }));
                    }}>×</button>
                  </div>
                </div>
                {editingHighlight === index && (
                  <div className={styles.entityEditor}>
                    <div className={styles.fields}>
                      <Field id={`press-highlight-${index}-eyebrow`} label="Eyebrow"><input id={`press-highlight-${index}-eyebrow`} value={highlight.eyebrow} onChange={(event) => updateContent("highlights", (current) => ({ ...current, highlights: current.highlights.map((candidate, candidateIndex) => candidateIndex === index ? { ...candidate, eyebrow: event.target.value } : candidate) }))} /></Field>
                      <Field id={`press-highlight-${index}-title`} label="Title"><input id={`press-highlight-${index}-title`} value={highlight.title} aria-invalid={!highlight.title.trim()} onChange={(event) => updateContent("highlights", (current) => ({ ...current, highlights: current.highlights.map((candidate, candidateIndex) => candidateIndex === index ? { ...candidate, title: event.target.value } : candidate) }))} /></Field>
                      <Field id={`press-highlight-${index}-description`} label="Description" wide><textarea id={`press-highlight-${index}-description`} rows={4} value={highlight.description ?? ""} onChange={(event) => updateContent("highlights", (current) => ({ ...current, highlights: current.highlights.map((candidate, candidateIndex) => candidateIndex === index ? { ...candidate, description: event.target.value } : candidate) }))} /></Field>
                      <Field id={`press-highlight-${index}-metric`} label="Metric"><input id={`press-highlight-${index}-metric`} value={highlight.metric ?? ""} placeholder="~14.5k streams" onChange={(event) => updateContent("highlights", (current) => ({ ...current, highlights: current.highlights.map((candidate, candidateIndex) => candidateIndex === index ? { ...candidate, metric: event.target.value } : candidate) }))} /></Field>
                      <Field id={`press-highlight-${index}-url`} label="URL"><input id={`press-highlight-${index}-url`} type="url" value={highlight.url ?? ""} onChange={(event) => updateContent("highlights", (current) => ({ ...current, highlights: current.highlights.map((candidate, candidateIndex) => candidateIndex === index ? { ...candidate, url: event.target.value } : candidate) }))} /></Field>
                    </div>
                    <div id={`press-highlight-${index}-cover`} className={styles.imageField} data-slot="cover">
                      <PressImageField creatorId={creatorId} label={`${highlight.title || `Highlight ${index + 1}`} cover art · 1:1`} slot="cover" value={highlight.coverArt ?? null} onChange={(coverArt) => updateContent("highlights", (current) => ({ ...current, highlights: current.highlights.map((candidate, candidateIndex) => candidateIndex === index ? { ...candidate, coverArt } : candidate) }))} />
                    </div>
                  </div>
                )}
              </article>
            ))}
          </div>
        </TabPanel>

        <TabPanel id="gallery" activeTab={activeTab}>
          <PanelHeading title="Gallery" description="Press photos are edited here: library picker → fixed 4:3 crop → required alt text and optional credit." />
          {content.gallery.length === 0 && <EmptyState title="No gallery delivery yet" copy="Animal Future photos have not been delivered. Every slot can remain empty until assets arrive." />}
          <div className={styles.galleryGrid}>
            {content.gallery.map((image, index) => (
              <div key={`${image.key}-${index}`} id={`press-gallery-${index}-image`} className={styles.imageField} data-slot="gallery">
                <PressImageField creatorId={creatorId} label={`Gallery image ${index + 1} · 4:3`} slot="gallery" value={image} onChange={(next) => updateContent("gallery", (current) => ({ ...current, gallery: next ? current.gallery.map((candidate, candidateIndex) => candidateIndex === index ? next : candidate) : current.gallery.filter((_, candidateIndex) => candidateIndex !== index) }))} />
              </div>
            ))}
            <div className={`${styles.imageField} ${styles.galleryAdd}`} data-slot="gallery">
              <PressImageField creatorId={creatorId} label="Add gallery image · 4:3" slot="gallery" value={null} onChange={(image) => { if (image) updateContent("gallery", (current) => ({ ...current, gallery: [...current.gallery, image] })); }} />
            </div>
          </div>
        </TabPanel>

        <TabPanel id="links" activeTab={activeTab}>
          <PanelHeading
            title="Links & contact"
            description="Listening destinations, live dates, and the public press contact. Publishing is controlled globally above."
            action={<button type="button" className={styles.button} onClick={() => updateContent("links", (current) => ({ ...current, streamingLinks: [...current.streamingLinks, { label: "", url: "", service: "website" }] }))}>+ Add link</button>}
          />
          <div className={styles.linkList}>
            {content.streamingLinks.map((link, index) => (
              <article key={`link-${index}`} className={styles.linkRow}>
                <Field id={`press-link-${index}-service`} label="Service">
                  <select id={`press-link-${index}-service`} value={link.service ?? inferService(link.url)} onChange={(event) => updateContent("links", (current) => ({ ...current, streamingLinks: current.streamingLinks.map((candidate, candidateIndex) => candidateIndex === index ? { ...candidate, service: event.target.value as PressStreamingService } : candidate) }))}>
                    {STREAMING_SERVICES.map((service) => <option key={service.value} value={service.value}>{service.label}</option>)}
                  </select>
                </Field>
                <Field id={`press-link-${index}-label`} label="Label"><input id={`press-link-${index}-label`} value={link.label} onChange={(event) => updateContent("links", (current) => ({ ...current, streamingLinks: current.streamingLinks.map((candidate, candidateIndex) => candidateIndex === index ? { ...candidate, label: event.target.value } : candidate) }))} /></Field>
                <Field id={`press-link-${index}-url`} label="URL"><input id={`press-link-${index}-url`} type="url" value={link.url} onChange={(event) => updateContent("links", (current) => ({ ...current, streamingLinks: current.streamingLinks.map((candidate, candidateIndex) => candidateIndex === index ? { ...candidate, url: event.target.value } : candidate) }))} /></Field>
                <button type="button" className={`${styles.iconButton} ${styles.dangerButton}`} aria-label={`Remove ${link.label || `link ${index + 1}`}`} onClick={() => updateContent("links", (current) => ({ ...current, streamingLinks: current.streamingLinks.filter((_, candidateIndex) => candidateIndex !== index) }))}>×</button>
              </article>
            ))}
          </div>
          <div className={`${styles.fields} ${styles.contactFields}`}>
            <Field id="press-live-dates" label="Live dates URL"><input id="press-live-dates" type="url" value={content.liveDatesUrl ?? ""} onChange={(event) => updateContent("links", (current) => ({ ...current, liveDatesUrl: event.target.value }))} /></Field>
            <Field id="press-contact-email" label="Press contact email"><input id="press-contact-email" type="email" value={content.pressContactEmail ?? ""} onChange={(event) => updateContent("links", (current) => ({ ...current, pressContactEmail: event.target.value }))} /></Field>
          </div>
        </TabPanel>
      </form>

      {previewOpen && (
        <DialogRoot open onOpenChange={(details) => { if (!details.open) setPreviewOpen(false); }}>
          <DialogBackdrop />
          <DialogContent className={styles.previewDialog!}>
            <DialogTitle>Draft preview · {creatorName}</DialogTitle>
            <DialogDescription>This is the unsaved editor state. View live opens the currently published page instead.</DialogDescription>
            <div className={styles.draftPreview} data-template={content.template}>
              <span className={styles.previewEyebrow}>Template {content.template}</span>
              <h2>{creatorName}</h2>
              <p className={styles.previewTagline}>{content.tagline || "Add a tagline in About"}</p>
              <p>{content.shortBio || "Add a short bio to introduce the press kit."}</p>
              <dl>
                <div><dt>Members</dt><dd>{content.members.length}</dd></div>
                <div><dt>Highlights</dt><dd>{content.highlights.length}</dd></div>
                <div><dt>Gallery</dt><dd>{content.gallery.length}</dd></div>
              </dl>
              {issues.length > 0 && <p className={styles.previewWarning}>{issues.length} publish {issues.length === 1 ? "issue" : "issues"} remain.</p>}
            </div>
            <div className={styles.previewActions}>
              <button type="button" className={styles.button} onClick={() => setPreviewOpen(false)}>Back to editor</button>
              <a className={styles.button} href={liveUrl} target="_blank" rel="noreferrer">View live ↗</a>
            </div>
          </DialogContent>
        </DialogRoot>
      )}
    </div>
  );
}

function TabPanel({
  id,
  activeTab,
  children,
}: {
  readonly id: PressEditorTab;
  readonly activeTab: PressEditorTab;
  readonly children: React.ReactNode;
}): React.ReactElement {
  return (
    <section
      id={`press-panel-${id}`}
      className={styles.tabPanel}
      role="tabpanel"
      aria-labelledby={`press-tab-${id}`}
      tabIndex={0}
      hidden={activeTab !== id}
    >
      {children}
    </section>
  );
}

function PanelHeading({
  title,
  description,
  action,
}: {
  readonly title: string;
  readonly description: string;
  readonly action?: React.ReactNode;
}): React.ReactElement {
  return (
    <header className={styles.panelHead}>
      <div><h2>{title}</h2><p>{description}</p></div>
      {action}
    </header>
  );
}

function Field({
  id,
  label,
  hint,
  wide = false,
  children,
}: {
  readonly id: string;
  readonly label: string;
  readonly hint?: string;
  readonly wide?: boolean;
  readonly children: React.ReactNode;
}): React.ReactElement {
  return (
    <div className={`${styles.field} ${wide ? styles.wideField : ""}`}>
      <label htmlFor={id}>{label}</label>
      {children}
      {hint && <p className={styles.help}>{hint}</p>}
    </div>
  );
}

function AssetCard({
  title,
  detail,
  empty,
  onEdit,
}: {
  readonly title: string;
  readonly detail: string;
  readonly empty: boolean;
  readonly onEdit: () => void;
}): React.ReactElement {
  return (
    <article className={styles.assetCard}>
      <div className={`${styles.assetArt} ${empty ? styles.emptyAsset : ""}`} aria-hidden="true">{empty ? "No image" : "Selected"}</div>
      <strong>{title}</strong>
      <small>{detail}</small>
      <button type="button" className={styles.assetLink} onClick={onEdit}>Edit in {title.replace(" photo", "").replace(" cover art", "")} →</button>
    </article>
  );
}

function EmptyState({ title, copy }: { readonly title: string; readonly copy: string }): React.ReactElement {
  return <div className={styles.emptyState}><strong>{title}</strong><p>{copy}</p></div>;
}
