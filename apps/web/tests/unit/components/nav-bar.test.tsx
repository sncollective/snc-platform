import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import type { Role } from "@snc/shared";

import {
  makeMockUser,
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

  it("renders Studio as external link with correct href and target", () => {
    render(<NavBar />);

    const studioLink = screen.getByRole("link", { name: "Studio" });
    expect(studioLink).toHaveAttribute("href", "https://s-nc.org/studio");
    expect(studioLink).toHaveAttribute("target", "_blank");
    expect(studioLink).toHaveAttribute("rel", "noopener noreferrer");
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

  it("shows 'Dashboard' link when user has stakeholder role", async () => {
    const user = userEvent.setup();
    mockUseSession.mockReturnValue(makeLoggedInSessionResult({ name: "Jane Doe" }));
    mockUseAuthExtras.mockReturnValue({ roles: ["stakeholder"], isPatron: false });

    render(<NavBar />);

    await user.click(screen.getByLabelText("User menu"));

    const dashboardLink = screen.getByRole("menuitem", { name: "Dashboard" });
    expect(dashboardLink).toHaveAttribute("href", "/dashboard");
  });

  it("hides 'Dashboard' link when user lacks stakeholder role", async () => {
    const user = userEvent.setup();
    mockUseSession.mockReturnValue(makeLoggedInSessionResult({ name: "Jane Doe" }));
    mockUseAuthExtras.mockReturnValue({ roles: [], isPatron: false });

    render(<NavBar />);

    await user.click(screen.getByLabelText("User menu"));

    expect(screen.queryByRole("menuitem", { name: "Dashboard" })).toBeNull();
  });

  it("shows 'My Creators' link in nav for stakeholder", () => {
    mockUseSession.mockReturnValue(makeLoggedInSessionResult({ name: "Jane Doe" }));
    mockUseAuthExtras.mockReturnValue({ roles: ["stakeholder"], isPatron: false });

    render(<NavBar />);

    const myCreatorsLink = screen.getByRole("link", { name: "My Creators" });
    expect(myCreatorsLink).toHaveAttribute("href", "/creators/mine");
  });

  it("hides 'My Creators' link in nav for unauthenticated user", () => {
    mockUseSession.mockReturnValue({ data: null, isPending: false, error: null });
    mockUseAuthExtras.mockReturnValue({ roles: [], isPatron: false });

    render(<NavBar />);

    expect(screen.queryByRole("link", { name: "My Creators" })).toBeNull();
  });

  it("shows 'My Creators' link in nav for admin", () => {
    mockUseSession.mockReturnValue(makeLoggedInSessionResult({ name: "Admin User" }));
    mockUseAuthExtras.mockReturnValue({ roles: ["admin"], isPatron: false });

    render(<NavBar />);

    const myCreatorsLink = screen.getByRole("link", { name: "My Creators" });
    expect(myCreatorsLink).toHaveAttribute("href", "/creators/mine");
  });

  it("uses serverAuth roles for nav links when session pending", () => {
    mockUseSession.mockReturnValue({ data: null, isPending: true, error: null });
    mockUseAuthExtras.mockReturnValue({ roles: [], isPatron: false });

    const serverAuth = {
      user: makeMockUser({ name: "Server User" }),
      roles: ["stakeholder"] as Role[],
      isPatron: false,
    };

    render(<NavBar serverAuth={serverAuth} />);

    const myCreatorsLink = screen.getByRole("link", { name: "My Creators" });
    expect(myCreatorsLink).toHaveAttribute("href", "/creators/mine");
  });
});
