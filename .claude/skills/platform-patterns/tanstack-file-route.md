# Pattern: TanStack File Route

Each route file exports a `Route` constant created via `createFileRoute(path)(options)`, with `beforeLoad` for access control and a component function defined in the same file.

## Rationale

TanStack Router requires every route to declare itself via `createFileRoute()` so the router can statically type the route tree. Co-locating the guard logic (`beforeLoad`) with the component keeps auth requirements and UI together. Throwing `redirect()` from `beforeLoad` aborts rendering before the component mounts — no flicker, no double-fetch.

## Examples

### Example 1: Protected route with role-based access
**File**: `apps/web/src/routes/dashboard.tsx:41`
```typescript
import { createFileRoute, redirect } from "@tanstack/react-router";
import { RouteErrorBoundary } from "../components/error/route-error-boundary.js";
import { fetchApiServer, fetchAuthStateServer } from "../lib/api-server.js";
import { isFeatureEnabled } from "../lib/config.js";
import { AccessDeniedError } from "../lib/errors.js";
import { buildLoginRedirect } from "../lib/return-to.js";

export const Route = createFileRoute("/dashboard")({
  beforeLoad: async ({ location }) => {
    if (!isFeatureEnabled("dashboard")) throw redirect({ to: "/" });

    const { user, roles } = await fetchAuthStateServer();

    if (!user) {
      throw redirect(buildLoginRedirect(location.pathname));
    }

    if (!roles.includes("stakeholder")) {
      throw new AccessDeniedError();
    }
  },
  errorComponent: RouteErrorBoundary,
  loader: async (): Promise<DashboardLoaderData> => {
    const [revenue, subscribers, bookingSummary, emissionsSummary] =
      await Promise.all([
        fetchApiServer({ data: "/api/dashboard/revenue" }) as Promise<RevenueResponse>,
        fetchApiServer({ data: "/api/dashboard/subscribers" }) as Promise<SubscriberSummary>,
        fetchApiServer({ data: "/api/dashboard/bookings" }) as Promise<BookingSummary>,
        fetchApiServer({ data: "/api/emissions/summary" }) as Promise<EmissionsSummary>,
      ]);
    return { revenue, subscribers, bookingSummary, emissionsSummary };
  },
  component: DashboardPage,
});
```

### Example 2: Guest-only route with returnTo support
**File**: `apps/web/src/routes/login.tsx:12`
```typescript
import { useSession } from "../lib/auth.js";
import { getValidReturnTo } from "../lib/return-to.js";

export const Route = createFileRoute("/login")({
  validateSearch: z.object({
    returnTo: z.optional(z.string()),
  }),
  component: LoginPage,
});

function LoginPage() {
  const { returnTo } = Route.useSearch();
  const session = useSession();
  const navigate = useNavigate();

  useEffect(() => {
    if (session.data) {
      void navigate({ to: getValidReturnTo(returnTo) });
    }
  }, [session.data, navigate, returnTo]);

  if (session.isPending || session.data) return null;

  return (
    <div className={styles.page}>
      <h1 className={styles.heading}>Log in to S/NC</h1>
      <LoginForm returnTo={returnTo} />
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

## Key Supporting Modules

- **`lib/api-server.ts`**: `fetchAuthStateServer()` (server-side auth via `createServerFn`) and `fetchApiServer()` (server-side API fetch with cookie forwarding) — used in `beforeLoad` and `loader` for SSR
- **`lib/errors.ts`**: `AccessDeniedError` — thrown when a user lacks the required role; caught by `RouteErrorBoundary` to show a friendly error page instead of redirecting
- **`lib/return-to.ts`**: `buildLoginRedirect(currentPath)` — constructs redirect with `?returnTo=` param so users return to their original page after login; `getValidReturnTo(returnTo)` validates the param to prevent open redirects
- **`lib/config.ts`**: `isFeatureEnabled(flag)` — feature flag check; routes can gate on feature availability before auth

## Guest-Only Routes

Guest-only routes (login, register) use `useSession()` + `useEffect` redirect instead of `beforeLoad` because these are intentionally public — a server-side session check in `beforeLoad` would add latency on every page load. The session pending check suppresses the form during load, preventing a flash of content before auth state resolves. The `returnTo` search param enables redirect-after-login flows.

## When to Use

- Every page/route in the app — this is mandatory for TanStack Router
- Auth-only pages: add `beforeLoad` that calls `fetchAuthStateServer()`, `buildLoginRedirect()` for unauthenticated, `AccessDeniedError` for wrong role, and `errorComponent: RouteErrorBoundary`
- Feature-gated pages: check `isFeatureEnabled(flag)` before auth in `beforeLoad`
- Loaders that fetch API data: use `fetchApiServer({ data: endpoint })` for server-side fetch with cookie forwarding
- Guest-only pages (login, register): use `useSession()` + `useEffect` redirect in the component

## When NOT to Use

- Non-page components — only route files export `Route` via `createFileRoute()`
- Soft redirects after user action (e.g. after sign-out) — use `navigate({ to: "..." })` instead of `throw redirect()`

## Common Violations

- Checking auth in the component body instead of `beforeLoad` — causes flash of protected content before redirect
- Not throwing `redirect()` (just calling `navigate()`) in `beforeLoad` — `navigate()` is async and won't stop rendering
- Defining the component function before the `Route` export — breaks TanStack Router's static analysis
