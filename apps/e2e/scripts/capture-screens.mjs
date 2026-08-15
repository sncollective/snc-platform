#!/usr/bin/env node
// ── Public screen capture harness ──────────────────────────────────────────────
// Captures the public routes of the dev web app for vision-capable review.
// Usage (from apps/e2e, where playwright is installed):
//   node ../../scripts/capture-screens.mjs [--out /tmp/screens] [--base http://localhost:3001]
//   [--routes /,/feed,...] [--modes dark,light] [--widths 1280,390]
// Output: <out>/<route-slug>-<mode>-<width>.png + <out>/manifest.json
//
// The route list mirrors the public-surface inventory in
// .work/active/features/visual-identity-exploration.md — keep them in sync.

import { chromium } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : fallback;
};

const BASE = flag("base", "http://localhost:3001");
const OUT = flag("out", "/tmp/screens");
const ROUTES = flag("routes",
  [
    "/", "/feed", "/live", "/studio", "/creators", "/creators/maya-chen",
    "/creators/animalfuture/press", "/merch", "/pricing", "/governance/calendar",
    "/login", "/register",
  ].join(",")).split(",");
const MODES = flag("modes", "dark,light").split(",");
const WIDTHS = flag("widths", "1280,390").split(",").map(Number);

const slug = (route) => route === "/" ? "home" : route.replaceAll("/", "-").replace(/^-|-$/g, "");

mkdirSync(OUT, { recursive: true });
const manifest = { base: BASE, captured: [], failed: [] };

const browser = await chromium.launch();
for (const mode of MODES) {
  for (const width of WIDTHS) {
    const height = width < 700 ? 1400 : 900;
    const ctx = await browser.newContext({
      viewport: { width, height },
      colorScheme: mode,
      deviceScaleFactor: 1,
    });
    const page = await ctx.newPage();
    for (const route of ROUTES) {
      const name = `${slug(route)}-${mode}-${width}`;
      try {
        // "load" (not "networkidle"): /live holds persistent connections.
        await page.goto(`${BASE}${route}`, { waitUntil: "load", timeout: 45000 });
        await page.waitForTimeout(3000);
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
}
await browser.close();
writeFileSync(`${OUT}/manifest.json`, JSON.stringify(manifest, null, 2));
console.log(`\n${manifest.captured.length} captured, ${manifest.failed.length} failed -> ${OUT}`);
