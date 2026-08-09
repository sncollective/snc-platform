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
import styles from "./media-picker.module.css";

export interface MediaPickerCropProps {
  readonly assetId: string;
  readonly creatorId: string;
  readonly imageKey: string;
  readonly sourceWidth: number | null;
  readonly sourceHeight: number | null;
  readonly slot: PressImageSlotName;
  readonly slotLabel: string;
  readonly outputWidth: number;
  readonly outputHeight: number;
  readonly initialCrop?: PressImageCrop;
  readonly onCropChange: (assetId: string, crop: PressImageCrop | null) => void;
  readonly onReadyChange: (assetId: string, ready: boolean) => void;
  readonly announce: (message: string) => void;
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

/** Edit and server-verify a slot-aware crop for the currently selected library asset. */
export function MediaPickerCrop({
  assetId,
  creatorId,
  imageKey,
  sourceWidth,
  sourceHeight,
  slot,
  slotLabel,
  outputWidth,
  outputHeight,
  initialCrop,
  onCropChange,
  onReadyChange,
  announce,
}: MediaPickerCropProps): React.ReactElement {
  const [source, setSource] = useState<CropSourceSize | null>(() =>
    suppliedSource(sourceWidth, sourceHeight));
  const [center, setCenter] = useState<CropCenter>({ x: 0.5, y: 0.5 });
  const [zoom, setZoom] = useState(1);
  const [preview, setPreview] = useState<{ key: string; src: string } | null>(null);
  const [previewState, setPreviewState] = useState<"loading" | "ready" | "error">("loading");
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
    () => source ? cropFromViewport({ source, slot, center, zoom }) : null,
    [center, slot, source, zoom],
  );
  const previewWidth = outputWidth;
  const previewKey = crop
    ? `${assetId}:${slot}:${previewWidth}:${crop.x}:${crop.y}:${crop.width}:${crop.height}`
    : null;
  const currentPreview = previewKey && preview?.key === previewKey ? preview.src : null;

  useEffect(() => {
    onCropChange(assetId, crop);
  }, [assetId, crop, onCropChange]);

  useEffect(() => {
    if (!crop || !previewKey) {
      onReadyChange(assetId, false);
      return;
    }
    const requestId = ++previewRequest.current;
    const controller = new AbortController();
    onReadyChange(assetId, false);
    setPreview(null);
    setPreviewState("loading");
    const timer = window.setTimeout(() => {
      void requestPressImagePreview({
        creatorId,
        key: imageKey,
        crop,
        slot,
        width: previewWidth,
        signal: controller.signal,
      })
        .then((descriptor) => {
          if (requestId !== previewRequest.current) return;
          setPreview({ key: previewKey, src: descriptor.src });
          setPreviewState("ready");
          onReadyChange(assetId, true);
          announce("Rendered crop preview ready for the current image.");
        })
        .catch(() => {
          if (controller.signal.aborted || requestId !== previewRequest.current) return;
          setPreview(null);
          setPreviewState("error");
          onReadyChange(assetId, false);
        });
    }, 250);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [
    announce,
    assetId,
    creatorId,
    crop,
    imageKey,
    onReadyChange,
    previewKey,
    previewWidth,
    slot,
  ]);

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
    announce("Crop reset to centered.");
  };

  const onViewportKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (!crop) return;
    const stepX = crop.width * (event.shiftKey ? 0.1 : 0.02);
    const stepY = crop.height * (event.shiftKey ? 0.1 : 0.02);
    const actions: Partial<Record<string, () => void>> = {
      ArrowLeft: () => updateCenter({ x: center.x - stepX, y: center.y }),
      ArrowRight: () => updateCenter({ x: center.x + stepX, y: center.y }),
      ArrowUp: () => updateCenter({ x: center.x, y: center.y - stepY }),
      ArrowDown: () => updateCenter({ x: center.x, y: center.y + stepY }),
      "+": () => updateZoom(zoom + 0.1),
      "=": () => updateZoom(zoom + 0.1),
      "-": () => updateZoom(zoom - 0.1),
    };
    const action = actions[event.key];
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
    const bounds = event.currentTarget.getBoundingClientRect();
    if (bounds.width <= 0 || bounds.height <= 0) return;
    updateCenter({
      x: dragStart.current.center.x
        - (event.clientX - dragStart.current.x) * crop.width / bounds.width,
      y: dragStart.current.center.y
        - (event.clientY - dragStart.current.y) * crop.height / bounds.height,
    });
  };

  const finishDrag = (): void => {
    dragStart.current = null;
  };

  const ratio = PRESS_IMAGE_SLOT_RATIOS[slot];
  return (
    <section className={styles.cropSection} aria-label={`${slotLabel} crop`}>
      <div className={styles.sectionLabel}>
        <span>Crop source for this slot</span>
        <b>{slotLabel} · {ratio.replace("/", ":")}</b>
      </div>
      <div
        className={styles.cropViewport}
        style={{ aspectRatio: ratio.replace("/", " / ") }}
        role="application"
        aria-label={`${slotLabel} crop viewport. Drag to pan, use arrow keys to nudge, plus and minus to zoom.`}
        tabIndex={0}
        onKeyDown={onViewportKeyDown}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={finishDrag}
        onPointerCancel={finishDrag}
      >
        <img
          className={crop ? styles.cropSourceImage : styles.uncroppedImage}
          style={cropStyle(crop)}
          src={contentLibraryRawUrl(imageKey, creatorId)}
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
        <span className={styles.cropGrid} aria-hidden="true" />
      </div>
      <p className={styles.cropInstructions}>
        Drag to pan. Arrow keys nudge; hold Shift for a larger nudge. Use +/− or the controls to zoom.
      </p>
      <div className={styles.cropControls}>
        <button type="button" aria-label="Zoom out" disabled={!crop} onClick={() => updateZoom(zoom - 0.1)}>−</button>
        <input
          type="range"
          min="1"
          max="8"
          step="0.01"
          value={zoom}
          disabled={!crop}
          aria-label="Crop zoom"
          onChange={(event) => updateZoom(Number(event.target.value))}
        />
        <button type="button" aria-label="Zoom in" disabled={!crop} onClick={() => updateZoom(zoom + 0.1)}>＋</button>
        <button type="button" className={styles.resetCrop} disabled={!crop} onClick={reset}>Reset</button>
      </div>
      <output className={styles.zoomOutput}>{zoom.toFixed(2)}× · {zoom === 1 && center.x === 0.5 && center.y === 0.5 ? "centered" : "custom position"}</output>
      <div className={styles.renderedWrap}>
        <div className={styles.sectionLabel}>
          <span>Rendered output preview</span>
          <b>{outputWidth} × {outputHeight}</b>
        </div>
        <div
          className={styles.renderedPreview}
          style={{ aspectRatio: ratio.replace("/", " / ") }}
          aria-label={`${slotLabel} rendered output preview`}
        >
          {currentPreview ? <img src={currentPreview} alt="" /> : null}
          {!currentPreview ? (
            <span className={styles.previewLoading} role="status">
              {previewState === "error" ? "Preview unavailable. Adjust the crop or try again." : "Preparing current crop…"}
            </span>
          ) : null}
        </div>
      </div>
    </section>
  );
}
