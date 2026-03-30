import { useEffect, useRef } from "react";

// ── Private Constants ──

const ANNOUNCER_ID = "context-announcer";

// ── Public API ──

/** Announce context changes to screen readers via an aria-live region. */
export function useContextAnnouncer(contextLabel: string): void {
  const prevLabel = useRef(contextLabel);

  useEffect(() => {
    if (prevLabel.current === contextLabel) return;
    prevLabel.current = contextLabel;

    let announcer = document.getElementById(ANNOUNCER_ID);
    if (!announcer) {
      announcer = document.createElement("div");
      announcer.id = ANNOUNCER_ID;
      announcer.setAttribute("aria-live", "polite");
      announcer.setAttribute("aria-atomic", "true");
      announcer.className = "sr-only";
      document.body.appendChild(announcer);
    }

    announcer.textContent = `Now viewing: ${contextLabel}`;
  }, [contextLabel]);
}
