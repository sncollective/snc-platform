import { useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent, PointerEvent } from "react";

import { PRESS_IMAGE_SLOT_RATIOS } from "@snc/shared";
import type {
  PressImageCrop,
  PressImageSlotName,
} from "@snc/shared";

import {
  cropFromViewport,
  viewportFromCrop,
} from "../../lib/press-image-crop.js";
import type {
  CropCenter,
  CropSourceSize,
} from "../../lib/press-image-crop.js";
import {
  contentLibraryRawUrl,
  requestPressImagePreview,
} from "../../lib/press-images.js";
import {
  DialogBackdrop,
  DialogContent,
  DialogDescription,
  DialogRoot,
  DialogTitle,
} from "../ui/dialog.js";
import styles from "./press-crop-editor.module.css";

export interface PressCropEditorProps {
  readonly creatorId: string;
  readonly imageKey: string;
  readonly sourceWidth: number | null;
  readonly sourceHeight: number | null;
  readonly slot: PressImageSlotName;
  readonly slotLabel: string;
  readonly initialCrop?: PressImageCrop;
  readonly onApply: (crop: PressImageCrop) => void;
  readonly onCancel: () => void;
}

type DragStart = {
  x: number;
  y: number;
  center: CropCenter;
};

const suppliedSource = (
  width: number | null,
  height: number | null,
): CropSourceSize | null =>
  width !== null && width > 0 && height !== null && height > 0
    ? { width, height }
    : null;

const cropStyle = (crop: PressImageCrop | null): React.CSSProperties | undefined =>
  crop
    ? {
        width: `${100 / crop.width}%`,
        height: `${100 / crop.height}%`,
        left: `${-100 * crop.x / crop.width}%`,
        top: `${-100 * crop.y / crop.height}%`,
      }
    : undefined;

/** Fixed-frame, keyboard-accessible pan/zoom editor for one press image reference. */
export function PressCropEditor({
  creatorId,
  imageKey,
  sourceWidth,
  sourceHeight,
  slot,
  slotLabel,
  initialCrop,
  onApply,
  onCancel,
}: PressCropEditorProps): React.ReactElement {
  const [source, setSource] = useState<CropSourceSize | null>(() =>
    suppliedSource(sourceWidth, sourceHeight));
  const [center, setCenter] = useState<CropCenter>({ x: 0.5, y: 0.5 });
  const [zoom, setZoom] = useState(1);
  const [signedPreview, setSignedPreview] = useState<string | null>(null);
  const [previewState, setPreviewState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const dragStart = useRef<DragStart | null>(null);
  const previewRequest = useRef(0);

  useEffect(() => {
    const nextSource = suppliedSource(sourceWidth, sourceHeight);
    if (nextSource) setSource(nextSource);
  }, [sourceHeight, sourceWidth]);

  useEffect(() => {
    if (!source) return;
    const restored = viewportFromCrop({
      source,
      slot,
      ...(initialCrop ? { crop: initialCrop } : {}),
    });
    setCenter(restored.center);
    setZoom(restored.zoom);
  }, [
    initialCrop?.height,
    initialCrop?.width,
    initialCrop?.x,
    initialCrop?.y,
    slot,
    source?.height,
    source?.width,
  ]);

  const crop = useMemo(
    () => source
      ? cropFromViewport({ source, slot, center, zoom })
      : null,
    [center, slot, source, zoom],
  );

  useEffect(() => {
    if (!crop) return;
    const requestId = ++previewRequest.current;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setPreviewState("loading");
      void requestPressImagePreview({
        creatorId,
        key: imageKey,
        crop,
        slot,
        width: 960,
        signal: controller.signal,
      })
        .then((descriptor) => {
          if (requestId !== previewRequest.current) return;
          setSignedPreview(descriptor.src);
          setPreviewState("ready");
        })
        .catch((error: unknown) => {
          if (controller.signal.aborted || requestId !== previewRequest.current) return;
          void error;
          setPreviewState("error");
        });
    }, 250);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [creatorId, crop, imageKey, slot]);

  const updateCenter = (next: CropCenter): void => {
    if (!source) return;
    const normalized = cropFromViewport({ source, slot, center: next, zoom });
    setCenter({
      x: normalized.x + normalized.width / 2,
      y: normalized.y + normalized.height / 2,
    });
  };

  const updateZoom = (next: number): void => {
    if (!source) return;
    const bounded = Math.min(8, Math.max(1, next));
    const normalized = cropFromViewport({ source, slot, center, zoom: bounded });
    setZoom(bounded);
    setCenter({
      x: normalized.x + normalized.width / 2,
      y: normalized.y + normalized.height / 2,
    });
  };

  const reset = (): void => {
    setCenter({ x: 0.5, y: 0.5 });
    setZoom(1);
  };

  const onViewportKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (!crop) return;
    const stepX = crop.width * (event.shiftKey ? 0.1 : 0.02);
    const stepY = crop.height * (event.shiftKey ? 0.1 : 0.02);
    const keyActions: Partial<Record<string, () => void>> = {
      ArrowLeft: () => updateCenter({ x: center.x - stepX, y: center.y }),
      ArrowRight: () => updateCenter({ x: center.x + stepX, y: center.y }),
      ArrowUp: () => updateCenter({ x: center.x, y: center.y - stepY }),
      ArrowDown: () => updateCenter({ x: center.x, y: center.y + stepY }),
      "+": () => updateZoom(zoom + 0.1),
      "=": () => updateZoom(zoom + 0.1),
      "-": () => updateZoom(zoom - 0.1),
    };
    const action = keyActions[event.key];
    if (!action) return;
    event.preventDefault();
    action();
  };

  const onPointerDown = (event: PointerEvent<HTMLDivElement>): void => {
    if (!crop) return;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    dragStart.current = { x: event.clientX, y: event.clientY, center };
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>): void => {
    if (!crop || !dragStart.current) return;
    const rect = event.currentTarget.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    updateCenter({
      x: dragStart.current.center.x
        - (event.clientX - dragStart.current.x) * crop.width / rect.width,
      y: dragStart.current.center.y
        - (event.clientY - dragStart.current.y) * crop.height / rect.height,
    });
  };

  return (
    <DialogRoot open onOpenChange={(details) => { if (!details.open) onCancel(); }}>
      <DialogBackdrop />
      <DialogContent className={styles.dialog!}>
        <DialogTitle>Crop {slotLabel}</DialogTitle>
        <DialogDescription>
          Pan the image inside the fixed {PRESS_IMAGE_SLOT_RATIOS[slot]} frame. Use arrow keys to nudge and +/− to zoom.
        </DialogDescription>

        <div
          className={styles.viewport}
          style={{ aspectRatio: PRESS_IMAGE_SLOT_RATIOS[slot].replace("/", " / ") }}
          role="application"
          aria-label={`${slotLabel} crop viewport`}
          tabIndex={0}
          onKeyDown={onViewportKeyDown}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={() => { dragStart.current = null; }}
          onPointerCancel={() => { dragStart.current = null; }}
        >
          <img
            className={crop ? styles.sourceImage : styles.uncroppedImage}
            style={cropStyle(crop)}
            src={contentLibraryRawUrl(imageKey)}
            alt=""
            draggable={false}
            onLoad={(event) => {
              if (!source && event.currentTarget.naturalWidth > 0 && event.currentTarget.naturalHeight > 0) {
                setSource({
                  width: event.currentTarget.naturalWidth,
                  height: event.currentTarget.naturalHeight,
                });
              }
            }}
          />
          <span className={styles.frame} aria-hidden="true" />
        </div>

        <div className={styles.controls}>
          <label htmlFor={`press-crop-zoom-${slot}`}>Zoom</label>
          <input
            id={`press-crop-zoom-${slot}`}
            type="range"
            min="1"
            max="8"
            step="0.01"
            value={zoom}
            disabled={!crop}
            onChange={(event) => updateZoom(Number(event.target.value))}
          />
          <output>{zoom.toFixed(2)}×</output>
          <button type="button" onClick={reset} disabled={!crop}>Reset</button>
        </div>

        <section className={styles.preview} aria-label={`${slotLabel} rendered preview`}>
          <h3>Rendered preview</h3>
          {signedPreview
            ? <img src={signedPreview} alt="" />
            : <p>{previewState === "error" ? "Preview unavailable. Your crop is still editable." : "Preparing preview…"}</p>}
          {previewState === "loading" && <p role="status">Updating preview…</p>}
        </section>

        <div className={styles.actions}>
          <button type="button" onClick={onCancel}>Cancel</button>
          <button type="button" disabled={!crop} onClick={() => { if (crop) onApply(crop); }}>
            Apply crop
          </button>
        </div>
      </DialogContent>
    </DialogRoot>
  );
}
