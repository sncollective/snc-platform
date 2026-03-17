import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

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
  mockUseRoles,
  mockSignOut,
} = vi.hoisted(() => ({
  mockUseRouterState: vi.fn(),
  mockNavigate: vi.fn(),
  mockUseSession: vi.fn(),
  mockUseRoles: vi.fn(),
  mockSignOut: vi.fn(),
}));

vi.mock("@tanstack/react-router", () =>
  createRouterMock({
    useNavigate: () => mockNavigate,
    useRouterState: mockUseRouterState,
  }),
);

vi.mock("../../../src/lib/auth.js", () =>
  createAuthMock({ useSession: mockUseSession, useRoles: mockUseRoles }),
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
  mockUseRoles.mockReturnValue([]);
});

// ── Tests ──

describe("NavBar", () => {
  it("renders logo linking to home", () => {
    render(<NavBar />);

    const logo = screen.getByRole("link", { name: "S/NC" });
    expect(logo).toHaveAttribute("href", "/");
  });

  it("renders all primary navigation links", () => {
    render(<NavBar />);

    const feedLink = screen.getByRole("link", { name: "Feed" });
    expect(feedLink).toHaveAttribute("href", "/feed");

    const creatorsLink = screen.getByRole("link", { name: "Creators" });
    expect(creatorsLink).toHaveAttribute("href", "/creators");

    const servicesLink = screen.getByRole("link", { name: "Services" });
    expect(servicesLink).toHaveAttribute("href", "/services");

    const merchLink = screen.getByRole("link", { name: "Merch" });
    expect(merchLink).toHaveAttribute("href", "/merch");
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
    mockUseRoles.mockReturnValue(["stakeholder"]);

    render(<NavBar />);

    await user.click(screen.getByLabelText("User menu"));

    const dashboardLink = screen.getByRole("menuitem", { name: "Dashboard" });
    expect(dashboardLink).toHaveAttribute("href", "/dashboard");
  });

  it("hides 'Dashboard' link when user lacks stakeholder role", async () => {
    const user = userEvent.setup();
    mockUseSession.mockReturnValue(makeLoggedInSessionResult({ name: "Jane Doe" }));
    mockUseRoles.mockReturnValue([]);

    render(<NavBar />);

    await user.click(screen.getByLabelText("User menu"));

    expect(screen.queryByRole("menuitem", { name: "Dashboard" })).toBeNull();
  });
});
