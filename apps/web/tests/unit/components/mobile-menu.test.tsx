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
  mockUseSession,
  mockUseAuthExtras,
} = vi.hoisted(() => ({
  mockUseSession: vi.fn(),
  mockUseAuthExtras: vi.fn(),
}));

vi.mock("@tanstack/react-router", () => createRouterMock());

vi.mock("../../../src/lib/auth.js", () =>
  createAuthMock({ useSession: mockUseSession, useAuthExtras: mockUseAuthExtras }),
);

vi.mock("../../../src/lib/auth-client.js", () => ({
  authClient: { signOut: vi.fn().mockResolvedValue(undefined) },
}));

// ── Import component under test (after mocks) ──

import { MobileMenu } from "../../../src/components/layout/mobile-menu.js";

// ── Test Lifecycle ──

beforeEach(() => {
  mockUseSession.mockReturnValue(makeMockSessionResult());
  mockUseAuthExtras.mockReturnValue({ roles: [], isPatron: false });
});

// ── Helper ──

async function openMenu() {
  const user = userEvent.setup();
  await user.click(screen.getByLabelText("Open menu"));
  return user;
}

// ── Tests ──

describe("MobileMenu", () => {
  it("renders hamburger button", () => {
    render(<MobileMenu currentPath="/" />);

    expect(screen.getByLabelText("Open menu")).toBeInTheDocument();
  });

  it("opens menu on hamburger click", async () => {
    render(<MobileMenu currentPath="/" />);

    expect(screen.queryByRole("navigation", { name: "Mobile navigation" })).toBeNull();

    await openMenu();

    expect(screen.getByRole("navigation", { name: "Mobile navigation" })).toBeInTheDocument();
  });

  it("renders primary nav links when menu is open", async () => {
    render(<MobileMenu currentPath="/" />);

    await openMenu();

    expect(screen.getByRole("link", { name: "Feed" })).toHaveAttribute("href", "/feed");
    expect(screen.getByRole("link", { name: "Creators" })).toHaveAttribute("href", "/creators");
    expect(screen.getByRole("link", { name: "Merch" })).toHaveAttribute("href", "/merch");
  });

  it("renders Studio as internal link", async () => {
    render(<MobileMenu currentPath="/" />);

    await openMenu();

    const studioLink = screen.getByRole("link", { name: "Studio" });
    expect(studioLink).toHaveAttribute("href", "/studio");
    expect(studioLink).not.toHaveAttribute("target");
    expect(studioLink).not.toHaveAttribute("rel");
  });

  it("shows Co-op link for stakeholder (bug fix verification)", async () => {
    mockUseSession.mockReturnValue(makeLoggedInSessionResult({ name: "Jane Doe" }));
    mockUseAuthExtras.mockReturnValue({ roles: ["stakeholder"], isPatron: false });

    render(<MobileMenu currentPath="/" />);

    await openMenu();

    const coopLink = screen.getByRole("link", { name: "Co-op" });
    expect(coopLink).toHaveAttribute("href", "/governance");
  });

  it("hides Co-op link for user without stakeholder role", async () => {
    mockUseSession.mockReturnValue(makeLoggedInSessionResult({ name: "Jane Doe" }));
    mockUseAuthExtras.mockReturnValue({ roles: [], isPatron: false });

    render(<MobileMenu currentPath="/" />);

    await openMenu();

    expect(screen.queryByRole("link", { name: "Co-op" })).toBeNull();
  });

  it("hides Co-op link when not authenticated", async () => {
    mockUseSession.mockReturnValue({ data: null, isPending: false, error: null });
    mockUseAuthExtras.mockReturnValue({ roles: [], isPatron: false });

    render(<MobileMenu currentPath="/" />);

    await openMenu();

    expect(screen.queryByRole("link", { name: "Co-op" })).toBeNull();
  });

  it("shows Files link for stakeholder", async () => {
    mockUseSession.mockReturnValue(makeLoggedInSessionResult({ name: "Jane Doe" }));
    mockUseAuthExtras.mockReturnValue({ roles: ["stakeholder"], isPatron: false });

    render(<MobileMenu currentPath="/" />);

    await openMenu();

    const filesLink = screen.getByRole("link", { name: "Files" });
    expect(filesLink).toHaveAttribute("href", "https://files.s-nc.org");
    expect(filesLink).toHaveAttribute("target", "_blank");
  });

  it("hides Files link for user without stakeholder role", async () => {
    mockUseSession.mockReturnValue(makeLoggedInSessionResult({ name: "Jane Doe" }));
    mockUseAuthExtras.mockReturnValue({ roles: [], isPatron: false });

    render(<MobileMenu currentPath="/" />);

    await openMenu();

    expect(screen.queryByRole("link", { name: "Files" })).toBeNull();
  });

  it("hides Files link when not authenticated", async () => {
    mockUseSession.mockReturnValue({ data: null, isPending: false, error: null });
    mockUseAuthExtras.mockReturnValue({ roles: [], isPatron: false });

    render(<MobileMenu currentPath="/" />);

    await openMenu();

    expect(screen.queryByRole("link", { name: "Files" })).toBeNull();
  });

  it("shows Admin link for admin role", async () => {
    mockUseSession.mockReturnValue(makeLoggedInSessionResult({ name: "Jane Doe" }));
    mockUseAuthExtras.mockReturnValue({ roles: ["admin"], isPatron: false });

    render(<MobileMenu currentPath="/" />);

    await openMenu();

    expect(screen.getByRole("link", { name: "Admin" })).toHaveAttribute("href", "/admin");
  });

  it("hides Admin link for non-admin", async () => {
    mockUseSession.mockReturnValue(makeLoggedInSessionResult({ name: "Jane Doe" }));
    mockUseAuthExtras.mockReturnValue({ roles: ["stakeholder"], isPatron: false });

    render(<MobileMenu currentPath="/" />);

    await openMenu();

    expect(screen.queryByRole("link", { name: "Admin" })).toBeNull();
  });

  it("does not show a separate Projects link for stakeholder (merged into Co-op)", async () => {
    mockUseSession.mockReturnValue(makeLoggedInSessionResult({ name: "Jane Doe" }));
    mockUseAuthExtras.mockReturnValue({ roles: ["stakeholder"], isPatron: false });

    render(<MobileMenu currentPath="/" />);

    await openMenu();

    expect(screen.queryByRole("link", { name: "Projects" })).toBeNull();
  });

  it("shows Subscriptions when authenticated (My Bookings removed)", async () => {
    mockUseSession.mockReturnValue(makeLoggedInSessionResult({ name: "Jane Doe" }));
    mockUseAuthExtras.mockReturnValue({ roles: [], isPatron: false });

    render(<MobileMenu currentPath="/" />);

    await openMenu();

    expect(screen.getByRole("link", { name: "Subscriptions" })).toHaveAttribute("href", "/settings/subscriptions");
    expect(screen.queryByRole("link", { name: "My Bookings" })).toBeNull();
  });

  it("hides Subscriptions and My Bookings when not authenticated", async () => {
    mockUseSession.mockReturnValue({ data: null, isPending: false, error: null });
    mockUseAuthExtras.mockReturnValue({ roles: [], isPatron: false });

    render(<MobileMenu currentPath="/" />);

    await openMenu();

    expect(screen.queryByRole("link", { name: "Subscriptions" })).toBeNull();
    expect(screen.queryByRole("link", { name: "My Bookings" })).toBeNull();
  });

  it("shows Log in and Sign up when not authenticated", async () => {
    mockUseSession.mockReturnValue({ data: null, isPending: false, error: null });

    render(<MobileMenu currentPath="/" />);

    await openMenu();

    expect(screen.getByRole("link", { name: "Log in" })).toHaveAttribute("href", "/login");
    expect(screen.getByRole("link", { name: "Sign up" })).toHaveAttribute("href", "/register");
  });

  it("shows Settings and Log out when authenticated", async () => {
    mockUseSession.mockReturnValue(makeLoggedInSessionResult({ name: "Jane Doe" }));

    render(<MobileMenu currentPath="/" />);

    await openMenu();

    expect(screen.getByRole("link", { name: "Settings" })).toHaveAttribute("href", "/settings");
    expect(screen.getByRole("button", { name: "Log out" })).toBeInTheDocument();
  });

});
