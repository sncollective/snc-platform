import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { CREATOR_BRAND_COLORS } from "@snc/shared";
import { describe, expect, it } from "vitest";

const TOKENS_DIR = resolve(import.meta.dirname, "../../../src/styles/tokens");

interface Rgba {
  readonly red: number;
  readonly green: number;
  readonly blue: number;
  readonly alpha: number;
}

type Mode = "light" | "dark";

function readTokenFile(file: string): string {
  return readFileSync(resolve(TOKENS_DIR, file), "utf-8");
}

function modeDeclarations(file: string, mode: Mode): Map<string, string> {
  const content = readTokenFile(file);
  const pattern =
    mode === "light"
      ? /:root\s*,\s*\[data-theme=["']light["']\]\s*\{([^}]*)\}/
      : /\[data-theme=["']dark["']\]\s*\{([^}]*)\}/;
  const block = content.match(pattern)?.[1];
  expect(block, `${file} should define ${mode} tokens`).toBeDefined();

  return new Map(
    [...(block ?? "").matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)].map((match) => [
      match[1] as string,
      (match[2] as string).trim(),
    ]),
  );
}

function rootDeclarations(file: string): Map<string, string> {
  const block = readTokenFile(file).match(/:root\s*\{([^}]*)\}/)?.[1];
  expect(block, `${file} should define root tokens`).toBeDefined();

  return new Map(
    [...(block ?? "").matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)].map((match) => [
      match[1] as string,
      (match[2] as string).trim(),
    ]),
  );
}

function tokensForMode(mode: Mode): Map<string, string> {
  return new Map([
    ...modeDeclarations("color/spine.css", mode),
    ...modeDeclarations("color/status.css", mode),
    ...modeDeclarations("color/state.css", mode),
    ...modeDeclarations("color/media.css", mode),
    ...modeDeclarations("color/badges.css", mode),
    ...rootDeclarations("color/badges.css"),
    ...modeDeclarations("color/data.css", mode),
    ...modeDeclarations("voices/families.css", mode),
  ]);
}

function parseColor(value: string): Rgba {
  const hex = value.match(/^#([\da-f]{6})$/i)?.[1];
  if (hex !== undefined) {
    return {
      red: Number.parseInt(hex.slice(0, 2), 16),
      green: Number.parseInt(hex.slice(2, 4), 16),
      blue: Number.parseInt(hex.slice(4, 6), 16),
      alpha: 1,
    };
  }

  const rgba = value.match(
    /^rgba?\(\s*(\d+)\s*[, ]\s*(\d+)\s*[, ]\s*(\d+)\s*(?:[,/]\s*([\d.]+))?\s*\)$/i,
  );
  if (rgba !== null) {
    return {
      red: Number(rgba[1]),
      green: Number(rgba[2]),
      blue: Number(rgba[3]),
      alpha: rgba[4] === undefined ? 1 : Number(rgba[4]),
    };
  }

  throw new Error(`Unsupported test color syntax: ${value}`);
}

function composite(foreground: Rgba, background: Rgba): Rgba {
  const alpha = foreground.alpha + background.alpha * (1 - foreground.alpha);
  const channel = (foregroundChannel: number, backgroundChannel: number) =>
    (foregroundChannel * foreground.alpha +
      backgroundChannel * background.alpha * (1 - foreground.alpha)) /
    alpha;

  return {
    red: channel(foreground.red, background.red),
    green: channel(foreground.green, background.green),
    blue: channel(foreground.blue, background.blue),
    alpha,
  };
}

function luminance(color: Rgba): number {
  const linearize = (channel: number) => {
    const normalized = channel / 255;
    return normalized <= 0.04045
      ? normalized / 12.92
      : ((normalized + 0.055) / 1.055) ** 2.4;
  };

  return (
    0.2126 * linearize(color.red) +
    0.7152 * linearize(color.green) +
    0.0722 * linearize(color.blue)
  );
}

function contrast(foreground: Rgba, background: Rgba): number {
  const foregroundLuminance = luminance(foreground);
  const backgroundLuminance = luminance(background);
  return (
    (Math.max(foregroundLuminance, backgroundLuminance) + 0.05) /
    (Math.min(foregroundLuminance, backgroundLuminance) + 0.05)
  );
}

function color(tokens: Map<string, string>, name: string): Rgba {
  const value = tokens.get(name);
  expect(value, `${name} should be declared`).toBeDefined();

  const alias = value?.match(/^var\((--[\w-]+)\)$/);
  if (alias !== undefined && alias !== null) {
    return color(tokens, alias[1] as string);
  }

  const tint = value?.match(
    /^color-mix\(in srgb, var\((--[\w-]+)\) (\d+(?:\.\d+)?)%, transparent\)$/,
  );
  if (tint !== undefined && tint !== null) {
    const base = color(tokens, tint[1] as string);
    return { ...base, alpha: Number(tint[2]) / 100 };
  }

  return parseColor(value ?? "");
}

const MODES: readonly Mode[] = ["light", "dark"];
const HOST_SURFACES = ["--color-bg", "--color-bg-elevated"] as const;
const STATUS_NAMES = ["success", "warning", "error", "info"] as const;
const BADGE_NAMES = ["audio", "video", "written"] as const;
const VOICE_NAMES = ["parent", "studio", "tv", "records"] as const;

describe("brand token contrast matrix", () => {
  it.each(MODES)("keeps %s base foregrounds AA-safe on background and elevated", (mode) => {
    const tokens = tokensForMode(mode);

    for (const hostName of HOST_SURFACES) {
      const host = color(tokens, hostName);
      expect(contrast(color(tokens, "--color-text"), host), `text on ${hostName}`).toBeGreaterThanOrEqual(4.5);
      expect(
        contrast(color(tokens, "--color-text-muted"), host),
        `muted text on ${hostName}`,
      ).toBeGreaterThanOrEqual(4.5);
    }
  });

  it.each(MODES)("keeps %s hover and selected tint composites AA-safe on both hosts", (mode) => {
    const tokens = tokensForMode(mode);

    for (const hostName of HOST_SURFACES) {
      const host = color(tokens, hostName);
      for (const tintName of ["--color-hover-bg", "--color-selected-bg"] as const) {
        const compositeBackground = composite(color(tokens, tintName), host);
        expect(
          contrast(color(tokens, "--color-text"), compositeBackground),
          `text on ${tintName} over ${hostName}`,
        ).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it.each(MODES)("computes %s disabled foregrounds on both hosts and the paired fill", (mode) => {
    const tokens = tokensForMode(mode);
    const disabled = color(tokens, "--color-disabled");

    // Inactive controls are exempt from WCAG 1.4.3; retain a modest visibility floor so a
    // placeholder value cannot accidentally collapse to an indistinguishable pair.
    for (const backgroundName of [...HOST_SURFACES, "--color-disabled-bg"] as const) {
      expect(
        contrast(disabled, color(tokens, backgroundName)),
        `disabled on ${backgroundName}`,
      ).toBeGreaterThanOrEqual(1.5);
    }
  });

  it.each(MODES)("keeps %s opaque status pairs AA-safe over both hosts and hover", (mode) => {
    const tokens = tokensForMode(mode);

    for (const hostName of HOST_SURFACES) {
      const host = color(tokens, hostName);
      for (const status of STATUS_NAMES) {
        const foreground = color(tokens, `--color-${status}`);
        const background = color(tokens, `--color-${status}-bg`);
        const hostedBackground = composite(background, host);
        const hoveredHost = composite(color(tokens, "--color-hover-bg"), host);
        const hoveredBackground = composite(background, hoveredHost);

        expect(background.alpha, `${status} background must be host-independent`).toBe(1);
        expect(
          contrast(foreground, hostedBackground),
          `${status} on ${hostName}`,
        ).toBeGreaterThanOrEqual(4.5);
        expect(
          contrast(foreground, hoveredBackground),
          `${status} hover on ${hostName}`,
        ).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it.each(MODES)("keeps %s text-bearing badge tints AA-safe over both hosts and hover", (mode) => {
    const tokens = tokensForMode(mode);
    const foreground = color(tokens, "--color-text");

    for (const hostName of HOST_SURFACES) {
      const host = color(tokens, hostName);
      for (const badge of BADGE_NAMES) {
        const tint = color(tokens, `--color-badge-${badge}-tint`);
        const tintedBackground = composite(tint, host);
        const hoveredHost = composite(color(tokens, "--color-hover-bg"), host);
        const hoveredBackground = composite(tint, hoveredHost);

        expect(
          contrast(foreground, tintedBackground),
          `${badge} tint on ${hostName}`,
        ).toBeGreaterThanOrEqual(4.5);
        expect(
          contrast(foreground, hoveredBackground),
          `${badge} tint hover on ${hostName}`,
        ).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it.each(MODES)("keeps every %s voice's actual identity consumer pairs safe", (mode) => {
    const tokens = tokensForMode(mode);
    const selected = color(tokens, "--color-selected-bg");

    for (const voice of VOICE_NAMES) {
      const foreground = color(tokens, `--voice-${voice}-on-accent`);
      for (const role of ["accent", "accent-hover"] as const) {
        const background = color(tokens, `--voice-${voice}-${role}`);
        expect(
          contrast(foreground, background),
          `${voice} on-accent on ${role}`,
        ).toBeGreaterThanOrEqual(4.5);
      }

      const accent = color(tokens, `--voice-${voice}-accent`);
      for (const hostName of HOST_SURFACES) {
        const host = color(tokens, hostName);
        expect(contrast(accent, host), `${voice} accent on ${hostName}`).toBeGreaterThanOrEqual(4.5);

        const selectedBackground = composite(selected, host);
        expect(
          contrast(accent, selectedBackground),
          `${voice} accent on selected over ${hostName}`,
        ).toBeGreaterThanOrEqual(3);

        const subtle = composite(color(tokens, `--voice-${voice}-accent-subtle`), host);
        expect(
          contrast(accent, subtle),
          `${voice} accent on subtle over ${hostName}`,
        ).toBeGreaterThanOrEqual(3);
      }
    }
  });

  it.each(MODES)("keeps %s fixed-media foreground roles safe over media black", (mode) => {
    const tokens = tokensForMode(mode);
    const mediaBackground = color(tokens, "--color-media-bg");

    expect(contrast(color(tokens, "--color-on-media"), mediaBackground)).toBeGreaterThanOrEqual(4.5);
    expect(
      contrast(composite(color(tokens, "--color-on-media-muted"), mediaBackground), mediaBackground),
    ).toBeGreaterThanOrEqual(4.5);
    expect(color(tokens, "--color-media-border").alpha).toBe(0.15);
  });

  it.each(MODES)("keeps %s creator-brand presets and route fallback paired", (mode) => {
    const tokens = tokensForMode(mode);
    const creator = new Map([
      ...tokens,
      ...rootDeclarations("color/creator.css"),
      ...modeDeclarations("color/creator.css", mode),
    ]);
    const curatedInk = color(creator, "--color-on-curated-creator-brand");

    for (const preset of CREATOR_BRAND_COLORS) {
      expect(contrast(curatedInk, parseColor(preset)), `curated creator preset ${preset}`).toBeGreaterThanOrEqual(
        4.5,
      );
    }

    expect(creator.get("--creator-brand")).toBe("var(--color-accent)");
    expect(creator.get("--color-on-creator-brand")).toBe("var(--color-on-accent)");
    for (const voice of VOICE_NAMES) {
      expect(
        contrast(
          color(tokens, `--voice-${voice}-on-accent`),
          color(tokens, `--voice-${voice}-accent`),
        ),
        `${voice} creator fallback`,
      ).toBeGreaterThanOrEqual(4.5);
    }
  });

  it.each(MODES)("keeps every %s public chart series distinguishable from chart hosts", (mode) => {
    const tokens = tokensForMode(mode);

    for (let series = 1; series <= 6; series += 1) {
      const seriesColor = color(tokens, `--color-chart-${series}`);
      for (const hostName of [...HOST_SURFACES, "--color-chart-tooltip-bg"] as const) {
        expect(
          contrast(seriesColor, color(tokens, hostName)),
          `chart ${series} on ${hostName}`,
        ).toBeGreaterThanOrEqual(3);
      }
    }

    expect(
      contrast(
        color(tokens, "--color-chart-tooltip-text"),
        color(tokens, "--color-chart-tooltip-bg"),
      ),
      "chart tooltip text",
    ).toBeGreaterThanOrEqual(4.5);
  });

  it("keeps fixed output preview roles invariant across UI modes", () => {
    const preview = rootDeclarations("color/preview.css");
    const content = readTokenFile("color/preview.css");

    expect(content).not.toMatch(/data-theme|prefers-color-scheme/);
    expect(Object.fromEntries(preview)).toEqual({
      "--preview-light-paper": "#F6F0E7",
      "--preview-light-ink": "#1A1A2E",
      "--preview-dark-paper": "#171725",
      "--preview-dark-ink": "#DDD8CE",
    });
    for (const mode of MODES) {
      expect(Object.fromEntries(rootDeclarations("color/preview.css")), mode).toEqual(
        Object.fromEntries(preview),
      );
    }
  });
});
