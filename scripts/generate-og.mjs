#!/usr/bin/env node

import { createRequire } from "node:module";
import { readFile, mkdir } from "node:fs/promises";
import { resolve } from "node:path";

const projectRoot = resolve(import.meta.dirname, "..");
const outputDir = resolve(projectRoot, "apps/web/public/og");
const requireE2e = createRequire(resolve(projectRoot, "apps/e2e/package.json"));
const requireWeb = createRequire(resolve(projectRoot, "apps/web/package.json"));
const { chromium } = requireE2e("@playwright/test");

const [mark, displayFont] = await Promise.all([
  readFile(resolve(projectRoot, "apps/web/public/logo-mark.svg"), "utf8"),
  readFile(requireWeb.resolve("@fontsource-variable/fraunces/files/fraunces-latin-wght-normal.woff2")),
]);

const variants = [
  { file: "default.png", name: "S/NC", accent: "#F5A623" },
  { file: "press.png", name: "S/NC RECORDS", accent: "#FF6B5E" },
  { file: "live.png", name: "S/NC TV", accent: "#4FE0D8" },
];

const dataUrl = (buffer) => `data:font/woff2;base64,${buffer.toString("base64")}`;
const html = ({ name, accent }) => `<!doctype html>
<html>
<head>
  <style>
    @font-face { font-family: Fraunces; src: url("${dataUrl(displayFont)}"); font-weight: 100 900; }
    * { box-sizing: border-box; }
    html, body { margin: 0; width: 1200px; height: 630px; overflow: hidden; }
    body { background: #171929; }
    .card {
      display: grid;
      grid-template-columns: 338px 1fr;
      width: 1200px;
      height: 630px;
      overflow: hidden;
      background: #171929;
      color: #EFE9D8;
    }
    .spine {
      position: relative;
      display: grid;
      place-items: center;
      border-right: 1px solid rgba(239, 233, 216, .2);
      background: color-mix(in srgb, ${accent} 7%, #171929);
    }
    .spine::before {
      position: absolute;
      inset: 0 auto 0 0;
      width: 16px;
      background: ${accent};
      content: "";
    }
    .mark { width: 236px; height: 236px; padding: 12px; color: #EFE9D8; }
    .mark svg { width: 100%; height: 100%; fill: currentColor; }
    .content {
      display: flex;
      align-items: flex-start;
      justify-content: center;
      padding: 64px 78px;
    }
    h1 {
      margin: 0;
      color: #EFE9D8;
      font: 650 94px/.92 Fraunces, Georgia, serif;
      letter-spacing: -.045em;
      text-wrap: balance;
    }
    h1::after {
      display: block;
      width: 112px;
      height: 8px;
      margin-top: 36px;
      background: ${accent};
      content: "";
    }
  </style>
</head>
<body>
  <main class="card">
    <aside class="spine"><div class="mark">${mark}</div></aside>
    <section class="content"><h1>${name}</h1></section>
  </main>
</body>
</html>`;

await mkdir(outputDir, { recursive: true });
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
  for (const variant of variants) {
    await page.setContent(html(variant), { waitUntil: "load" });
    await page.evaluate(() => document.fonts.ready);
    await page.locator(".card").screenshot({ path: resolve(outputDir, variant.file) });
    console.log(`generated apps/web/public/og/${variant.file}`);
  }
} finally {
  await browser.close();
}
