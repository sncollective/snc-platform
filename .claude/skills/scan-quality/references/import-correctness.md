# Quality: Import Correctness

> Flag imports that resolve the wrong package — working client-side due to bundler optimization but breaking during SSR or in other environments.

## What to Flag

- **react-dom APIs imported from `react`**: `flushSync`, `createPortal`, `createRoot`, `hydrateRoot`, `render`, `unmountComponentAtNode`. These are DOM-specific and belong in `react-dom`. Vite's client-side optimizer silently resolves them, but SSR externalizes `react` as CJS where the named exports don't exist.

- **React hooks imported from `react-dom`**: `useState`, `useEffect`, `useRef`, `useMemo`, `useCallback`, `useReducer`, `useContext`, etc. These belong in `react`.

## Why This Matters

Vite (and most bundlers) pre-bundle dependencies for the client, converting CJS to ESM and resolving cross-package re-exports. This masks wrong-package imports — they work fine in the browser. But during SSR, Vite externalizes packages like `react` and `react-dom`, loading them as CJS via Node.js. CJS modules have limited named export detection, so `import { flushSync } from "react"` fails at runtime even though `react-dom` exports it.

These bugs are **latent** — they can exist for months until a code change triggers new SSR module loading paths. In this codebase, adding `head()` to TanStack Start child routes caused upload-context.tsx to load during SSR for the first time, exposing a `flushSync` import from `"react"` that had worked client-side since the file was created.

## From This Codebase

**Fixed (2026-03-28):** `apps/web/src/contexts/upload-context.tsx` imported `{ flushSync }` from `"react"` instead of `"react-dom"`. Worked client-side for months. Broke SSR when `head()` was added to child routes, causing the module to be loaded server-side.

## Detection

```
# Find react-dom APIs imported from react
grep -rn "flushSync\|createPortal\|createRoot\|hydrateRoot" apps/web/src/ | grep "from ['\"]react['\"]"
```

## Confidence

Wrong-package imports are **high** confidence → **Fix** lane. They are objectively incorrect and will break in any non-bundled environment (SSR, tests with different module resolution, edge runtimes).
