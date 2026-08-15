import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import {
  makeMockSessionResult,
  makeLoggedInSessionResult,
} from "../../helpers/auth-fixtures.js";
import { createRouterMock } from "../../helpers/router-mock.js";
import { createAuthMock } from "../../helpers/auth-mock.js";

// ── Hoisted Mocks ──

const {
  mockUseRouterState,
  mockNavigate,
  mockUseSession,
  mockUseAuthExtras,
  mockSignOut,
} = vi.hoisted(() => ({
  mockUseRouterState: vi.fn(),
  mockNavigate: vi.fn(),
  mockUseSession: vi.fn(),
  mockUseAuthExtras: vi.fn(),
  mockSignOut: vi.fn(),
}));

vi.mock("@tanstack/react-router", () =>
  createRouterMock({
    useNavigate: () => mockNavigate,
    useRouterState: mockUseRouterState,
  }),
);

vi.mock("../../../src/lib/auth.js", () =>
  createAuthMock({ useSession: mockUseSession, useAuthExtras: mockUseAuthExtras }),
);

vi.mock("../../../src/lib/auth-client.js", () => ({
  authClient: { signOut: mockSignOut },
}));

// ── Import component under test (after mocks) ──

import { NavBar } from "../../../src/components/layout/nav-bar.js";

// ── Test Lifecycle ──

beforeEach(() => {
  mockUseRouterState.mockReturnValue({
    location: { pathname: "/" },
  });
  mockUseSession.mockReturnValue(makeMockSessionResult());
  mockUseAuthExtras.mockReturnValue({ roles: [], isPatron: false });
});

// ── Tests ──

describe("NavBar", () => {
  it("renders logo linking to home", () => {
    render(<NavBar />);

    const logo = screen.getByRole("link", { name: "S/NC" });
    expect(logo).toHaveAttribute("href", "/");
  });

  it("renders primary navigation links", () => {
    render(<NavBar />);

    const feedLink = screen.getByRole("link", { name: "Feed" });
    expect(feedLink).toHaveAttribute("href", "/feed");

    const creatorsLink = screen.getByRole("link", { name: "Creators" });
    expect(creatorsLink).toHaveAttribute("href", "/creators");

    const merchLink = screen.getByRole("link", { name: "Merch" });
    expect(merchLink).toHaveAttribute("href", "/merch");
  });

  it("renders Studio as internal link", () => {
    render(<NavBar />);

    const studioLink = screen.getByRole("link", { name: "Studio" });
    expect(studioLink).toHaveAttribute("href", "/studio");
    expect(studioLink).not.toHaveAttribute("target");
    expect(studioLink).not.toHaveAttribute("rel");
  });

  it("shows 'Log in' and 'Sign up' when no session", () => {
    mockUseSession.mockReturnValue({ data: null, isPending: false, error: null });

    render(<NavBar />);

    const loginLink = screen.getByRole("link", { name: "Log in" });
    expect(loginLink).toHaveAttribute("href", "/login");

    const signupLink = screen.getByRole("link", { name: "Sign up" });
    expect(signupLink).toHaveAttribute("href", "/register");
  });

  it("shows user avatar with initials when session exists", () => {
    mockUseSession.mockReturnValue(makeLoggedInSessionResult({ name: "Jane Doe" }));

    render(<NavBar />);

    const avatarButton = screen.getByRole("button", { name: "User menu" });
    expect(avatarButton).toBeInTheDocument();
    expect(avatarButton).toHaveTextContent("JD");
  });

  it("shows 'Co-op' link when user has stakeholder role", async () => {
    const user = userEvent.setup();
    mockUseSession.mockReturnValue(makeLoggedInSessionResult({ name: "Jane Doe" }));
    mockUseAuthExtras.mockReturnValue({ roles: ["stakeholder"], isPatron: false });

    render(<NavBar />);

    await user.click(screen.getByLabelText("User menu"));

    // MenuItem with asChild renders as role="menuitem" (Ark overrides role)
    const coopItem = await screen.findByRole("menuitem", { name: /Co-op/ });
    expect(coopItem).toHaveAttribute("href", "/governance");
  });

  it("hides 'Co-op' link when user lacks stakeholder role", async () => {
    const user = userEvent.setup();
    mockUseSession.mockReturnValue(makeLoggedInSessionResult({ name: "Jane Doe" }));
    mockUseAuthExtras.mockReturnValue({ roles: [], isPatron: false });

    render(<NavBar />);

    await user.click(screen.getByLabelText("User menu"));

    // Wait for the menu to open, then confirm Co-op is absent
    await waitFor(() =>
      expect(screen.getByText("Log out")).toBeInTheDocument(),
    );
    expect(screen.queryByRole("menuitem", { name: /Co-op/ })).toBeNull();
  });

});
