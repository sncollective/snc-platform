#!/usr/bin/env node
// ── Static mockup capture (Playwright) ─────────────────────────────────────────
// Screenshots .mockups/ HTML files for vision-capable review (mockup-review skill).
// Replaces the old firefox-headless recipe — one screenshot mechanism repo-wide.
//
// Usage (from apps/e2e):
//   node scripts/capture-files.mjs --root ../../.mockups [--out /tmp/mockup-shots]
//   [--widths 1280] [--grep palette] [--theme dark]
// --root  : directory scanned recursively for *.html
// --grep  : substring filter on file paths (case-insensitive)
// --theme : light|dark colorScheme emulation (default dark — the mock corpus default)
// Output: <out>/<relative-path-mangled>-<width>.png + manifest.json

import { chromium } from "@playwright/test";
import { mkdirSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : fallback;
};

const ROOT = resolve(flag("root", "../../.mockups"));
const OUT = flag("out", "/tmp/mockup-shots");
const GREP = flag("grep", "").toLowerCase();
const WIDTHS = flag("widths", "1280").split(",").map(Number);
const THEME = flag("theme", "dark");

function findHtml(dir, acc = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) findHtml(full, acc);
    else if (entry.endsWith(".html")) acc.push(full);
  }
  return acc;
}

const files = findHtml(ROOT).filter((f) => !GREP || f.toLowerCase().includes(GREP));
if (files.length === 0) {
  console.error(`no .html files under ${ROOT}${GREP ? ` matching "${GREP}"` : ""}`);
  process.exit(1);
}

mkdirSync(OUT, { recursive: true });
const manifest = { root: ROOT, theme: THEME, captured: [], failed: [] };

const browser = await chromium.launch();
for (const width of WIDTHS) {
  const height = width < 700 ? 1400 : 1800;
  const ctx = await browser.newContext({ viewport: { width, height }, colorScheme: THEME });
  const page = await ctx.newPage();
  for (const file of files) {
    const rel = relative(ROOT, file).replaceAll(sep, "-").replace(/\.html$/, "");
    const name = `${rel}-${width}`;
    try {
      await page.goto(`file://${file}`, { waitUntil: "load", timeout: 30000 });
      await page.waitForTimeout(1200); // fonts/layout settle
      await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });
      manifest.captured.push(name);
      console.log(`ok ${name}`);
    } catch (e) {
      manifest.failed.push({ name, error: String(e).slice(0, 120) });
      console.log(`FAIL ${name}`);
    }
  }
  await ctx.close();
}
await browser.close();
writeFileSync(`${OUT}/manifest.json`, JSON.stringify(manifest, null, 2));
console.log(`\n${manifest.captured.length} captured, ${manifest.failed.length} failed -> ${OUT}`);
