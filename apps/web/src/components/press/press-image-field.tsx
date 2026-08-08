import { useId, useState } from "react";

import type {
  PressImage,
  PressImageSlotName,
} from "@snc/shared";

import { contentLibraryRawUrl } from "../../lib/press-images.js";
import { PressCropEditor } from "./press-crop-editor.js";
import { PressImagePicker } from "./press-image-picker.js";
import styles from "./press-image-field.module.css";

export interface PressImageFieldProps {
  readonly creatorId: string;
  readonly label: string;
  readonly slot: PressImageSlotName;
  readonly value: PressImage | null;
  readonly onChange: (image: PressImage | null) => void;
}

/** Controlled press-image reference field; persistence remains the owning form's job. */
export function PressImageField({
  creatorId,
  label,
  slot,
  value,
  onChange,
}: PressImageFieldProps): React.ReactElement {
  const altId = useId();
  const creditId = useId();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [cropOpen, setCropOpen] = useState(false);
  const [thumbnailFailed, setThumbnailFailed] = useState(false);

  if (pickerOpen) {
    return (
      <PressImagePicker
        creatorId={creatorId}
        slot={slot}
        onApply={(image) => {
          onChange(image);
          setThumbnailFailed(false);
          setPickerOpen(false);
        }}
        onCancel={() => setPickerOpen(false)}
      />
    );
  }

  if (cropOpen && value) {
    return (
      <PressCropEditor
        creatorId={creatorId}
        imageKey={value.key}
        sourceWidth={null}
        sourceHeight={null}
        slot={slot}
        slotLabel={label}
        {...(value.crop ? { initialCrop: value.crop } : {})}
        onApply={(crop) => {
          onChange({ ...value, crop });
          setCropOpen(false);
        }}
        onCancel={() => setCropOpen(false)}
      />
    );
  }

  return (
    <section className={styles.field} aria-labelledby={`${altId}-heading`}>
      <div className={styles.headingRow}>
        <h3 id={`${altId}-heading`}>{label}</h3>
        <button type="button" onClick={() => setPickerOpen(true)}>
          {value ? "Replace" : "Choose image"}
        </button>
      </div>

      {!value ? (
        <p className={styles.empty}>No image selected. This slot can remain empty.</p>
      ) : (
        <div className={styles.selected}>
          {thumbnailFailed ? (
            <div className={styles.thumbnailFallback}>Preview unavailable</div>
          ) : (
            <img
              src={contentLibraryRawUrl(value.key, creatorId)}
              alt={value.alt}
              onError={() => setThumbnailFailed(true)}
            />
          )}
          <div className={styles.metadata}>
            <label htmlFor={altId}>Alternative text <span aria-hidden="true">*</span></label>
            <textarea
              id={altId}
              required
              value={value.alt}
              onChange={(event) => onChange({ ...value, alt: event.target.value })}
            />
            <label htmlFor={creditId}>Photo credit (optional)</label>
            <input
              id={creditId}
              value={value.credit ?? ""}
              onChange={(event) => onChange({
                ...value,
                credit: event.target.value,
              })}
              onBlur={(event) => onChange({
                ...value,
                credit: event.target.value.trim() || null,
              })}
            />
            <div className={styles.actions}>
              <button type="button" onClick={() => setCropOpen(true)}>Edit crop</button>
              <button type="button" className={styles.remove} onClick={() => onChange(null)}>Remove</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
