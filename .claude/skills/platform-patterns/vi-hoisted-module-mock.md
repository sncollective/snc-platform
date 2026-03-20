# Pattern: vi.hoisted Module Mock

React component tests hoist mock functions via `vi.hoisted()` before `vi.mock()` calls, then import the component under test after all mocks are established. `beforeEach` sets default return values.

## Rationale

Vitest's static module analysis resolves `vi.mock()` calls before imports — but the mock factory functions themselves need access to variables (the mock `vi.fn()` instances). `vi.hoisted()` lifts variable declarations before module resolution, so the hoisted functions are available inside `vi.mock()` factory closures. This is the React component equivalent of the `vi-doMock-dynamic-import` pattern for API singletons.

## Examples

### Example 1: NavBar test — hoisting router + auth mocks
**File**: `apps/web/tests/unit/components/nav-bar.test.tsx:13`
```typescript
// ── Hoisted Mocks ──
const {
  mockUseRouterState,
  mockNavigate,
  mockUseSession,
  mockUseRoles,
  mockSignOut,
} = vi.hoisted(() => ({
  mockUseRouterState: vi.fn(),
  mockNavigate: vi.fn(),
  mockUseSession: vi.fn(),
  mockUseRoles: vi.fn(),
  mockSignOut: vi.fn(),
}));

vi.mock("@tanstack/react-router", async () => {
  const React = await import("react");
  return {
    Link: ({ to, children, className, onClick, role }: Record<string, unknown>) =>
      React.createElement("a", { href: to as string, className, onClick, role }, children as React.ReactNode),
    useRouterState: mockUseRouterState,
    useNavigate: () => mockNavigate,
  };
});

vi.mock("../../../src/lib/auth.js", () => ({
  useSession: mockUseSession,
  useRoles: mockUseRoles,
  hasRole: (roles: string[], role: string) => roles.includes(role),
}));

vi.mock("../../../src/lib/auth-client.js", () => ({
  authClient: { signOut: mockSignOut },
}));

// ── Import component under test (after mocks) ──
import { NavBar } from "../../../src/components/layout/nav-bar.js";
```

### Example 2: Test lifecycle — defaults in beforeEach
**File**: `apps/web/tests/unit/components/nav-bar.test.tsx:63`
```typescript
beforeEach(() => {
  mockUseRouterState.mockReturnValue({
    location: { pathname: "/" },
  });
  mockUseSession.mockReturnValue(makeMockSessionResult());
  mockUseRoles.mockReturnValue([]);
});
```

### Example 3: Auth forms test — hoisting authClient signIn/signUp
**File**: `apps/web/tests/unit/components/auth-forms.test.tsx:7`
```typescript
const { mockNavigate, mockSignInEmail, mockSignUpEmail } = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
  mockSignInEmail: vi.fn(),
  mockSignUpEmail: vi.fn(),
}));

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock("../../../src/lib/auth-client.js", () => ({
  authClient: {
    signIn: { email: mockSignInEmail },
    signUp: { email: mockSignUpEmail },
  },
}));

import { LoginForm } from "../../../src/components/auth/login-form.js";
import { RegisterForm } from "../../../src/components/auth/register-form.js";

beforeEach(() => {
  mockSignInEmail.mockReset();
  mockSignUpEmail.mockReset();
  mockNavigate.mockReset();
});
```

### Example 4: Per-test mock override for role-based rendering
**File**: `apps/web/tests/unit/components/nav-bar.test.tsx:123`
```typescript
it("shows 'Dashboard' link when user has cooperative-member role", async () => {
  const user = userEvent.setup();
  mockUseSession.mockReturnValue(makeLoggedInSessionResult({ name: "Jane Doe" }));
  mockUseRoles.mockReturnValue(["cooperative-member"]);

  render(<NavBar />);

  await user.click(screen.getByLabelText("User menu"));

  const dashboardLink = screen.getByRole("menuitem", { name: "Dashboard" });
  expect(dashboardLink).toHaveAttribute("href", "/dashboard");
});

it("hides 'Dashboard' link when user lacks cooperative-member role", async () => {
  mockUseSession.mockReturnValue(makeLoggedInSessionResult({ name: "Jane Doe" }));
  mockUseRoles.mockReturnValue(["subscriber"]);

  render(<NavBar />);
  await userEvent.setup().click(screen.getByLabelText("User menu"));

  expect(screen.queryByRole("menuitem", { name: "Dashboard" })).toBeNull();
});
```

## Note on Mock Cleanup

`restoreMocks: true` in vitest.config.ts eliminates manual `vi.restoreAllMocks()` cleanup.

## When to Use

- Any React component test that needs to mock hooks from external libraries (`@tanstack/react-router`, `better-auth`)
- Mocking eagerly-imported singletons (`authClient`) in component tests
- Tests that need to verify role-based or session-based conditional rendering

## When NOT to Use

- Unit tests for pure utility functions (no module mocking needed)
- API/server tests — use `vi.doMock()` + dynamic `import()` for those (see `vi-doMock-dynamic-import.md`)

## Common Violations

- Declaring mock functions inside `vi.mock()` factory without hoisting — results in `ReferenceError` at test runtime
- Importing the component under test before `vi.mock()` calls — mocks won't apply to already-resolved imports
- Not resetting mocks in `beforeEach` — tests bleed state into each other
- Mocking `Link` from `@tanstack/react-router` as a no-op — render it as `<a href={to}>` so `getByRole("link")` works
