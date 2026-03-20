import type React from "react";

import formStyles from "../../styles/form.module.css";
import styles from "./time-picker-select.module.css";

// ── Public Types ──

export interface TimePickerSelectProps {
  /** Current value in HH:mm 24h format (e.g., "14:30") or empty string */
  readonly value: string;
  /** Called with HH:mm 24h format string when user changes time */
  readonly onChange: (value: string) => void;
  /** HTML id prefix for label association (produces {id}-hour, {id}-minute, {id}-period) */
  readonly id?: string;
}

// ── Private Constants ──

const HOURS_12 = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] as const;
const MINUTES = ["00", "15", "30", "45"] as const;

// ── Private Helpers ──

/** Parse HH:mm 24h string into 12h components. */
function parse24h(value: string): { hour12: number; minute: string; period: "AM" | "PM" } {
  if (!value) return { hour12: 12, minute: "00", period: "AM" };
  const [hStr, mStr] = value.split(":");
  const h24 = Number(hStr);
  const minute = mStr ?? "00";
  // Snap to nearest 15-minute increment
  const mNum = Number(minute);
  const snapped = String(Math.round(mNum / 15) * 15).padStart(2, "0");
  const snappedMinute = snapped === "60" ? "00" : snapped;

  const period: "AM" | "PM" = h24 >= 12 ? "PM" : "AM";
  const hour12 = h24 === 0 ? 12 : h24 > 12 ? h24 - 12 : h24;
  return { hour12, minute: snappedMinute, period };
}

/** Convert 12h components to HH:mm 24h string. */
function to24h(hour12: number, minute: string, period: "AM" | "PM"): string {
  let h24 = hour12;
  if (period === "AM" && hour12 === 12) h24 = 0;
  if (period === "PM" && hour12 !== 12) h24 = hour12 + 12;
  return `${String(h24).padStart(2, "0")}:${minute}`;
}

// ── Public API ──

export function TimePickerSelect({
  value,
  onChange,
  id,
}: TimePickerSelectProps): React.ReactElement {
  const { hour12, minute, period } = parse24h(value);

  const handleHourChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onChange(to24h(Number(e.target.value), minute, period));
  };

  const handleMinuteChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onChange(to24h(hour12, e.target.value, period));
  };

  const handlePeriodChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onChange(to24h(hour12, minute, e.target.value as "AM" | "PM"));
  };

  return (
    <div className={styles.container}>
      <select
        id={id ? `${id}-hour` : undefined}
        value={hour12}
        onChange={handleHourChange}
        className={formStyles.select}
        aria-label="Hour"
      >
        {HOURS_12.map((h) => (
          <option key={h} value={h}>{h}</option>
        ))}
      </select>
      <span className={styles.separator}>:</span>
      <select
        id={id ? `${id}-minute` : undefined}
        value={minute}
        onChange={handleMinuteChange}
        className={formStyles.select}
        aria-label="Minute"
      >
        {MINUTES.map((m) => (
          <option key={m} value={m}>{m}</option>
        ))}
      </select>
      <select
        id={id ? `${id}-period` : undefined}
        value={period}
        onChange={handlePeriodChange}
        className={formStyles.select}
        aria-label="AM or PM"
      >
        <option value="AM">AM</option>
        <option value="PM">PM</option>
      </select>
    </div>
  );
}
