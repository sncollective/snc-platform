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
  mockNavigate,
  mockUseSession,
  mockUseRoles,
  mockSignOut,
} = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
  mockUseSession: vi.fn(),
  mockUseRoles: vi.fn(),
  mockSignOut: vi.fn(),
}));

vi.mock("@tanstack/react-router", () =>
  createRouterMock({ useNavigate: () => mockNavigate }),
);

vi.mock("../../../src/lib/auth.js", () =>
  createAuthMock({ useSession: mockUseSession, useRoles: mockUseRoles }),
);

vi.mock("../../../src/lib/auth-client.js", () => ({
  authClient: { signOut: mockSignOut },
}));

// ── Import component under test (after mocks) ──

import { UserMenu } from "../../../src/components/layout/user-menu.js";

// ── Test Lifecycle ──

beforeEach(() => {
  mockUseSession.mockReturnValue(makeMockSessionResult());
  mockUseRoles.mockReturnValue([]);
  mockSignOut.mockResolvedValue(undefined);
});

// ── Tests ──

describe("UserMenu", () => {
  it("shows login and signup links when not authenticated", () => {
    mockUseSession.mockReturnValue({
      data: null,
      isPending: false,
      error: null,
    });

    render(<UserMenu />);

    expect(screen.getByRole("link", { name: "Log in" })).toHaveAttribute(
      "href",
      "/login",
    );
    expect(screen.getByRole("link", { name: "Sign up" })).toHaveAttribute(
      "href",
      "/register",
    );
  });

  it("shows user avatar when authenticated", () => {
    mockUseSession.mockReturnValue(
      makeLoggedInSessionResult({ name: "Jane Doe" }),
    );

    render(<UserMenu />);

    const button = screen.getByRole("button", { name: "User menu" });
    expect(button).toBeInTheDocument();
    expect(button).toHaveTextContent("JD");
  });

  it("toggles dropdown menu on avatar click", async () => {
    const user = userEvent.setup();
    mockUseSession.mockReturnValue(
      makeLoggedInSessionResult({ name: "Jane Doe" }),
    );

    render(<UserMenu />);

    expect(screen.queryByRole("menu")).toBeNull();

    await user.click(screen.getByLabelText("User menu"));

    expect(screen.getByRole("menu")).toBeInTheDocument();
  });

  it("shows 'Creator Settings' link for users with stakeholder role", async () => {
    const user = userEvent.setup();
    mockUseSession.mockReturnValue(
      makeLoggedInSessionResult({ name: "Jane Doe" }),
    );
    mockUseRoles.mockReturnValue(["stakeholder"]);

    render(<UserMenu />);

    await user.click(screen.getByLabelText("User menu"));

    const creatorSettingsLink = screen.getByRole("menuitem", {
      name: "Creator Settings",
    });
    expect(creatorSettingsLink).toHaveAttribute("href", "/settings/creator");
  });

  it("shows 'Creator Settings' link for admin role", async () => {
    const user = userEvent.setup();
    mockUseSession.mockReturnValue(
      makeLoggedInSessionResult({ name: "Jane Doe" }),
    );
    mockUseRoles.mockReturnValue(["admin"]);

    render(<UserMenu />);

    await user.click(screen.getByLabelText("User menu"));

    const creatorSettingsLink = screen.getByRole("menuitem", {
      name: "Creator Settings",
    });
    expect(creatorSettingsLink).toHaveAttribute("href", "/settings/creator");
  });

  it("hides 'Creator Settings' link for users without stakeholder or admin role", async () => {
    const user = userEvent.setup();
    mockUseSession.mockReturnValue(
      makeLoggedInSessionResult({ name: "Jane Doe" }),
    );
    mockUseRoles.mockReturnValue([]);

    render(<UserMenu />);

    await user.click(screen.getByLabelText("User menu"));

    expect(
      screen.queryByRole("menuitem", { name: "Creator Settings" }),
    ).toBeNull();
  });

  it("shows 'Dashboard' link for stakeholder role", async () => {
    const user = userEvent.setup();
    mockUseSession.mockReturnValue(
      makeLoggedInSessionResult({ name: "Jane Doe" }),
    );
    mockUseRoles.mockReturnValue(["stakeholder"]);

    render(<UserMenu />);

    await user.click(screen.getByLabelText("User menu"));

    const dashboardLink = screen.getByRole("menuitem", { name: "Dashboard" });
    expect(dashboardLink).toHaveAttribute("href", "/dashboard");
  });

  it("hides 'Dashboard' link for users without stakeholder role", async () => {
    const user = userEvent.setup();
    mockUseSession.mockReturnValue(
      makeLoggedInSessionResult({ name: "Jane Doe" }),
    );
    mockUseRoles.mockReturnValue([]);

    render(<UserMenu />);

    await user.click(screen.getByLabelText("User menu"));

    expect(
      screen.queryByRole("menuitem", { name: "Dashboard" }),
    ).toBeNull();
  });

  it("renders Settings, Subscriptions, and My Bookings links", async () => {
    const user = userEvent.setup();
    mockUseSession.mockReturnValue(
      makeLoggedInSessionResult({ name: "Jane Doe" }),
    );

    render(<UserMenu />);

    await user.click(screen.getByLabelText("User menu"));

    expect(screen.getByRole("menuitem", { name: "Settings" })).toHaveAttribute(
      "href",
      "/settings",
    );
    expect(
      screen.getByRole("menuitem", { name: "Subscriptions" }),
    ).toHaveAttribute("href", "/settings/subscriptions");
    expect(
      screen.getByRole("menuitem", { name: "My Bookings" }),
    ).toHaveAttribute("href", "/settings/bookings");
  });

  it("shows skeleton while session is pending and no serverAuth", () => {
    mockUseSession.mockReturnValue({
      data: null,
      isPending: true,
      error: null,
    });

    const { container } = render(<UserMenu />);

    const skeleton = container.querySelector("[aria-hidden='true']");
    expect(skeleton).toBeInTheDocument();
  });

  it("shows logged-out links when serverAuth confirms no user and session pending", () => {
    mockUseSession.mockReturnValue({
      data: null,
      isPending: true,
      error: null,
    });

    const serverAuth = {
      user: null,
      roles: [] as string[],
    };

    render(<UserMenu serverAuth={serverAuth} />);

    expect(screen.getByRole("link", { name: "Log in" })).toHaveAttribute(
      "href",
      "/login",
    );
    expect(screen.getByRole("link", { name: "Sign up" })).toHaveAttribute(
      "href",
      "/register",
    );
    expect(
      document.querySelector("[aria-hidden='true']"),
    ).not.toBeInTheDocument();
  });

  it("renders avatar immediately when serverAuth provided and session pending", () => {
    mockUseSession.mockReturnValue({
      data: null,
      isPending: true,
      error: null,
    });

    const serverAuth = {
      user: makeMockUser({ name: "Server User" }),
      roles: [] as string[],
    };

    render(<UserMenu serverAuth={serverAuth} />);

    const button = screen.getByRole("button", { name: "User menu" });
    expect(button).toBeInTheDocument();
    expect(button).toHaveTextContent("SU");
  });

  it("uses serverAuth roles for menu items when session pending", async () => {
    const user = userEvent.setup();
    mockUseSession.mockReturnValue({
      data: null,
      isPending: true,
      error: null,
    });

    const serverAuth = {
      user: makeMockUser({ name: "Server User" }),
      roles: ["stakeholder"] as string[],
    };

    render(<UserMenu serverAuth={serverAuth} />);

    await user.click(screen.getByLabelText("User menu"));

    const dashboardLink = screen.getByRole("menuitem", { name: "Dashboard" });
    expect(dashboardLink).toHaveAttribute("href", "/dashboard");
  });
});
