import type React from "react";
import type { CreatorProfileResponse } from "@snc/shared";

import formStyles from "../../styles/form.module.css";

// ── Public Types ──

export interface CreatorSelectorProps {
  readonly creators: readonly CreatorProfileResponse[];
  readonly selectedId: string;
  readonly onChange: (id: string) => void;
}

// ── Public API ──

/** Dropdown for switching between creator profiles. Renders nothing when the user has only one creator page. */
export function CreatorSelector({
  creators,
  selectedId,
  onChange,
}: CreatorSelectorProps): React.ReactElement | null {
  if (creators.length <= 1) return null;

  return (
    <select
      value={selectedId}
      onChange={(e) => onChange(e.target.value)}
      className={formStyles.select}
      aria-label="Select creator page"
    >
      {creators.map((c) => (
        <option key={c.id} value={c.id}>
          {c.displayName}
        </option>
      ))}
    </select>
  );
}
