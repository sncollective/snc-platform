import type React from "react";

import type { RouteVoice } from "../../lib/route-voice/route-voice.js";

import styles from "./signature-chip.module.css";

const VOICE_CLASSES: Record<RouteVoice, string | undefined> = {
  parent: styles.parent,
  studio: styles.studio,
  tv: styles.tv,
  records: styles.records,
};

export interface SignatureChipProps {
  readonly voice: RouteVoice;
  readonly children: React.ReactNode;
}

/** Render a voice-owned signature mark using that voice's secondary accent. */
export function SignatureChip({
  voice,
  children,
}: SignatureChipProps): React.ReactElement {
  return <span className={`${styles.chip} ${VOICE_CLASSES[voice] ?? ""}`}>{children}</span>;
}
