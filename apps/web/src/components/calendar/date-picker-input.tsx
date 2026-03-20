import { useState, useRef, useEffect } from "react";
import type React from "react";

import { DayPicker } from "react-day-picker";
import "react-day-picker/style.css";
import { format, parse } from "date-fns";

import formStyles from "../../styles/form.module.css";
import styles from "./date-picker-input.module.css";

// ── Public Types ──

export interface DatePickerInputProps {
  /** Current value in YYYY-MM-DD format (or empty string) */
  readonly value: string;
  /** Called with YYYY-MM-DD string when user selects a date */
  readonly onChange: (value: string) => void;
  /** HTML id for the trigger input (label association) */
  readonly id?: string;
  /** Additional className for the trigger input */
  readonly className?: string;
  /** Whether the input has a validation error */
  readonly hasError?: boolean;
}

// ── Public API ──

export function DatePickerInput({
  value,
  onChange,
  id,
  className,
  hasError,
}: DatePickerInputProps): React.ReactElement {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Parse the string value to a Date for DayPicker's `selected` prop
  const selectedDate = value
    ? parse(value, "yyyy-MM-dd", new Date())
    : undefined;

  const handleSelect = (day: Date | undefined) => {
    if (day) {
      onChange(format(day, "yyyy-MM-dd"));
    }
    setIsOpen(false);
  };

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsOpen(false);
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [isOpen]);

  const displayValue = selectedDate
    ? format(selectedDate, "MMM d, yyyy")
    : "";

  return (
    <div ref={containerRef} className={styles.container}>
      <input
        id={id}
        type="text"
        readOnly
        value={displayValue}
        placeholder="Select date"
        onClick={() => setIsOpen(!isOpen)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setIsOpen(!isOpen);
          }
        }}
        className={
          hasError
            ? `${className ?? formStyles.input} ${formStyles.inputError}`
            : className ?? formStyles.input
        }
        role="combobox"
        aria-expanded={isOpen}
        aria-haspopup="dialog"
      />
      {isOpen && (
        <div className={styles.popover} role="dialog" aria-label="Date picker">
          <DayPicker
            mode="single"
            selected={selectedDate}
            onSelect={handleSelect}
            defaultMonth={selectedDate}
          />
        </div>
      )}
    </div>
  );
}
