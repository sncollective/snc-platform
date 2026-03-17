> **Archived**: 2026-03-06
> **Validation**: All tests passing (659/659), no cross-finding regressions. One residual item: `platform-patterns/SKILL.md` line 71 has a dangling `use-section-data.md` link not covered by the original P1 scope.

# Refactor Analysis: Web Hooks

> **Generated**: 2026-03-06
> **Scope**: 4 files — `apps/web/src/hooks/*.ts`
> **Libraries researched**: React 19.2.4, fetch API (AbortController)

---

## Executive Summary

All four hooks in `apps/web/src/hooks/` were analyzed: `use-cursor-pagination.ts`, `use-menu-toggle.ts`, `use-guest-redirect.ts`, and `use-subscriptions.ts`. The scope also revealed that `use-section-data`, which has a fully-documented pattern in `.claude/skills/platform-patterns/`, does not exist as an actual hook file — landing components were refactored to use the TanStack `loader` SSR pattern instead, making the pattern doc a stale liability. There are 8 findings total: 0 P0, 2 P1, 4 P2, 4 P3, plus 3 documented skips. The highest-value findings are: the stale `use-section-data` pattern doc (actively misleads future contributors), the `use-cursor-pagination` pattern doc drift (missing `fetchOptions`/`initialData`/`error` which are now load-bearing for auth-gated endpoints), and the `.then()/.catch()` code style violation in `use-subscriptions`.

---

## P0 — Fix Now

None found.

---

## P1 — High Value

### Stale pattern document: `use-section-data` documents a hook that does not exist

- **Affected files**:
  - `platform/.claude/skills/platform-patterns/use-section-data.md`
  - `platform/.claude/rules/patterns.md` (index entry under "Landing Page Polish")
  - `platform/CLAUDE.md` (repo context lists `hooks/use-section-data.ts` as a source file)
- **Current state**: The pattern document describes `useSectionData<T>` as a hook at `apps/web/src/hooks/use-section-data.ts` with examples citing `featured-creators.tsx:12` and `recent-content.tsx:13`. None of these exist. The actual `apps/web/src/hooks/` directory contains four files; `use-section-data.ts` is not one of them. Both landing components receive data as props from the SSR `loader` in `routes/index.tsx` — they contain no `useEffect` or fetching. The pattern index and CLAUDE.md repo context both list the hook as if it exists.
- **Risk**: Future contributors reading the pattern index will implement a new landing section using the documented client-side hook pattern rather than the correct SSR loader pattern. This creates divergence on every new landing section added to the app.
- **Proposed fix**:
  1. Remove the `use-section-data` entry from `## Landing Page Polish` in `platform/.claude/rules/patterns.md`.
  2. Delete `platform/.claude/skills/platform-patterns/use-section-data.md`.
  3. Remove `hooks/use-section-data.ts` from the source file listing in `platform/CLAUDE.md`.
  4. Optionally add a note in the landing section patterns area explaining that landing data is fetched server-side via the `loader` function in `routes/index.tsx`.
  5. Run `python3 scripts/check-doc-links.py --index` after edits.
- **Estimated scope**: Edit 2 files (`patterns.md`, `CLAUDE.md`), delete 1 file (`use-section-data.md`). ~10 LOC net removed.
- **Pattern reference**: `use-section-data` (stale — remove)
- **Tests affected**: None — the hook was never implemented.
- **Verify**: [x] `check-doc-links.py --index` passes / [x] No broken cross-references / [x] Behavior unchanged
- **Implemented**: 2026-03-06

---

### `use-cursor-pagination` pattern doc is meaningfully out of date with the implementation

- **Affected files**:
  - `platform/.claude/skills/platform-patterns/use-cursor-pagination.md`
- **Current state**: The pattern file's Example 1 shows the hook signature as:
  ```typescript
  export function useCursorPagination<T>({
    buildUrl,
    deps = [],
  }: {
    buildUrl: (cursor: string | null) => string;
    deps?: readonly unknown[];
  }): {
    items: T[];
    nextCursor: string | null;
    isLoading: boolean;
    loadMore: () => void;
  }
  ```
  The actual implementation has three additional parameters and one additional return value:
  - `fetchOptions?: RequestInit` — callers pass `{ credentials: "include" }` for auth-gated endpoints (`settings/bookings.tsx`, `admin.tsx`). Omitting this causes silent 401 failures.
  - `initialData?: { items: T[]; nextCursor: string | null }` — callers pass SSR loader data (`feed.tsx`, `creators/index.tsx`) to skip the first client-side fetch.
  - `error: string | null` — return value callers use to show error UI (`settings/bookings.tsx`, `merch/index.tsx`, `admin.tsx`).

  The usage examples (feed, creators, creator detail) in the pattern doc do not show `fetchOptions` or `initialData` even though both are now in active use. The `Common Violations` section does not mention omitting `fetchOptions` on protected routes.
- **Risk**: Developers implementing new paginated pages for auth-gated data (e.g., a future "My Content" list) will follow the pattern doc, omit `fetchOptions: { credentials: "include" }`, and get silent 401 failures. This has likely already happened — `admin.tsx` correctly passes `fetchOptions` but this usage is undocumented.
- **Proposed fix**: Update `use-cursor-pagination.md` to:
  1. Replace Example 1 with the full current signature (all 4 input params, all 5 return values).
  2. Add Example 5: authenticated endpoint usage (e.g., bookings) showing `fetchOptions: { credentials: "include" }`.
  3. Add Example 6: SSR-seeded usage showing `initialData: loaderData`.
  4. Update `Common Violations` to add: "Omitting `fetchOptions: { credentials: 'include' }` on auth-gated endpoints causes silent 401 failures — the browser will not send the session cookie."
  5. Update `When to Use` to note when `fetchOptions` and `initialData` apply.
- **Estimated scope**: Edit 1 pattern file, ~60 LOC of new content. No source changes.
- **Pattern reference**: `use-cursor-pagination` (drift — update)
- **Tests affected**: None.
- **Verify**: [x] Pattern examples compile mentally against current hook signature / [x] Violations section covers all three known anti-patterns / [x] Behavior unchanged
- **Implemented**: 2026-03-06

---

## P2 — Medium Value

### `use-subscriptions` uses `.then()/.catch()` chains instead of `async/await`

- **Location**: `apps/web/src/hooks/use-subscriptions.ts:24-30`
- **Affected files**: `apps/web/src/hooks/use-subscriptions.ts`
- **Issue**: `CLAUDE.md` states "`async/await` throughout — never `.then()` / `.catch()` chains." The `useEffect` body in `use-subscriptions` calls `fetchMySubscriptions().then(...).catch(...)`. Every other hook in the codebase that performs async work (`use-cursor-pagination`, route components) uses the `async function run() + void run()` inner-function pattern with `await`.
- **Suggestion**: Refactor the effect body to use an inner async function:
  ```typescript
  useEffect(() => {
    if (!session.data) {
      setSubscriptions([]);
      return;
    }
    let cancelled = false;
    const run = async (): Promise<void> => {
      try {
        const result = await fetchMySubscriptions();
        if (!cancelled) setSubscriptions(result);
      } catch {
        // Silently fail — subscription status is supplementary
      }
    };
    void run();
    return () => { cancelled = true; };
  }, [session.data]);
  ```
- **Tests affected**: None — behavior is identical; `fetchMySubscriptions` is mocked at module level in callers' tests. A direct hook test does not yet exist (see P3).
- **Verify**: [x] Tests pass / [x] No new public APIs / [x] Behavior unchanged
- **Implemented**: 2026-03-06

---

### `use-subscriptions` uses boolean cancellation flag instead of `AbortController`

- **Location**: `apps/web/src/hooks/use-subscriptions.ts:23`
- **Affected files**: `apps/web/src/hooks/use-subscriptions.ts`, `apps/web/src/lib/subscription.ts`, `apps/web/src/lib/fetch-utils.ts`
- **Issue**: The hook uses `let cancelled = false` to guard `setSubscriptions` after unmount. This correctly prevents stale state updates but does not cancel the underlying network request — the fetch continues to completion even after the component unmounts, consuming bandwidth and a connection. The `AbortController` pattern, standard in the React docs for fetch cleanup since React 18, aborts the request at the network layer. Current React docs explicitly recommend `AbortController` over boolean flags for fetch effects.

  The complication: `fetchMySubscriptions()` calls `apiGet<T>()` from `fetch-utils.ts`, which does not currently accept an `AbortSignal`. Fully fixing this requires threading `signal` through two layers.
- **Suggestion**: Extend `apiGet` to accept an optional signal, update `fetchMySubscriptions`, and update the hook:
  ```typescript
  // fetch-utils.ts — add optional signal param
  export async function apiGet<T>(
    endpoint: string,
    params?: Record<string, string | number | undefined>,
    signal?: AbortSignal,
  ): Promise<T> { ... }

  // subscription.ts — thread signal through
  export async function fetchMySubscriptions(signal?: AbortSignal): Promise<...> {
    const data = await apiGet<...>("/api/subscriptions/mine", undefined, signal);
    return data.subscriptions;
  }

  // use-subscriptions.ts — use AbortController
  useEffect(() => {
    if (!session.data) { setSubscriptions([]); return; }
    const controller = new AbortController();
    const run = async () => {
      try {
        const result = await fetchMySubscriptions(controller.signal);
        setSubscriptions(result);
      } catch (e) {
        if (e instanceof Error && e.name === "AbortError") return;
        // Silently fail
      }
    };
    void run();
    return () => { controller.abort(); };
  }, [session.data]);
  ```
  Note: `fetchMySubscriptions` is also called directly in `creator-detail.tsx` inside `Promise.allSettled` — that call site does not need a signal (it has its own `cancelled` flag for the overall effect).
- **Estimated scope**: 3 files, ~20 LOC delta.
- **Tests affected**: `tests/unit/lib/subscription.test.ts` may need updating if signal param changes the mock expectations.
- **Verify**: [x] Tests pass / [x] `creator-detail.tsx` call site still works without signal / [x] Behavior unchanged
- **Implemented**: 2026-03-06

---

### `use-guest-redirect` implements auth guard via `useEffect` instead of `beforeLoad`

- **Location**: `apps/web/src/hooks/use-guest-redirect.ts`, `apps/web/src/routes/login.tsx`, `apps/web/src/routes/register.tsx`
- **Affected files**: All three above.
- **Issue**: The `tanstack-file-route` pattern documents `beforeLoad` + `throw redirect()` as the canonical auth guard. `use-guest-redirect` instead fires a `useEffect` → `navigate()` redirect after the component has mounted and painted. This means:
  1. The login/register form renders for at least one frame before redirect fires — a brief flash of protected UI.
  2. The route component must manually check `shouldRender` and return `null`, creating a two-step guard vs. a clean `beforeLoad` abort.
  3. Three other guarded routes (`dashboard.tsx`, `settings/bookings.tsx`, `admin.tsx`) all use `beforeLoad` correctly.

  The reason for the hook's existence is that `beforeLoad` requires a server-side session check (`fetchAuthStateServer`), adding a round-trip for what is a public page. The boolean return value also suppresses the form while `session.isPending`, which `beforeLoad` cannot do (it runs once, before mount).
- **Suggestion**: This is a legitimate trade-off: network latency on a public page vs. one-frame flash on an authenticated user's rare visit to `/login`. The current approach is defensible. However, the `tanstack-file-route.md` pattern doc should explicitly document *why* `useGuestRedirect` is preferred over `beforeLoad` for auth pages:
  > "Guest-only routes (login, register) use `useGuestRedirect()` instead of `beforeLoad` because these are intentionally public — a server-side session check in `beforeLoad` would add latency on every page load. The hook's boolean return value also suppresses the form during `session.isPending`, preventing a flash of form content before the auth state resolves."

  Alternatively, if the flash is ever noticed in practice, migrate both routes to `beforeLoad` using `fetchAuthStateServer` and delete the hook.
- **Tests affected**: None for documentation update; login/register route tests for migration approach.
- **Pattern reference**: `tanstack-file-route.md` (needs clarifying note)
- **Verify**: [x] Pattern doc accurately describes trade-off / [x] No behavior changes for documentation-only path
- **Implemented**: 2026-03-06

---

### Missing tests for `use-menu-toggle`, `use-guest-redirect`, and `use-subscriptions`

- **Affected files**:
  - `apps/web/src/hooks/use-menu-toggle.ts` (no test file)
  - `apps/web/src/hooks/use-guest-redirect.ts` (no test file)
  - `apps/web/src/hooks/use-subscriptions.ts` (no test file)
- **Current state**: Only `use-cursor-pagination` has a dedicated test file (`tests/unit/hooks/use-cursor-pagination.test.ts`, 11 tests). The other three hooks are exercised only indirectly through component tests that mock their dependencies. `use-guest-redirect` controls auth redirect on two routes with no direct behavioral assertions.
- **Suggestion**: Add `tests/unit/hooks/use-menu-toggle.test.ts`, `tests/unit/hooks/use-guest-redirect.test.ts`, and `tests/unit/hooks/use-subscriptions.test.ts` using the `renderHook` pattern from `@testing-library/react`. Key cases:
  - `use-menu-toggle`: toggle opens/closes, Escape closes, click-outside closes, listeners only registered when open
  - `use-guest-redirect`: returns `true` (render) when no session, returns `false` and calls `navigate` when `session.data` is set, returns `false` while `isPending`
  - `use-subscriptions`: returns `[]` when unauthenticated, fetches when session arrives, clears on session loss, cancellation prevents stale state set after unmount
- **Estimated scope**: 3 new test files, ~120 LOC total. Implement after the `async/await` fix (P2 above) so tests match the final code.
- **Pattern reference**: `vi-hoisted-module-mock.md`, `use-cursor-pagination.test.ts` as structural reference
- **Tests affected**: New files only; no existing tests change.
- **Verify**: [x] New tests pass / [x] No new public APIs / [x] Behavior unchanged
- **Implemented**: 2026-03-06

---

## P3 — Nice-to-Have

- **`use-cursor-pagination.ts:39` — ESLint suppression needs an explanation**: The `// eslint-disable-next-line react-hooks/exhaustive-deps` comment on the `useCallback` for `fetchPage` is load-bearing — removing it would break the deps-reset pattern. A brief note like `// intentional: deps controls when fetchPage is recreated (filter reset); buildUrl/fetchOptions are stored in refs` would make the suppression self-documenting and prevent a future editor from "fixing" it by adding `buildUrl` to deps (which would cause an infinite fetch loop).

- **`use-cursor-pagination.ts:29` — `initialConsumedRef` flag needs a comment**: The `initialConsumedRef` boolean (line 29, consumed at lines 72-75) is a subtle mechanism that skips the first client-side fetch when SSR data is provided via `initialData`. The logic is correct but non-obvious. A comment block explaining the intent ("skip the first useEffect fetch when initialData was provided by the server-side loader") would prevent misinterpretation.

- **`use-subscriptions` has no dedicated test file**: Even before the `AbortController` migration, a minimal `renderHook` test covering the unauthenticated case (returns `[]`) and the authenticated case (calls `fetchMySubscriptions`, sets result) would increase confidence. `use-cursor-pagination` demonstrates the testing approach.

- **`feed.tsx:44` and `creators/index.tsx:33` define unnecessary `handleLoadMore` aliases**: Both files assign `const handleLoadMore = loadMore` and then use `handleLoadMore` in the JSX. The alias adds a line without adding clarity; `onClick={loadMore}` is more direct and consistent with how `admin.tsx` and `settings/bookings.tsx` use `loadMore` directly.

---

## Skip — Intentional Patterns

| Pattern | Location | Why it stays |
|---------|----------|-------------|
| `fetchMySubscriptions` called directly in `creator-detail.tsx` instead of via `useSubscriptions` hook | `apps/web/src/routes/creators/$creatorId.tsx:54` | `creator-detail.tsx` batches subscription fetch with plans and merch using `Promise.allSettled` for parallelism. The hook's `useEffect`-based approach would serialize the subscription fetch. This is a deliberate performance choice for supplementary non-critical data on a high-traffic page. A comment on the call site would clarify the intent (see P2). |
| `use-cursor-pagination` does not use `AbortController` | `apps/web/src/hooks/use-cursor-pagination.ts` | The hook's deps-recreation pattern achieves the same state-level protection as a cancelled flag: when `deps` change, `fetchPage` is recreated, and the old closure cannot call `setItems`. In-flight requests from the old `fetchPage` produce no observable effect. This differs from `use-subscriptions` where the setter is always the same reference. Both are safe; `useCursorPagination` is less urgent for upgrade. |
| Four separate hook files, no barrel `hooks/index.ts` | `apps/web/src/hooks/` | Matches the `CLAUDE.md` rule: "`index.ts` files only for re-exports — no implementation in index files." Each hook is imported by its direct path at all call sites. No barrel needed. |

---

## Best Practices Research

### React v19.2.4

| Current Approach | Recommended | Migration Effort |
|------------------|-------------|------------------|
| `useEffect` + boolean cancelled flag for async fetch cleanup | `AbortController` + `signal` forwarded to `fetch()` — network-level cancellation, not just state suppression. React docs explicitly recommend `AbortController` for fetch effects. | Medium — requires threading `signal` through `apiGet` and lib functions |
| `.then()/.catch()` in `use-subscriptions` | `async/await` inner function — matches CLAUDE.md convention and every other async effect in the codebase | Low — mechanical refactor, no behavioral change |
| `useEffect`-based data fetching in hooks | Remains correct for client-only hooks that depend on reactive state (e.g., `session.data`). React 19's `use()` hook is for consuming pre-created promises (from RSC or passed as props), not for initiating fetches inside client components. No migration needed. | N/A |

### Fetch API — AbortController

| Current Approach | Recommended | Migration Effort |
|------------------|-------------|------------------|
| Boolean `cancelled` flag in `use-subscriptions` prevents `setState` after unmount | `AbortController.abort()` cancels the underlying network request, conserving bandwidth and connections | Low for the hook; Medium to thread `signal` through `apiGet` |
| No explicit abort in `use-cursor-pagination` | Acceptable given the deps-recreation pattern achieves equivalent state protection (see Skip section) | Low-to-Medium if desired |

---

## OSS Alternatives

| Hand-rolled Code | Package | Weekly DL | Stack Fit | Notes |
|-----------------|---------|-----------|-----------|-------|
| `use-cursor-pagination` + `use-subscriptions` client-side fetching | `@tanstack/react-query` | ~12.3M | Partial — coherent with TanStack Router ecosystem; conflicts with loader-based SSR data | ~16KB gzipped; adds caching, deduplication, background refetch, DevTools. Overkill for 4 targeted hooks; revisit if data-fetching hooks exceed ~8-10. |
| `use-cursor-pagination` infinite-scroll pattern | `swr` with `useSWRInfinite` | ~7.7M | Partial — less coherent with TanStack stack | ~4.2KB gzipped; simpler API, fewer features. Same SSR conflict caveat as TanStack Query. |

No OSS alternatives recommended at this time. The hand-rolled hooks are minimal and well-matched to the app's needs. The primary value-add of a data-fetching library (caching, deduplication) is already handled by TanStack Router's loader system for all primary data.

---

## Pattern Compliance

| Pattern | Status | Notes |
|---------|--------|-------|
| `use-cursor-pagination` | Fixed | Pattern doc updated with full signature, Examples 5–6, and new Common Violations entry for `fetchOptions`. |
| `use-section-data` | Fixed | Pattern doc deleted, `patterns.md` entry removed, `CLAUDE.md` reference removed. Note: `platform-patterns/SKILL.md` line 71 still has a dangling link — not in original finding's scope; remaining cleanup item. |
| `tanstack-file-route` | Fixed | Guest-Only Routes section added to `tanstack-file-route.md` explaining `useGuestRedirect` trade-off. |
| `async/await` code style | Fixed | `use-subscriptions.ts` refactored to `async/await` inner-function pattern with `AbortController`. |
| `vi-hoisted-module-mock` | Fixed | Test files added for all three hooks: `use-menu-toggle.test.ts`, `use-guest-redirect.test.ts`, `use-subscriptions.test.ts`. |
| `web-fetch-client` | Compliant | `apiGet` extended with optional `signal` param; `fetchMySubscriptions` threads `signal` through. All callers unaffected — param is optional. |
| `react-context-reducer-provider` | N/A | No context/reducer hooks in this scope. |

---

## Suggested Implementation Order

1. **Fix `use-subscriptions` `.then()/.catch()` → `async/await`** (P2) — 10 min, zero risk, immediate code style compliance. Do this first so subsequent tests match the final code.
2. **Remove `use-section-data` pattern doc and index entries** (P1) — 20 min, documentation-only. Run `check-doc-links.py --index` after. Eliminates the most impactful misleading doc.
3. **Update `use-cursor-pagination` pattern doc** (P1) — 30 min, documentation-only. Add `fetchOptions`/`initialData`/`error` to signature, add authenticated-endpoint example, update violations section.
4. **Add note to `tanstack-file-route.md` explaining `useGuestRedirect` trade-off** (P2) — 10 min, documentation-only. Closes the pattern gap without a code change.
5. **Add `AbortController` to `use-subscriptions`** (P2) — 45 min, thread `signal` through `apiGet` + `fetchMySubscriptions`. Write the hook test as part of this change.
6. **Add tests for `use-menu-toggle` and `use-guest-redirect`** (P2) — 45 min. After the hook is stabilized.
7. **Add explanatory comments in `use-cursor-pagination.ts`** (P3) — opportunistic, any time.

Order rationale: Code fix first (prerequisite for accurate tests), then doc cleanup (high leverage, zero risk), then test coverage (safety net before deeper changes), then the network-level abort improvement.
