# Refactor Analysis: Hooks

> **Generated**: 2026-03-06
> **Scope**: 4 files analyzed — `apps/web/src/hooks/*.ts`
> **Libraries researched**: React 19.2.4, @tanstack/react-router 1.163.2, @tanstack/react-start 1.162.2

---

## Executive Summary

All four hooks in `apps/web/src/hooks/` were analyzed: `use-cursor-pagination.ts`, `use-menu-toggle.ts`, `use-guest-redirect.ts`, and `use-subscriptions.ts`. The scope also revealed that `use-section-data`, which has a fully-documented pattern in `.claude/skills/platform-patterns/`, does not exist as an actual hook file — the landing components were refactored to use TanStack's `loader` pattern instead. There are 7 findings total: 0 P0, 1 P1, 3 P2, 3 P3, plus 1 documented skip. The highest-value finding is the `use-subscriptions` hook breaking the `async/await` code style convention with `.then()/.catch()` chains; second is the stale `use-section-data` pattern doc that describes an architecture no longer present in the codebase; third is the absence of tests for three of the four hooks.

---

## P0 — Fix Now

None found.

---

## P1 — High Value

### Missing tests for `use-menu-toggle`, `use-guest-redirect`, and `use-subscriptions`

- **Affected files**:
  - `apps/web/src/hooks/use-menu-toggle.ts`
  - `apps/web/src/hooks/use-guest-redirect.ts`
  - `apps/web/src/hooks/use-subscriptions.ts`
- **Current state**: Only `use-cursor-pagination` has a dedicated test file (`tests/unit/hooks/use-cursor-pagination.test.ts`, 11 tests). The other three hooks have zero direct unit tests. `use-menu-toggle` is exercised implicitly through `UserMenu` and `MobileMenu` component tests; `use-guest-redirect` and `use-subscriptions` are tested only indirectly (by mocking `lib/subscription.js` / `lib/auth.js` in component/route tests that happen to render components using those hooks).
- **Risk**: Behavioral regressions in the hooks themselves go undetected. `use-subscriptions` has a known code style violation (see P2 below) and its cancellation logic has never been directly asserted. `use-guest-redirect` — which controls authentication redirect on two routes — has no test at all for its return value or redirect timing.
- **Proposed consolidation**: Add `tests/unit/hooks/use-menu-toggle.test.ts`, `tests/unit/hooks/use-guest-redirect.test.ts`, and `tests/unit/hooks/use-subscriptions.test.ts` following the `use-cursor-pagination.test.ts` pattern: `renderHook` + `vi.stubGlobal`/`vi.hoisted` mocks for external deps. Key cases per hook:
  - `use-menu-toggle`: toggle open/close, Escape key closes, click-outside closes, no listener registered when closed
  - `use-guest-redirect`: returns `true` when no session, returns `false` and calls `navigate` when `session.data` is set, returns `false` while `isPending`
  - `use-subscriptions`: returns `[]` with no session, returns subscriptions when session present, clears on session loss, cancellation flag prevents stale set after unmount
- **Estimated scope**: 3 new test files, ~120 LOC total
- **Pattern reference**: `vi-hoisted-module-mock.md`, `use-cursor-pagination.test.ts` as structural reference
- **Tests affected**: New files only; no existing tests change
- **Verify**: [ ] New tests pass / [ ] No new public APIs / [ ] Behavior unchanged

---

## P2 — Medium Value

### `use-subscriptions` uses `.then()/.catch()` chains instead of `async/await`

- **Location**: `apps/web/src/hooks/use-subscriptions.ts:24-30`
- **Affected files**: `apps/web/src/hooks/use-subscriptions.ts`
- **Issue**: The CLAUDE.md coding convention states "`async/await` throughout — never `.then()` / `.catch()` chains." The `useEffect` body in `use-subscriptions` calls `fetchMySubscriptions().then(...).catch(...)` instead of defining an inner async function and using `await`. Every other hook in the codebase that performs async work (including `use-cursor-pagination`, `subscribe-cta`, and `checkout/success`) uses the `async function + void run()` pattern with `await`.
- **Suggestion**: Refactor the effect body to:
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
- **Tests affected**: None — behavior is identical; tests mock `fetchMySubscriptions` at the module level
- **Verify**: [ ] Tests pass / [ ] No new public APIs / [ ] Behavior unchanged

---

### `use-section-data` pattern document describes an architecture that no longer exists

- **Location**: `platform/.claude/skills/platform-patterns/use-section-data.md`
- **Affected files**: Pattern doc only; no source file exists
- **Issue**: The pattern document describes `useSectionData<T>` as a hook living at `apps/web/src/hooks/use-section-data.ts` with components (`FeaturedCreators`, `RecentContent`) fetching their own data client-side. The actual codebase does not have this file. Both landing components now receive data as props from the `loader` function in `routes/index.tsx`, which uses `Promise.all` + `fetchApiServer` for server-side pre-fetching. The pattern doc's examples reference component code (`featured-creators.tsx:12`, `recent-content.tsx:13`) that no longer matches reality.

  This is the most impactful documentation drift because the `patterns.md` index still lists `use-section-data` under "Landing Page Polish" with a file reference, and the `CLAUDE.md` repo context lists `hooks/use-section-data.ts` as a source file. Future contributors reading these docs will be misled into implementing the client-side hook pattern when the SSR loader pattern is the established approach.
- **Suggestion**: Two sub-options:
  1. **Update the pattern doc** to describe the current architecture: TanStack `loader` pre-fetches all landing data server-side; components receive props and render statically. Remove references to `use-section-data.ts`. Update `patterns.md` index and `CLAUDE.md` repo context to remove the hook listing and add an entry for the landing-data loader pattern.
  2. **Create the hook** if client-side data fetching for supplementary sections is desired (e.g., for routes that cannot use SSR). This would be a genuine addition, not a restoration.

  Option 1 is recommended — the SSR loader approach is strictly better for landing pages (no loading flash, no client-only fetch).
- **Tests affected**: None to break; pattern doc update only in option 1
- **Verify**: [ ] `check-doc-links.py --index` passes / [ ] No broken cross-references / [ ] Behavior unchanged

---

### `use-guest-redirect` uses `useEffect` for redirect instead of TanStack `beforeLoad`

- **Location**: `apps/web/src/hooks/use-guest-redirect.ts`, `apps/web/src/routes/login.tsx`, `apps/web/src/routes/register.tsx`
- **Affected files**: All three above
- **Issue**: The `tanstack-file-route` pattern documents that auth guards belong in `beforeLoad` with a `throw redirect(...)` call. The `use-guest-redirect` hook performs the redirect imperatively inside a `useEffect`, which means:
  1. The component renders its children for one tick before the redirect fires (React renders synchronously, `useEffect` runs after paint). This can cause a flash of the form content for authenticated users.
  2. The hook returns a `boolean` (`shouldRender`) that the route component checks to conditionally render `null`, creating a two-step guard instead of a clean redirect.
  3. The `beforeLoad` approach would prevent the component from mounting at all, matching the pattern used on `routes/dashboard.tsx`, `routes/checkout/success.tsx`, and `routes/settings/subscriptions.tsx`.

  This is labeled P2 (not P1) because: the flash is brief (not a security issue — auth is checked server-side by the API), it affects only 2 low-traffic pages (login, register), and migrating requires changing both routes plus deleting the hook if nothing else uses it.
- **Suggestion**: Migrate both routes to use `beforeLoad`:
  ```typescript
  // In login.tsx / register.tsx
  export const Route = createFileRoute("/login")({
    beforeLoad: async ({ context }) => {
      const { user } = await fetchAuthStateServer();
      if (user) throw redirect({ to: "/feed" });
    },
    component: LoginPage,
  });
  ```
  Then `LoginPage` needs no guard check — it only renders when the user is not authenticated. Delete `use-guest-redirect.ts` if no other callers remain.
- **Tests affected**: `tests/unit/routes/` tests for login and register pages would need updating; the hook test (P1 finding above) would be moot
- **Pattern reference**: `tanstack-file-route.md`
- **Verify**: [ ] Tests pass / [ ] No new public APIs / [ ] Behavior unchanged (redirect still fires, just earlier in lifecycle)

---

## P3 — Nice-to-Have

- **`use-cursor-pagination.ts:39` — ESLint suppression comment is load-bearing but unexplained**: The `// eslint-disable-next-line react-hooks/exhaustive-deps` comment is necessary because `deps` is intentionally spread into the dependency array. A brief inline comment explaining the design choice (`// intentional: deps array controls reset, not buildUrl`) would reduce confusion for future editors.

- **`use-cursor-pagination.ts:29` — `initialConsumedRef` flag logic is subtle without explanation**: The boolean flag that skips the first client-side fetch when `initialData` is provided is clever but non-obvious. A comment block explaining the SSR hydration intent would aid maintainability.

- **`use-menu-toggle.ts:16` — `menuRef` parameter type could be broadened**: Currently typed as `React.RefObject<HTMLElement | null>`, which works but `RefObject<Element | null>` would make the hook more obviously reusable for non-div containers like `<nav>` or `<aside>`. Low priority — both current callers pass `useRef<HTMLDivElement>`.

---

## Skip — Intentional Patterns

| Pattern | Location | Why it stays |
|---------|----------|-------------|
| Separate `use-subscriptions.ts` hook instead of calling `fetchMySubscriptions` inline | `apps/web/src/hooks/use-subscriptions.ts` | Encapsulates session-keyed fetch + cancellation in one place. Used in 3 components (`HeroSection`, `LandingPricing`, `pricing.tsx`). Centralizing avoids each component re-implementing the `session.data` guard, the cancellation flag, and the silent-error contract. |
| `use-cursor-pagination` uses boolean cancelled flag instead of `AbortController` | `apps/web/src/hooks/use-cursor-pagination.ts` | Both approaches prevent stale state updates; the flag is simpler and avoids needing to handle `AbortError` in the catch block. Consistent with `use-subscriptions` and `subscribe-cta.tsx`. Not a bug. |
| `fetchOptions` passthrough in `use-cursor-pagination` | `apps/web/src/hooks/use-cursor-pagination.ts:46` | Allows callers to pass `{ credentials: "include" }` for authenticated requests. The `fetchOptionsRef` ref pattern correctly avoids stale closures. Undocumented extension of the pattern, not a violation. |

---

## Best Practices Research

### React v19.2.4

| Current Approach | Recommended | Migration Effort |
|------------------|-------------|------------------|
| `useEffect` + cancelled flag for async data in hooks | Remains appropriate for client-only hooks. React 19's `use()` hook is for consuming already-created promises from RSC, not for initiating fetches inside client components. | N/A — current approach is correct for this stack |
| Manual cancelled boolean flag for cleanup | `AbortController` + signal passed to `fetch` is the modern idiom and provides actual network-level cancellation (not just state suppression). For `use-cursor-pagination`, this would cancel in-flight requests on filter change. | Low for `use-subscriptions`; Medium for `use-cursor-pagination` (must handle `AbortError` in catch, thread signal through `fetchOptions`) |
| `.then()/.catch()` in `use-subscriptions` | `async/await` inner function per CLAUDE.md convention | Low — mechanical change |

### @tanstack/react-router v1.163.2 / @tanstack/react-start v1.162.2

| Current Approach | Recommended | Migration Effort |
|------------------|-------------|------------------|
| `useEffect`-based redirect in `use-guest-redirect` | `beforeLoad` with `throw redirect()` — runs before the route component mounts, eliminates content flash | Medium — 2 route files, 1 hook file, test updates |
| Landing data in `loader` with `Promise.all` | Current approach is idiomatic TanStack Start. SSR pre-fetch is optimal for landing pages. | N/A — already optimal |
| `Route.useLoaderData()` for typed loader data access | Current approach is correct. `getRouteApi` is recommended only to avoid circular imports in deeply nested consumers, which is not applicable here. | N/A |

---

## OSS Alternatives

| Hand-rolled Code | Package | Weekly DL | Stack Fit | Notes |
|-----------------|---------|-----------|-----------|-------|
| `use-cursor-pagination` + `use-subscriptions` + inline fetches | `@tanstack/react-query` | 12.3M | Partial | ~16KB gzipped; adds caching, DevTools, background refetch. Conflicts with TanStack Router's built-in loader cache for SSR data — would require deciding which fetches move into queries vs. loaders. Not recommended without a clear split strategy. |
| Same | `swr` | 7.7M | Partial | ~4.2KB gzipped; simpler API. Same SSR conflict caveat. Not recommended. |

---

## Pattern Compliance

| Pattern | Status | Notes |
|---------|--------|-------|
| `use-cursor-pagination` | Compliant | Matches documented pattern. `fetchOptions` and `initialData` are undocumented extensions (not violations). |
| `use-section-data` | Stale | Pattern doc describes a hook that does not exist. Landing components use SSR loader pattern instead. Doc + CLAUDE.md need updating. |
| `vi-hoisted-module-mock` | Compliant | Hook tests that exist use `vi.stubGlobal("fetch", ...)` correctly. |
| `vi-import-original-partial-mock` | Compliant | Components using `use-subscriptions` mock `lib/subscription.js` with `importOriginal`. |
| `tanstack-file-route` | Drift | `use-guest-redirect` implements auth guard via `useEffect` + boolean rather than `beforeLoad`. |
| `async/await` code style | Drift | `use-subscriptions.ts` uses `.then()/.catch()` — violates CLAUDE.md convention. |
| `react-context-reducer-provider` | N/A | No context/reducer hooks in scope. |

---

## Suggested Implementation Order

1. **Fix `use-subscriptions` async/await** (P2 — 10 min, zero risk, instant code style compliance)
2. **Update/archive `use-section-data` pattern doc** (P2 — 20 min, documentation only; run `check-doc-links.py --index` after)
3. **Add tests for `use-menu-toggle`, `use-guest-redirect`, `use-subscriptions`** (P1 — after async fix so tests match final code)
4. **Migrate `use-guest-redirect` to `beforeLoad`** (P2 — after tests exist so migration can be verified; deletes the hook if no other callers remain)
5. **Add inline comments for `use-cursor-pagination` ref patterns** (P3 — opportunistic)
