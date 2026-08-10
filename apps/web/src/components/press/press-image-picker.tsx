import { useEffect, useId, useMemo, useState } from "react";

import { PRESS_IMAGE_SLOT_RATIOS } from "@snc/shared";
import type {
  ContentAsset,
  PressImage,
  PressImageCrop,
  PressImageSlotName,
} from "@snc/shared";

import {
  contentLibraryThumbnailUrl,
  fetchContentLibraryImages,
  uploadContentLibraryImage,
} from "../../lib/content-library.js";
import { contentLibraryRawUrl } from "../../lib/press-images.js";
import {
  DialogBackdrop,
  DialogContent,
  DialogDescription,
  DialogRoot,
  DialogTitle,
} from "../ui/dialog.js";
import { PressCropEditor } from "./press-crop-editor.js";
import styles from "./press-image-picker.module.css";

export interface PressImagePickerProps {
  readonly creatorId: string;
  readonly slot: PressImageSlotName;
  readonly initialImage?: PressImage;
  readonly onApply: (image: PressImage) => void;
  readonly onCancel: () => void;
}

type SourceView = "own" | "shared";
type PickerStep = "source" | "crop" | "details";

const SLOT_LABELS: Record<PressImageSlotName, string> = {
  banner: "Banner image",
  about: "About image",
  member: "Member photo",
  gallery: "Gallery image",
  cover: "Cover art",
};

const SLOT_MINIMUMS: Record<PressImageSlotName, { width: number; height: number }> = {
  banner: { width: 1800, height: 600 },
  about: { width: 800, height: 1000 },
  member: { width: 800, height: 800 },
  gallery: { width: 1200, height: 900 },
  cover: { width: 800, height: 800 },
};

const uniqueAssets = (current: ContentAsset[], incoming: ContentAsset[]): ContentAsset[] => {
  const seen = new Set(current.map((asset) => asset.id));
  return [...current, ...incoming.filter((asset) => !seen.has(asset.id))];
};

/** Upload/reuse chooser plus crop and per-reference metadata for press images. */
export function PressImagePicker({
  creatorId,
  slot,
  initialImage,
  onApply,
  onCancel,
}: PressImagePickerProps): React.ReactElement {
  const altId = useId();
  const creditId = useId();
  const [step, setStep] = useState<PickerStep>(initialImage ? "crop" : "source");
  const [view, setView] = useState<SourceView>("own");
  const [assets, setAssets] = useState<ContentAsset[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState("");
  const [failedImages, setFailedImages] = useState<Set<string>>(() => new Set());
  const [selected, setSelected] = useState<ContentAsset | null>(null);
  const [crop, setCrop] = useState<PressImageCrop | undefined>(initialImage?.crop);
  const [alt, setAlt] = useState(initialImage?.alt ?? "");
  const [credit, setCredit] = useState(initialImage?.credit ?? "");
  const [altError, setAltError] = useState("");

  const load = async (before?: string, signal?: AbortSignal): Promise<void> => {
    setIsLoading(true);
    setError("");
    try {
      const page = await fetchContentLibraryImages(creatorId, before, signal);
      setAssets((current) => before ? uniqueAssets(current, page.items) : page.items);
      setNextCursor(page.nextCursor);
    } catch (cause) {
      if (signal?.aborted) return;
      setError(cause instanceof Error ? cause.message : "Could not load the image library");
    } finally {
      if (!signal?.aborted) setIsLoading(false);
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    void load(undefined, controller.signal);
    return () => controller.abort();
  }, [creatorId]);

  const visibleAssets = useMemo(
    () => assets.filter((asset) => view === "own"
      ? asset.creatorId === creatorId
      : asset.creatorId !== creatorId),
    [assets, creatorId, view],
  );

  const selectedKey = selected?.storageKey ?? initialImage?.key;
  const selectedWidth = selected?.width ?? null;
  const selectedHeight = selected?.height ?? null;
  const priorCrop = crop ?? initialImage?.crop;

  const choose = (asset: ContentAsset): void => {
    if (!asset.canUse) return;
    setSelected(asset);
    setCrop(undefined);
    setAlt("");
    setCredit("");
    setAltError("");
    setStep("crop");
  };

  const upload = async (file: File | undefined): Promise<void> => {
    if (!file) return;
    setIsUploading(true);
    setError("");
    try {
      const asset = await uploadContentLibraryImage(creatorId, file);
      setAssets((current) => uniqueAssets(current, [asset]));
      choose(asset);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not upload the image");
    } finally {
      setIsUploading(false);
    }
  };

  if (step === "crop" && selectedKey) {
    return (
      <PressCropEditor
        creatorId={creatorId}
        imageKey={selectedKey}
        sourceWidth={selectedWidth}
        sourceHeight={selectedHeight}
        slot={slot}
        slotLabel={SLOT_LABELS[slot]}
        {...(priorCrop ? { initialCrop: priorCrop } : {})}
        onApply={(nextCrop) => {
          setCrop(nextCrop);
          setStep("details");
        }}
        onCancel={() => {
          if (initialImage && !selected) onCancel();
          else setStep("source");
        }}
      />
    );
  }

  const apply = (): void => {
    const trimmedAlt = alt.trim();
    if (!trimmedAlt) {
      setAltError("Alternative text is required");
      return;
    }
    if (!selectedKey || !crop) return;
    onApply({
      key: selectedKey,
      alt: trimmedAlt,
      credit: credit.trim() || null,
      crop,
    });
  };

  const minimum = SLOT_MINIMUMS[slot];
  const isSoft = selectedWidth !== null && selectedHeight !== null
    && (selectedWidth < minimum.width || selectedHeight < minimum.height);

  return (
    <DialogRoot open onOpenChange={(details) => { if (!details.open) onCancel(); }}>
      <DialogBackdrop />
      <DialogContent className={styles.dialog!}>
        <DialogTitle>{step === "details" ? `Describe ${SLOT_LABELS[slot]}` : `Choose ${SLOT_LABELS[slot]}`}</DialogTitle>
        <DialogDescription>
          This slot uses a fixed {PRESS_IMAGE_SLOT_RATIOS[slot]} crop. Originals stay reusable in your content library.
        </DialogDescription>

        {error && (
          <div className={styles.error} role="alert">
            <span>{error}</span>
            <button type="button" onClick={() => void load()}>Try again</button>
          </div>
        )}

        {step === "source" ? (
          <>
            <label className={styles.upload}>
              <span>{isUploading ? "Uploading…" : "Upload new image"}</span>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                disabled={isUploading}
                onChange={(event) => {
                  void upload(event.target.files?.[0]);
                  event.target.value = "";
                }}
              />
            </label>

            <div className={styles.tabs} role="tablist" aria-label="Image sources">
              <button type="button" role="tab" aria-selected={view === "own"} onClick={() => setView("own")}>Your library</button>
              <button type="button" role="tab" aria-selected={view === "shared"} onClick={() => setView("shared")}>Shared pool</button>
            </div>

            {isLoading && assets.length === 0 ? <p role="status">Loading images…</p> : null}
            {!isLoading && visibleAssets.length === 0 ? (
              <p className={styles.empty}>No images in this view yet. Upload one or try the other source.</p>
            ) : null}
            <ul className={styles.assetGrid} aria-label={view === "own" ? "Your library images" : "Shared images"}>
              {visibleAssets.map((asset) => (
                <li key={asset.id} className={styles.assetCard}>
                  {failedImages.has(asset.id)
                    ? <div className={styles.thumbnailFallback}>Thumbnail unavailable</div>
                    : (
                        <img
                          src={contentLibraryThumbnailUrl(asset.storageKey)}
                          alt=""
                          onError={() => setFailedImages((current) => new Set(current).add(asset.id))}
                        />
                      )}
                  <p>{asset.originalFilename ?? "Untitled image"}</p>
                  <p className={styles.meta}>{asset.width ?? "?"} × {asset.height ?? "?"} px</p>
                  <button
                    type="button"
                    disabled={!asset.canUse}
                    aria-label={`${asset.canUse ? "Use" : "Cannot use"} ${asset.originalFilename ?? "untitled image"}`}
                    onClick={() => choose(asset)}
                  >
                    {asset.canUse ? "Use image" : "Permission required"}
                  </button>
                  {!asset.canUse && (
                    <p className={styles.meta}>Access requests are not available yet.</p>
                  )}
                </li>
              ))}
            </ul>

            {nextCursor && (
              <button type="button" className={styles.loadMore} disabled={isLoading} onClick={() => void load(nextCursor)}>
                {isLoading ? "Loading…" : "Load more"}
              </button>
            )}
          </>
        ) : (
          <div className={styles.details}>
            {selectedKey && <img src={contentLibraryRawUrl(selectedKey, creatorId)} alt="" />}
            {isSoft && (
              <p className={styles.guidance}>
                This source is below the suggested {minimum.width} × {minimum.height} px for this slot. You can still use it.
              </p>
            )}
            <label htmlFor={altId}>Alternative text <span aria-hidden="true">*</span></label>
            <textarea
              id={altId}
              value={alt}
              aria-required="true"
              aria-invalid={Boolean(altError)}
              aria-describedby={altError ? `${altId}-error` : undefined}
              onChange={(event) => {
                setAlt(event.target.value);
                if (event.target.value.trim()) setAltError("");
              }}
            />
            {altError && <p id={`${altId}-error`} className={styles.error} role="alert">{altError}</p>}
            <label htmlFor={creditId}>Photo credit (optional)</label>
            <input id={creditId} value={credit} onChange={(event) => setCredit(event.target.value)} />
          </div>
        )}

        <div className={styles.actions}>
          <button type="button" onClick={onCancel}>Cancel</button>
          {step === "details" && (
            <>
              <button type="button" onClick={() => setStep("crop")}>Edit crop</button>
              <button type="button" onClick={apply}>Apply image</button>
            </>
          )}
        </div>
      </DialogContent>
    </DialogRoot>
  );
}
