import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import type { ChangeEvent, DragEvent, KeyboardEvent } from "react";

import {
  MAX_FILE_SIZES,
  PRESS_IMAGE_SLOT_RATIOS,
} from "@snc/shared";
import type {
  ContentAsset,
  PressImage,
  PressImageCrop,
  PressImageSlotName,
} from "@snc/shared";

import {
  contentLibraryThumbnailUrl,
  fetchContentLibraryImages,
} from "../../lib/content-library.js";
import {
  DialogBackdrop,
  DialogCloseTrigger,
  DialogContent,
  DialogDescription,
  DialogRoot,
  DialogTitle,
} from "../ui/dialog.js";
import { MediaPickerCrop } from "./media-picker-crop.js";
import { uploadMediaPickerImage } from "./media-picker-upload.js";
import styles from "./media-picker.module.css";

export type MediaPickerMediaType = "image";

export interface MediaPickerTarget {
  readonly mediaType: MediaPickerMediaType;
  readonly slot: PressImageSlotName;
  readonly surfaceLabel: string;
  readonly slotLabel: string;
  readonly description?: string;
  readonly insertLabel?: string;
}

export interface MediaPickerProps {
  readonly open: boolean;
  readonly creatorId: string;
  readonly creatorName: string;
  readonly target: MediaPickerTarget;
  readonly initialValue?: PressImage;
  readonly onInsert: (image: PressImage) => void;
  readonly onClose: () => void;
}

type SourceView = "own" | "shared" | "upload";
type ShapeFilter = "any" | "wide" | "square" | "portrait";
type UseFilter = "all" | "usable" | "blocked";
type MobileStage = "browse" | "edit";
type Selection = {
  asset: ContentAsset;
  crop: PressImageCrop | null;
  previewReady: boolean;
  alt: string;
  credit: string;
};
type UploadState =
  | { status: "idle" }
  | { status: "uploading"; file: File; progress: number }
  | { status: "error"; file: File; message: string };

const ACCEPTED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const TAB_ORDER: SourceView[] = ["own", "shared", "upload"];
const SLOT_OUTPUT_DIMENSIONS = {
  banner: { width: 1800, height: 600 },
  about: { width: 800, height: 1000 },
  member: { width: 800, height: 800 },
  gallery: { width: 1200, height: 900 },
  cover: { width: 800, height: 800 },
} as const satisfies Record<PressImageSlotName, { width: number; height: number }>;

const uniqueAssets = (current: ContentAsset[], incoming: ContentAsset[]): ContentAsset[] => {
  const byId = new Map(current.map((asset) => [asset.id, asset]));
  for (const asset of incoming) byId.set(asset.id, asset);
  return [...byId.values()];
};

const assetName = (asset: ContentAsset): string => asset.originalFilename ?? "Untitled image";

const matchesShape = (asset: ContentAsset, shape: ShapeFilter): boolean => {
  if (shape === "any" || asset.width === null || asset.height === null) return true;
  const ratio = asset.width / asset.height;
  if (shape === "wide") return ratio > 1.15;
  if (shape === "portrait") return ratio < 0.87;
  return ratio >= 0.87 && ratio <= 1.15;
};

const useStatusLabel = (asset: ContentAsset): string => {
  const labels: Record<ContentAsset["useStatus"], string> = {
    own: "Own · usable",
    admin: "Admin · usable",
    open: "Open · usable",
    granted: "Granted · usable",
    "requestable-needs-grant": "Not available",
  };
  return labels[asset.useStatus];
};

const ownerLabel = (asset: ContentAsset, creatorId: string, creatorName: string): string =>
  asset.creatorId === creatorId ? creatorName : "Shared creator";

const validateUpload = (file: File): string | null => {
  if (!ACCEPTED_IMAGE_TYPES.has(file.type)) return "Choose a JPEG, PNG, or WebP image.";
  if (file.size > MAX_FILE_SIZES.image) return "This image is larger than the 10 MB limit.";
  return null;
};

/** Choose, crop, describe, and insert an image from the app-wide content library. */
export function MediaPicker({
  open,
  creatorId,
  creatorName,
  target,
  initialValue,
  onInsert,
  onClose,
}: MediaPickerProps): React.ReactElement {
  const id = useId();
  const altId = `${id}-alt`;
  const creditId = `${id}-credit`;
  const [view, setView] = useState<SourceView>("own");
  const [mobileStage, setMobileStage] = useState<MobileStage>("browse");
  const [assets, setAssets] = useState<ContentAsset[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [search, setSearch] = useState("");
  const [shapeFilter, setShapeFilter] = useState<ShapeFilter>("any");
  const [useFilter, setUseFilter] = useState<UseFilter>("all");
  const [failedImages, setFailedImages] = useState<Set<string>>(() => new Set());
  const [selection, setSelection] = useState<Selection | null>(null);
  const [upload, setUpload] = useState<UploadState>({ status: "idle" });
  const [announcement, setAnnouncement] = useState("");
  const initialized = useRef(false);
  const uploadController = useRef<AbortController | null>(null);

  const announce = useCallback((message: string): void => {
    setAnnouncement("");
    window.requestAnimationFrame(() => setAnnouncement(message));
  }, []);

  const load = useCallback(async (before?: string, signal?: AbortSignal): Promise<void> => {
    setIsLoading(true);
    setLoadError("");
    try {
      const page = await fetchContentLibraryImages(creatorId, before, signal);
      setAssets((current) => before ? uniqueAssets(current, page.items) : page.items);
      setNextCursor(page.nextCursor);
    } catch (cause) {
      if (signal?.aborted) return;
      setLoadError(cause instanceof Error ? cause.message : "Could not load the image library");
    } finally {
      if (!signal?.aborted) setIsLoading(false);
    }
  }, [creatorId]);

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    void load(undefined, controller.signal);
    return () => controller.abort();
  }, [load, open]);

  useEffect(() => () => uploadController.current?.abort(), []);

  const selectAsset = useCallback((asset: ContentAsset, value?: PressImage): void => {
    setSelection({
      asset,
      crop: value?.crop ?? null,
      previewReady: false,
      alt: value?.alt ?? "",
      credit: value?.credit ?? "",
    });
    setMobileStage("edit");
    announce(
      asset.canUse
        ? `${assetName(asset)} selected. Crop and description reset for this image. Insert remains disabled until crop output and alt text are ready.`
        : `${assetName(asset)} needs the owner's permission and is not available.`,
    );
  }, [announce]);

  useEffect(() => {
    if (initialized.current || !initialValue || assets.length === 0) return;
    const asset = assets.find((candidate) => candidate.storageKey === initialValue.key);
    if (!asset) return;
    initialized.current = true;
    selectAsset(asset, initialValue);
  }, [assets, initialValue, selectAsset]);

  const ownAssets = useMemo(
    () => assets.filter((asset) => asset.creatorId === creatorId),
    [assets, creatorId],
  );
  const sharedAssets = useMemo(
    () => assets.filter((asset) => asset.creatorId !== creatorId),
    [assets, creatorId],
  );
  const visibleAssets = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase();
    const source = view === "own" ? ownAssets : sharedAssets;
    return source.filter((asset) => {
      if (normalizedSearch && !assetName(asset).toLocaleLowerCase().includes(normalizedSearch)) return false;
      if (view === "own") return matchesShape(asset, shapeFilter);
      if (useFilter === "usable") return asset.canUse;
      if (useFilter === "blocked") return !asset.canUse;
      return true;
    });
  }, [ownAssets, search, shapeFilter, sharedAssets, useFilter, view]);

  const setTab = (next: SourceView, focus = false): void => {
    setView(next);
    setSearch("");
    if (focus) window.requestAnimationFrame(() => document.getElementById(`${id}-tab-${next}`)?.focus());
  };

  const onTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>, tab: SourceView): void => {
    const index = TAB_ORDER.indexOf(tab);
    let next: SourceView | undefined;
    if (event.key === "ArrowRight") next = TAB_ORDER[(index + 1) % TAB_ORDER.length];
    if (event.key === "ArrowLeft") next = TAB_ORDER[(index - 1 + TAB_ORDER.length) % TAB_ORDER.length];
    if (event.key === "Home") next = TAB_ORDER[0];
    if (event.key === "End") next = TAB_ORDER.at(-1);
    if (!next) return;
    event.preventDefault();
    setTab(next, true);
  };

  const beginUpload = async (file: File | undefined): Promise<void> => {
    if (!file) return;
    const validationError = validateUpload(file);
    if (validationError) {
      setUpload({ status: "error", file, message: validationError });
      announce(`Upload failed. ${validationError}`);
      return;
    }

    uploadController.current?.abort();
    const controller = new AbortController();
    uploadController.current = controller;
    setUpload({ status: "uploading", file, progress: 1 });
    try {
      const asset = await uploadMediaPickerImage(creatorId, file, {
        signal: controller.signal,
        onProgress: (progress) => setUpload((current) =>
          current.status === "uploading" && current.file === file
            ? { ...current, progress }
            : current),
      });
      setAssets((current) => uniqueAssets(current, [asset]));
      setUpload({ status: "idle" });
      selectAsset(asset);
      announce(`${file.name} uploaded and selected. Crop and description reset for this image.`);
    } catch (cause) {
      if (uploadController.current !== controller) return;
      if (cause instanceof DOMException && cause.name === "AbortError") {
        setUpload({ status: "idle" });
        announce("Upload canceled.");
        return;
      }
      setUpload({
        status: "error",
        file,
        message: cause instanceof Error ? cause.message : "Upload failed",
      });
      announce("Upload failed. Retry when ready.");
    } finally {
      if (uploadController.current === controller) uploadController.current = null;
    }
  };

  const onFileChange = (event: ChangeEvent<HTMLInputElement>): void => {
    void beginUpload(event.target.files?.[0]);
    event.target.value = "";
  };

  const currentId = selection?.asset.id;
  const onCropChange = useCallback((assetId: string, crop: PressImageCrop | null): void => {
    setSelection((current) => current?.asset.id === assetId
      ? { ...current, crop, previewReady: false }
      : current);
  }, []);
  const onReadyChange = useCallback((assetId: string, previewReady: boolean): void => {
    setSelection((current) => current?.asset.id === assetId
      ? { ...current, previewReady }
      : current);
  }, []);

  const ready = Boolean(
    selection?.asset.canUse
      && selection.crop
      && selection.previewReady
      && selection.alt.trim(),
  );
  const readiness = !selection
    ? "No image selected"
    : !selection.asset.canUse
      ? "This image is not available"
      : !selection.crop || !selection.previewReady
        ? selection.alt.trim() ? "Crop output is preparing" : "Crop output is preparing · Alt text required"
        : selection.alt.trim()
          ? "✓ Current crop ready · ✓ Alt text added"
          : "Crop ready · Add alt text to insert";

  const insert = (): void => {
    if (!selection || !selection.crop || !ready) return;
    onInsert({
      key: selection.asset.storageKey,
      crop: selection.crop,
      alt: selection.alt.trim(),
      credit: selection.credit.trim() || null,
    });
  };

  const clearSelection = (): void => {
    setSelection(null);
    setMobileStage("browse");
    announce("Selection cleared. Select an image to begin.");
  };

  const output = SLOT_OUTPUT_DIMENSIONS[target.slot];
  const panelId = `${id}-panel-${view}`;

  return (
    <DialogRoot
      open={open}
      onOpenChange={(details) => { if (!details.open) onClose(); }}
      lazyMount
      unmountOnExit
    >
      <DialogBackdrop />
      <DialogContent className={styles.dialog!}>
        <div className={styles.dialogLayout} data-mobile-stage={mobileStage}>
          <header className={styles.dialogHead}>
            <span
              className={styles.slotIcon}
              style={{ aspectRatio: PRESS_IMAGE_SLOT_RATIOS[target.slot].replace("/", " / ") }}
              aria-hidden="true"
            />
            <div className={styles.titleGroup}>
              <div className={styles.eyebrow}>{target.surfaceLabel} · {target.slotLabel} slot · fixed {PRESS_IMAGE_SLOT_RATIOS[target.slot].replace("/", ":")}</div>
              <DialogTitle className={styles.title}>Choose image</DialogTitle>
              <DialogDescription className={styles.description}>
                {target.description ?? `Originals stay reusable. This crop and description belong only to the ${target.slotLabel.toLocaleLowerCase()}.`}
              </DialogDescription>
            </div>
            <span className={styles.headNote}>Slot output · {output.width} × {output.height} px</span>
            <DialogCloseTrigger className={styles.closeButton} aria-label="Close image picker">×</DialogCloseTrigger>
          </header>

          <div className={styles.body}>
            <section className={styles.library} aria-label="Browse image sources">
              <div className={styles.tabs} role="tablist" aria-label="Image sources">
                <button
                  id={`${id}-tab-own`}
                  className={styles.tab}
                  type="button"
                  role="tab"
                  aria-selected={view === "own"}
                  aria-controls={`${id}-panel-own`}
                  tabIndex={view === "own" ? 0 : -1}
                  onClick={() => setTab("own")}
                  onKeyDown={(event) => onTabKeyDown(event, "own")}
                >
                  My library <span className={styles.count}>{ownAssets.length}{nextCursor ? "+" : ""}</span>
                </button>
                <button
                  id={`${id}-tab-shared`}
                  className={styles.tab}
                  type="button"
                  role="tab"
                  aria-selected={view === "shared"}
                  aria-controls={`${id}-panel-shared`}
                  tabIndex={view === "shared" ? 0 : -1}
                  onClick={() => setTab("shared")}
                  onKeyDown={(event) => onTabKeyDown(event, "shared")}
                >
                  Shared pool <span className={styles.count}>{sharedAssets.length}{nextCursor ? "+" : ""}</span>
                </button>
                <button
                  id={`${id}-tab-upload`}
                  className={`${styles.tab} ${styles.uploadTab}`}
                  type="button"
                  role="tab"
                  aria-selected={view === "upload"}
                  aria-controls={`${id}-panel-upload`}
                  tabIndex={view === "upload" ? 0 : -1}
                  onClick={() => setTab("upload")}
                  onKeyDown={(event) => onTabKeyDown(event, "upload")}
                >
                  ＋ Upload new
                </button>
              </div>

              {loadError ? (
                <div className={styles.loadError} role="alert">
                  <span>{loadError}</span>
                  <button type="button" onClick={() => void load()}>Try again</button>
                </div>
              ) : null}

              {view !== "upload" ? (
                <section
                  id={panelId}
                  className={styles.sourcePanel}
                  role="tabpanel"
                  aria-labelledby={`${id}-tab-${view}`}
                >
                  <div className={styles.tools}>
                    <input
                      className={styles.search}
                      type="search"
                      value={search}
                      placeholder={view === "own" ? `Search ${creatorName}'s images` : "Search other creators' shared images"}
                      aria-label={view === "own" ? "Search my library" : "Search shared pool"}
                      onChange={(event) => setSearch(event.target.value)}
                    />
                    {view === "own" ? (
                      <select aria-label="Image shape" value={shapeFilter} onChange={(event) => setShapeFilter(event.target.value as ShapeFilter)}>
                        <option value="any">Any shape</option>
                        <option value="wide">Wide</option>
                        <option value="square">Square</option>
                        <option value="portrait">Portrait</option>
                      </select>
                    ) : (
                      <select aria-label="Use status" value={useFilter} onChange={(event) => setUseFilter(event.target.value as UseFilter)}>
                        <option value="all">All shared</option>
                        <option value="usable">Usable now</option>
                        <option value="blocked">Not available</option>
                      </select>
                    )}
                  </div>
                  {(view === "own" ? ownAssets : sharedAssets).length > 0 ? (
                    <div className={styles.sourceNote}>
                      <span><b>{view === "own" ? `${creatorName} only` : "Other creators only"}</b> · {view === "own" ? "your originals" : "open, granted, or permission-needed"}</span>
                      <span>Newest first</span>
                    </div>
                  ) : null}

                  {isLoading && assets.length === 0 ? <p className={styles.loading} role="status">Loading images…</p> : null}
                  {!isLoading && (view === "own" ? ownAssets : sharedAssets).length === 0 ? (
                    <div className={styles.emptyState}>
                      <div className={styles.emptyInner}>
                        <div className={styles.emptyIcon} aria-hidden="true">＋</div>
                        <h3>{view === "own" ? "Your library is empty" : "No shared images yet"}</h3>
                        <p>{view === "own" ? "Upload an original to reuse it here and in other image slots, or browse images others have shared." : "Images shared by other creators will appear here when available."}</p>
                        <div className={styles.emptyActions}>
                          {view === "own" ? <button className={styles.primaryButton} type="button" onClick={() => setTab("upload", true)}>Upload an image</button> : null}
                          <button className={styles.secondaryButton} type="button" onClick={() => setTab(view === "own" ? "shared" : "own", true)}>{view === "own" ? "Browse shared pool" : "Back to my library"}</button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className={styles.assetGrid} role="group" aria-label={view === "own" ? "My library images" : "Shared pool images"}>
                      {visibleAssets.map((asset) => {
                        const selected = currentId === asset.id;
                        const owner = ownerLabel(asset, creatorId, creatorName);
                        return (
                          <button
                            key={asset.id}
                            className={styles.asset}
                            type="button"
                            aria-pressed={selected}
                            aria-label={`${asset.canUse ? "Choose" : "Inspect unavailable"} ${assetName(asset)}`}
                            onClick={() => selectAsset(asset)}
                          >
                            <span className={styles.art}>
                              {failedImages.has(asset.id) ? (
                                <span className={styles.thumbnailFallback}>Preview unavailable</span>
                              ) : (
                                <img
                                  src={contentLibraryThumbnailUrl(asset.storageKey)}
                                  alt=""
                                  onError={() => setFailedImages((current) => new Set(current).add(asset.id))}
                                />
                              )}
                              <span className={`${styles.badge} ${asset.canUse ? styles.badgeGood : styles.badgeBlocked}`}>{useStatusLabel(asset)}</span>
                            </span>
                            <span className={styles.assetCopy}>
                              <strong>{assetName(asset)}</strong>
                              <small>{asset.width ?? "?"} × {asset.height ?? "?"} · {owner}</small>
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {(view === "own" ? ownAssets : sharedAssets).length > 0 ? (
                    <footer className={styles.pagination}>
                      <span>Showing {visibleAssets.length} {view === "own" ? "own" : "shared"} image{visibleAssets.length === 1 ? "" : "s"}</span>
                      {nextCursor ? <button className={styles.loadMore} type="button" disabled={isLoading} onClick={() => void load(nextCursor)}>{isLoading ? "Loading…" : "Load more"}</button> : null}
                    </footer>
                  ) : null}
                </section>
              ) : (
                <section
                  id={`${id}-panel-upload`}
                  className={styles.sourcePanel}
                  role="tabpanel"
                  aria-labelledby={`${id}-tab-upload`}
                >
                  <div className={styles.uploadPanel}>
                    <div className={styles.uploadWrap}>
                      <h3>Upload a new image</h3>
                      <p>It will be added to {creatorName}'s library, then opened here for crop and description.</p>
                      <div
                        className={styles.dropzone}
                        onDragEnter={(event: DragEvent<HTMLDivElement>) => event.preventDefault()}
                        onDragOver={(event: DragEvent<HTMLDivElement>) => event.preventDefault()}
                        onDrop={(event: DragEvent<HTMLDivElement>) => {
                          event.preventDefault();
                          void beginUpload(event.dataTransfer.files[0]);
                        }}
                      >
                        <div>
                          <div className={styles.uploadIcon} aria-hidden="true">⇧</div>
                          <strong>Drop an image here</strong>
                          <span>JPEG, PNG, or WebP · maximum 10 MB</span>
                          <label className={styles.fileLabel}>
                            Choose file
                            <input type="file" accept="image/jpeg,image/png,image/webp" onChange={onFileChange} />
                          </label>
                        </div>
                      </div>
                      {upload.status === "uploading" ? (
                        <div className={styles.uploadStatus}>
                          <div className={styles.uploadRow}>
                            <div><strong>{upload.file.name}</strong><small>Uploading to {creatorName}'s library…</small></div>
                            <button className={styles.secondaryButton} type="button" onClick={() => uploadController.current?.abort()}>Cancel</button>
                          </div>
                          <progress max="100" value={upload.progress}>{upload.progress}%</progress>
                        </div>
                      ) : null}
                      {upload.status === "error" ? (
                        <div className={`${styles.uploadStatus} ${styles.uploadError}`} role="alert">
                          <div className={styles.uploadRow}>
                            <div><strong>Upload failed</strong><small>{upload.message}</small></div>
                            <button className={styles.secondaryButton} type="button" onClick={() => void beginUpload(upload.file)}>Retry</button>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </section>
              )}
            </section>

            <aside className={styles.workflow} aria-label="Selected image crop and description">
              {!selection ? (
                <div className={styles.idle}>
                  <div>
                    <div className={styles.idleMark} aria-hidden="true">{PRESS_IMAGE_SLOT_RATIOS[target.slot].replace("/", ":")}</div>
                    <h3>Select an image to begin</h3>
                    <p>Choose an available image from your library or the shared pool. Crop and description will appear here for that image only.</p>
                  </div>
                  <footer className={styles.workflowActions}>
                    <p className={styles.readiness}>No image selected</p>
                    <button className={styles.insert} type="button" disabled>Insert into {target.slotLabel.toLocaleLowerCase()}</button>
                  </footer>
                </div>
              ) : (
                <div className={styles.selectedState}>
                  <div className={styles.workflowScroll}>
                    <button
                      className={styles.backMobile}
                      type="button"
                      onClick={() => {
                        setMobileStage("browse");
                        window.requestAnimationFrame(() => document.getElementById(`${id}-tab-${view}`)?.focus());
                      }}
                    >
                      ← Back to images
                    </button>
                    <div className={styles.selectionHead}>
                      <div className={styles.selectionThumb} aria-hidden="true">
                        {failedImages.has(selection.asset.id) ? null : <img src={contentLibraryThumbnailUrl(selection.asset.storageKey)} alt="" />}
                      </div>
                      <div className={styles.selectionCopy}>
                        <span className={styles.selectionKicker}>Selected image</span>
                        <strong>{assetName(selection.asset)}</strong>
                        <small>{selection.asset.width ?? "?"} × {selection.asset.height ?? "?"} · {ownerLabel(selection.asset, creatorId, creatorName)}</small>
                      </div>
                      <button className={styles.clearSelection} type="button" onClick={clearSelection}>Clear</button>
                    </div>
                    <div className={`${styles.permission} ${selection.asset.canUse ? "" : styles.permissionBlocked}`}>
                      <span className={styles.statusDot} aria-hidden="true" />
                      <span>
                        <b>{selection.asset.canUse ? `Usable now · ${useStatusLabel(selection.asset).split(" · ")[0]}` : "Not available"}</b>
                        <small>{selection.asset.canUse ? (selection.asset.creatorId === creatorId ? `This image belongs to ${creatorName}.` : "This image has been made usable now.") : "This image needs the owner's permission — it is not available for this slot."}</small>
                      </span>
                    </div>

                    {selection.asset.canUse ? (
                      <>
                        <MediaPickerCrop
                          key={selection.asset.id}
                          assetId={selection.asset.id}
                          creatorId={creatorId}
                          imageKey={selection.asset.storageKey}
                          sourceWidth={selection.asset.width}
                          sourceHeight={selection.asset.height}
                          slot={target.slot}
                          slotLabel={target.slotLabel}
                          outputWidth={output.width}
                          outputHeight={output.height}
                          {...(initialValue?.key === selection.asset.storageKey && initialValue.crop ? { initialCrop: initialValue.crop } : {})}
                          onCropChange={onCropChange}
                          onReadyChange={onReadyChange}
                          announce={announce}
                        />
                        <div className={styles.field}>
                          <label htmlFor={altId}>Alternative text <span>Required</span></label>
                          <textarea
                            id={altId}
                            value={selection.alt}
                            aria-required="true"
                            placeholder="Describe what matters in the image"
                            onChange={(event) => setSelection((current) => current ? { ...current, alt: event.target.value } : null)}
                          />
                          <p className={styles.fieldHelp}>Describe the subject and useful context; don't start with “image of.”</p>
                        </div>
                        <div className={styles.field}>
                          <label htmlFor={creditId}>Photo credit <span>Optional</span></label>
                          <input
                            id={creditId}
                            type="text"
                            value={selection.credit}
                            placeholder="Photographer or source"
                            onChange={(event) => setSelection((current) => current ? { ...current, credit: event.target.value } : null)}
                          />
                        </div>
                      </>
                    ) : null}
                  </div>
                  <footer className={styles.workflowActions}>
                    <p className={`${styles.readiness} ${ready ? styles.ready : ""}`}>{readiness}</p>
                    <button className={styles.insert} type="button" disabled={!ready} onClick={insert}>{target.insertLabel ?? `Insert into ${target.slotLabel.toLocaleLowerCase()}`}</button>
                  </footer>
                </div>
              )}
            </aside>
          </div>

          <footer className={styles.mobileFooter} aria-label="Selection and insert actions">
            <div className={styles.mobileSummary}>
              <strong>{selection ? assetName(selection.asset) : "No image selected"}</strong>
              <span>{!selection ? "Choose an available image to continue" : !selection.asset.canUse ? "Not available · owner's permission needed" : ready ? `Ready to insert into ${target.slotLabel.toLocaleLowerCase()}` : selection.previewReady ? "Add alt text to finish" : "Preparing crop output…"}</span>
            </div>
            <button className={styles.mobileInsert} type="button" disabled={!ready} onClick={insert}>Insert</button>
          </footer>
          <div className={styles.srOnly} aria-live="polite" aria-atomic="true">{announcement}</div>
        </div>
      </DialogContent>
    </DialogRoot>
  );
}
