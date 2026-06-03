---
tags: [streaming, community, ux-polish]
release_binding: null
created: 2026-04-21
updated: 2026-04-21
---

# "Reconnecting..." persists 30-40s on /live in dev (Vite module waterfall)

Observed during `feature-message-reactions` acceptance review (2026-04-21). Navigating into `/live`, the chat panel shows "Reconnecting..." for 30-40s before messages appear. Feels broken; we chased it as a potential release blocker.

## Diagnosis 2026-04-21 (dev-only, not prod-blocking)

Root cause: **Vite dev-mode module waterfall**, not chat or WS issue.

Network trace:
- Initial HTML document — 173ms ✓
- ~200+ JS module requests (Vite serves individual modules in dev rather than bundling) — this is where the 30-40s goes
- Vite HMR WebSocket hangs for the same 30-40s (Vite is busy serving modules; can't accept HMR) — visible as `ws://localhost:3001/?token=...` in Network
- Chat WebSocket (`ws://localhost:3080/ws`, `/api/chat/ws` from `chat-context.tsx:182`) connects in 73-139ms *once it gets a chance to open* — i.e., after React hydrates
- Two chat WS rows = React Strict Mode double-mount on hydration (dev-only)

SSR loader + API endpoints ruled out. `/api/streaming/status` is the only call in the `/live` loader and its internals (SRS, Liquidsoap, Postgres) all have bounded timeouts (2s / 3s / fast). Worst-case SSR is ~3s. The 30-40s is entirely client-side JS-loading waterfall.

**Why it's not a prod issue:** production builds bundle modules into a handful of chunks loaded in parallel. Time-to-hydrate drops from 30-40s to sub-second. No change in client behaviour between dev and prod; the waterfall only exists in dev.

**Why `release_binding` dropped:** prod users never experience this. Binding was set speculatively at park time when we thought it might be a server or chat-side bottleneck — ruled out on diagnosis.

## What's left (dev-env performance, not release-blocking)

Worth revisiting if dev ergonomics become painful enough:

- **Dependency pre-bundling** — Vite normally pre-bundles `node_modules` via esbuild. If `optimizeDeps.include` isn't capturing everything `/live` pulls, some deps get served as individual files. Audit `vite.config.ts` + run Vite with `--force` once to rebuild the pre-bundle cache.
- **Route code-split** — is `/live` pulling in more than it needs? If the route imports player + chat + reactions + user cards + mod UI + playout + video codec libs synchronously, that's a lot to walk through on every refresh.
- **Dev-only lazy chat-context** — chat doesn't need to hydrate immediately; could defer `ChatProvider` mount via `React.lazy` so the player and video load first, chat arrives in a second wave.
- **Skip SSR for /live in dev** — TanStack Start supports per-route SSR config. If SSR'd "Reconnecting..." is more confusing than useful in dev, render `null` or a neutral loading state until hydration.
- **Pre-warm Vite on container start** — the dev container init script could hit `/live` once right after starting web, so modules are pre-loaded before the user opens a browser tab.

## Revisit if

- Dev iteration becomes slow enough to block work → prioritize Vite pre-bundling audit first (highest leverage).
- Observed in a prod build → re-open as a real issue, re-instrument server-side.
- User-education concern: if first-time contributors see "Reconnecting..." and think the chat feature is broken, consider a dev-only "Dev server warming up…" label behind `import.meta.env.DEV`.
