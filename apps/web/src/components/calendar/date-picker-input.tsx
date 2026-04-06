import { useState } from "react";
import type React from "react";

import { DayPicker } from "react-day-picker";
import "react-day-picker/style.css";
import { format, parse } from "date-fns";

import { clsx } from "clsx/lite";

import { PopoverRoot, PopoverTrigger, PopoverContent } from "../ui/popover.js";
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

/** Text input that opens a popover day-picker and emits a YYYY-MM-DD string on selection. */
export function DatePickerInput({
  value,
  onChange,
  id,
  className,
  hasError,
}: DatePickerInputProps): React.ReactElement {
  const [open, setOpen] = useState(false);

  // Parse the string value to a Date for DayPicker's `selected` prop
  const selectedDate = value
    ? parse(value, "yyyy-MM-dd", new Date())
    : undefined;

  const handleSelect = (day: Date | undefined) => {
    if (day) {
      onChange(format(day, "yyyy-MM-dd"));
    }
    setOpen(false);
  };

  const displayValue = selectedDate
    ? format(selectedDate, "MMM d, yyyy")
    : "";

  return (
    <PopoverRoot open={open} onOpenChange={(details) => { setOpen(details.open); }}>
      <PopoverTrigger asChild>
        <input
          id={id}
          type="text"
          readOnly
          value={displayValue}
          placeholder="Select date"
          className={clsx(className ?? formStyles.input, hasError && formStyles.inputError)}
          role="combobox"
          aria-haspopup="dialog"
        />
      </PopoverTrigger>
      <PopoverContent
        role="dialog"
        aria-label="Date picker"
        className={styles.popover}
      >
        <DayPicker
          mode="single"
          selected={selectedDate}
          onSelect={handleSelect}
          {...(selectedDate !== undefined && { defaultMonth: selectedDate })}
        />
      </PopoverContent>
    </PopoverRoot>
  );
}
