# Pattern: TanStack File Route

Each route file exports a `Route` constant created via `createFileRoute(path)(options)`, with `beforeLoad` for access control and a component function defined in the same file.

## Rationale

TanStack Router requires every route to declare itself via `createFileRoute()` so the router can statically type the route tree. Co-locating the guard logic (`beforeLoad`) with the component keeps auth requirements and UI together. Throwing `redirect()` from `beforeLoad` aborts rendering before the component mounts — no flicker, no double-fetch.

## Examples

### Example 1: Protected route with role-based access
**File**: `apps/web/src/routes/dashboard.tsx:6`
```typescript
import { createFileRoute, redirect } from "@tanstack/react-router";
import { fetchAuthState } from "../lib/auth.js";

export const Route = createFileRoute("/dashboard")({
  beforeLoad: async () => {
    const { user, roles } = await fetchAuthState();

    if (!user) {
      throw redirect({ to: "/login" });
    }

    if (!roles.includes("cooperative-member")) {
      throw redirect({ to: "/feed" });
    }
  },
  component: DashboardPage,
});

function DashboardPage() {
  return <PlaceholderPage heading="Dashboard" />;
}
```

### Example 2: Guest-only route (redirects authenticated users)
**File**: `apps/web/src/routes/login.tsx:7`
```typescript
export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  const shouldRender = useGuestRedirect(); // redirects if already logged in

  if (!shouldRender) {
    return null;
  }

  return (
    <div className={styles.page}>
      <h1 className={styles.heading}>Log in to S/NC</h1>
      <LoginForm />
    </div>
  );
}
```

### Example 3: Root layout route
**File**: `apps/web/src/routes/__root.tsx`
```typescript
export const Route = createRootRoute({
  component: RootComponent,
});

function RootComponent() {
  return (
    <RootDocument>
      <NavBar />
      <main className="main-content">
        <Outlet />
      </main>
      <Footer />
    </RootDocument>
  );
}
```

### Example 4: Async loader for data fetching + Route.useLoaderData()
**File**: `apps/web/src/routes/content/$contentId.tsx:10-28`
```typescript
// loader runs before the component mounts; fetched data is type-safe via generic
export const Route = createFileRoute("/content/$contentId")({
  loader: async ({ params }): Promise<FeedItem> => {
    const res = await fetch(`${API_BASE_URL}/api/content/${params.contentId}`);
    if (!res.ok) throw new Error("Content not found");
    return (await res.json()) as FeedItem;
  },
  component: ContentDetailPage,
});

function ContentDetailPage(): React.ReactElement {
  // Route.useLoaderData() is fully typed to the loader's return type
  const item = Route.useLoaderData();
  return <ContentDetail item={item} />;
}
```

## Guest-Only Routes

Guest-only routes (login, register) use `useGuestRedirect()` instead of `beforeLoad` because these are intentionally public — a server-side session check in `beforeLoad` would add latency on every page load. The hook's boolean return value also suppresses the form during `session.isPending`, preventing a flash of form content before the auth state resolves.

## When to Use

- Every page/route in the app — this is mandatory for TanStack Router
- Auth-only pages: add `beforeLoad` that calls `fetchAuthState()` and `throw redirect()`
- Guest-only pages (login, register): use `useGuestRedirect()` hook in the component

## When NOT to Use

- Non-page components — only route files export `Route` via `createFileRoute()`
- Soft redirects after user action (e.g. after sign-out) — use `navigate({ to: "..." })` instead of `throw redirect()`

## Common Violations

- Checking auth in the component body instead of `beforeLoad` — causes flash of protected content before redirect
- Not throwing `redirect()` (just calling `navigate()`) in `beforeLoad` — `navigate()` is async and won't stop rendering
- Defining the component function before the `Route` export — breaks TanStack Router's static analysis
