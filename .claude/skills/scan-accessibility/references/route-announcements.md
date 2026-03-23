# Rule: Route Announcements

> SPA route transitions must programmatically manage focus and announce page changes to assistive technology.

## Motivation

WCAG 2.4.3 (Focus Order, Level A). When a user navigates to a new route in a single-page
app, screen readers don't automatically announce the page change the way they do for full
page loads. TanStack Router does NOT handle this automatically — this is a known open
issue (github.com/TanStack/router/issues/918). Without explicit handling, focus stays on
the clicked link or gets lost, and screen reader users receive no feedback.

## Before / After

### From this codebase: root layout

**Before:** (gap — no route transition handling in `apps/web/src/routes/__root.tsx`)
The root layout has the infrastructure — `<a href="#main-content">Skip to main content</a>`
(line 76-78) and `<main id="main-content">` landmark — but nothing moves focus to these
targets after a route change.

### Synthetic example: route transition focus management

**Before:**
```tsx
// __root.tsx — no route change handling
export const Route = createRootRoute({
  component: () => (
    <div>
      <NavBar />
      <main id="main-content">
        <Outlet />
      </main>
    </div>
  ),
});
```

**After:**
```tsx
// hooks/use-route-announcer.ts
import { useRouter } from "@tanstack/react-router";
import { useEffect, useRef } from "react";

export function useRouteAnnouncer(): void {
  const router = useRouter();
  const isFirstRender = useRef(true);

  useEffect(() => {
    return router.subscribe("onResolved", () => {
      if (isFirstRender.current) {
        isFirstRender.current = false;
        return; // Skip initial load — browser handles it
      }
      // Move focus to main heading or main content
      const heading = document.querySelector("h1");
      const main = document.getElementById("main-content");
      const target = heading ?? main;
      if (target) {
        target.setAttribute("tabindex", "-1");
        target.focus({ preventScroll: false });
      }
    });
  }, [router]);
}

// __root.tsx
export const Route = createRootRoute({
  component: () => {
    useRouteAnnouncer();
    return (
      <div>
        <NavBar />
        <main id="main-content">
          <Outlet />
        </main>
      </div>
    );
  },
});
```

## Exceptions

- Hash-link navigation within the same page (browser handles focus natively)
- External link navigation (full page load handles it)
- Programmatic redirects in `beforeLoad` guards (redirect before render — no user-initiated navigation)
- Initial page load (browser and SSR handle the first render)

## Scope

- Applies to: `apps/web/src/routes/__root.tsx` (the root layout where the router subscription should live) and potentially a new hook in `apps/web/src/hooks/`
- Does NOT apply to: individual route files, API routes, test files
