#!/usr/bin/env node
// @noheader
//
// Drift check: assert Node's bundled undici major matches the undici major the
// web SSR worker (Nitro's node-runner.mjs) resolves. A mismatch resurfaces the
// dev-ssr-fetch-failed bug: undici 7↔8 changed the Dispatcher Interceptor
// onRequestStart contract, so every SSR fetch dispatched across the boundary
// throws InvalidArgumentError "invalid onRequestStart method", which Vite
// flattens to a generic "fetch failed" (500 on every SSR'd route).
//
// Wired into scripts/dev/start-dev.sh so a container rebuild that bumps Node
// (and thus the bundled undici) fails LOUD here instead of silently serving
// 500s. The Node↔undici compatibility line is major-based, so we compare majors.
//
// Background + the full root-cause write-up:
//   .work/active/stories/dev-ssr-fetch-failed.md

import { createRequire } from "node:module";

const OK = (msg) => console.log(`[undici-alignment] ${msg}`);
const SKIP = (msg) => console.warn(`[undici-alignment] skip: ${msg}`);
const FAIL = (msg) => {
  console.error(`[undici-alignment] ${msg}`);
  process.exit(1);
};

const bundled = process.versions.undici; // e.g. "7.29.0"
if (!bundled) FAIL("could not read process.versions.undici — unexpected Node build");
const bundledMajor = Number(bundled.split(".")[0]);

// Resolve undici the same way Nitro's SSR worker does: from nitro's package
// context, reached via the web app. import.meta.url keeps this cwd-independent.
const webPackage = new URL("../../apps/web/package.json", import.meta.url);
const webRequire = createRequire(webPackage);

let nitroPkg;
try {
  nitroPkg = webRequire.resolve("nitro/package.json");
} catch {
  SKIP("could not resolve 'nitro' from apps/web — workspace not installed yet (run bun install).");
  process.exit(0);
}

let installed;
try {
  installed = createRequire(nitroPkg)("undici/package.json").version;
} catch {
  SKIP("could not resolve 'undici' from nitro — workspace not installed yet (run bun install).");
  process.exit(0);
}
const installedMajor = Number(installed.split(".")[0]);

if (bundledMajor !== installedMajor) {
  FAIL(
    `DRIFT — Node bundles undici ${bundled} (major ${bundledMajor}) but the web SSR ` +
      `worker resolves undici ${installed} (major ${installedMajor}).\n\n` +
      `Dev SSR is broken by this (every route 500s with "fetch failed"). Fix:\n` +
      `  1. In package.json set resolutions."undici" to "^${bundledMajor}.0.0" ` +
      `(the major Node bundles).\n` +
      `  2. bun install --force\n` +
      `  3. Restart dev servers.\n\n` +
      `See .work/active/stories/dev-ssr-fetch-failed.md.`,
  );
}

OK(`Node bundled undici ${bundled} matches Nitro-resolved ${installed} (major ${bundledMajor}).`);
