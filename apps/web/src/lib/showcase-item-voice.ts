import type { CSSProperties } from "react";

export type ShowcaseItemVoice = "parent" | "studio" | "tv" | "records";

export type ItemUnitStyle = CSSProperties & {
  readonly "--item-unit-accent": string;
};

const CONTENT_VOICES: Readonly<Record<string, ShowcaseItemVoice>> = {
  audio: "records",
  video: "tv",
  podcast: "studio",
  "studio-audio": "studio",
  written: "parent",
  none: "parent",
};

const EVENT_VOICES: Readonly<Record<string, ShowcaseItemVoice>> = {
  show: "tv",
  "recording-session": "studio",
};

const UNIT_STYLES: Readonly<Record<Exclude<ShowcaseItemVoice, "parent">, ItemUnitStyle>> = {
  studio: {
    "--item-unit-accent": "var(--voice-studio-accent)",
  },
  tv: {
    "--item-unit-accent": "var(--voice-tv-accent)",
  },
  records: {
    "--item-unit-accent": "var(--voice-records-accent)",
  },
};

export function resolveContentItemVoice(contentType: string | null | undefined): ShowcaseItemVoice {
  if (contentType === null || contentType === undefined) return "parent";
  return CONTENT_VOICES[contentType] ?? "parent";
}

export function resolveEventItemVoice(eventType: string | null | undefined): ShowcaseItemVoice {
  if (eventType === null || eventType === undefined) return "parent";
  return EVENT_VOICES[eventType] ?? "parent";
}

export function itemUnitStyle(voice: ShowcaseItemVoice): ItemUnitStyle | undefined {
  return voice === "parent" ? undefined : UNIT_STYLES[voice];
}
