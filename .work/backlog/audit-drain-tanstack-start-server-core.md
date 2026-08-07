---
id: audit-drain-tanstack-start-server-core
created: 2026-08-06
tags: [security, dependencies, developer-experience]
---

# Drain @tanstack/start-server-core moderate (coordinated ecosystem upgrade)

`@tanstack/start-server-core <1.167.30` (GHSA-9m65-766c-r333, moderate — inbound
server-function request deserialization) ships transitively via
`@tanstack/react-start`.

**Why a quick drain failed (2026-08-06):** the `@tanstack/*` ecosystem is NOT
co-versioned — `react-router` ships 1.170.x while `react-start` tops out at
1.168.x, so there is no single version where the family converges. Two attempts
both crashed the web build (`createVirtualModule` → `.replaceAll` on undefined)
in a clean install, the same failure that blocked the 0.4.0 demo deploy:

1. A `resolutions` pin on `@tanstack/start-server-core` forced it to 1.169.22,
   desyncing it from `start-plugin-core` 1.167.34 / `start-client-core` 1.167.17.
2. Bumping `@tanstack/react-start` to 1.168.39 cleared `start-server-core`
   (→ 1.169.22) but split `react-router` (1.168.21 + 1.170.22) and
   `router-generator` (1.166.32 + 1.167.25).

**To drain properly:** a dedicated, coordinated `@tanstack/*` upgrade —
react-router + react-start + router-generator + the start-*/router-* transitives
aligned to one common safe version, verified with a clean-`node_modules` install
+ build. Revisit when `react-start` and `react-router` reconverge, or schedule
the upgrade as its own unit. Does not block the release gate (high+critical are
clear); this is moderate debt.

**Also pending (no fix available yet):** `@babel/core <=7.29.0` (low, dev-only —
GHSA-4x5r-pxfx-6jf8). Revisit when 7.30.0 ships.
