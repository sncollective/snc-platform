import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
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
  mockNavigate,
  mockUseSession,
  mockUseAuthExtras,
  mockSignOut,
} = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
  mockUseSession: vi.fn(),
  mockUseAuthExtras: vi.fn(),
  mockSignOut: vi.fn(),
}));

vi.mock("@tanstack/react-router", () =>
  createRouterMock({ useNavigate: () => mockNavigate }),
);

vi.mock("../../../src/lib/auth.js", () =>
  createAuthMock({ useSession: mockUseSession, useAuthExtras: mockUseAuthExtras }),
);

vi.mock("../../../src/lib/auth-client.js", () => ({
  authClient: { signOut: mockSignOut },
}));

// ── Import component under test (after mocks) ──

import { UserMenu } from "../../../src/components/layout/user-menu.js";

// ── Test Lifecycle ──

beforeEach(() => {
  mockUseSession.mockReturnValue(makeMockSessionResult());
  mockUseAuthExtras.mockReturnValue({ roles: [], isPatron: false });
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

  it("opens dropdown menu on avatar click", async () => {
    const user = userEvent.setup();
    mockUseSession.mockReturnValue(
      makeLoggedInSessionResult({ name: "Jane Doe" }),
    );

    render(<UserMenu />);

    // The menu content is in the Portal from the start — verify it's initially closed
    const menuContent = document.querySelector("[data-scope='menu'][data-part='content']");
    expect(menuContent).not.toHaveAttribute("data-state", "open");

    await user.click(screen.getByLabelText("User menu"));

    await waitFor(() => {
      const openMenu = document.querySelector("[data-scope='menu'][data-part='content']");
      expect(openMenu).toHaveAttribute("data-state", "open");
    });
  });

  it("does not show 'Creator Settings' link", async () => {
    const user = userEvent.setup();
    mockUseSession.mockReturnValue(
      makeLoggedInSessionResult({ name: "Jane Doe" }),
    );
    mockUseAuthExtras.mockReturnValue({ roles: ["stakeholder", "admin"], isPatron: false });

    render(<UserMenu />);

    await user.click(screen.getByLabelText("User menu"));

    // Wait for the menu to open, then assert the link is absent
    await waitFor(() =>
      expect(screen.getByText("Log out")).toBeInTheDocument(),
    );
    expect(
      screen.queryByText("Creator Settings"),
    ).toBeNull();
  });

  it("shows patron badge when isPatron is true", async () => {
    const user = userEvent.setup();
    mockUseSession.mockReturnValue(
      makeLoggedInSessionResult({ name: "Jane Doe" }),
    );
    mockUseAuthExtras.mockReturnValue({ roles: [], isPatron: true });

    render(<UserMenu />);

    await user.click(screen.getByLabelText("User menu"));

    await waitFor(() =>
      expect(screen.getByLabelText("Patron")).toBeInTheDocument(),
    );
  });

  it("hides patron badge when isPatron is false", async () => {
    const user = userEvent.setup();
    mockUseSession.mockReturnValue(
      makeLoggedInSessionResult({ name: "Jane Doe" }),
    );
    mockUseAuthExtras.mockReturnValue({ roles: [], isPatron: false });

    render(<UserMenu />);

    await user.click(screen.getByLabelText("User menu"));

    // Wait for the menu to open, then confirm patron badge is absent
    await waitFor(() =>
      expect(screen.getByText("Log out")).toBeInTheDocument(),
    );
    expect(screen.queryByLabelText("Patron")).toBeNull();
  });

  it("shows 'Co-op' link for stakeholder role", async () => {
    const user = userEvent.setup();
    mockUseSession.mockReturnValue(
      makeLoggedInSessionResult({ name: "Jane Doe" }),
    );
    mockUseAuthExtras.mockReturnValue({ roles: ["stakeholder"], isPatron: false });

    render(<UserMenu />);

    await user.click(screen.getByLabelText("User menu"));

    // MenuItem with asChild renders as role="menuitem"; check href attribute directly
    const coopItem = await screen.findByRole("menuitem", { name: /Co-op/ });
    expect(coopItem).toHaveAttribute("href", "/governance");
  });

  it("hides 'Co-op' link for users without stakeholder role", async () => {
    const user = userEvent.setup();
    mockUseSession.mockReturnValue(
      makeLoggedInSessionResult({ name: "Jane Doe" }),
    );
    mockUseAuthExtras.mockReturnValue({ roles: [], isPatron: false });

    render(<UserMenu />);

    await user.click(screen.getByLabelText("User menu"));

    // Wait for menu to open, then confirm Co-op is absent
    await waitFor(() =>
      expect(screen.getByText("Log out")).toBeInTheDocument(),
    );
    expect(
      screen.queryByRole("menuitem", { name: /Co-op/ }),
    ).toBeNull();
  });

  it("renders Settings, Notifications, and Subscriptions links (My Bookings removed)", async () => {
    const user = userEvent.setup();
    mockUseSession.mockReturnValue(
      makeLoggedInSessionResult({ name: "Jane Doe" }),
    );

    render(<UserMenu />);

    await user.click(screen.getByLabelText("User menu"));

    // MenuItem with asChild renders as role="menuitem" (Ark overrides role)
    const settingsItem = await screen.findByRole("menuitem", { name: /Settings/ });
    expect(settingsItem).toHaveAttribute("href", "/settings");
    const notificationsItem = await screen.findByRole("menuitem", { name: /Notifications/ });
    expect(notificationsItem).toHaveAttribute("href", "/settings/notifications");
    const subsItem = await screen.findByRole("menuitem", { name: /Subscriptions/ });
    expect(subsItem).toHaveAttribute("href", "/settings/subscriptions");
    expect(screen.queryByRole("menuitem", { name: /My Bookings/ })).toBeNull();
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
      roles: [] as Role[],
      isPatron: false,
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
      roles: [] as Role[],
      isPatron: false,
    };

    render(<UserMenu serverAuth={serverAuth} />);

    const button = screen.getByRole("button", { name: "User menu" });
    expect(button).toBeInTheDocument();
    expect(button).toHaveTextContent("SU");
  });

  it("renders patron avatar ring when user is patron", () => {
    mockUseSession.mockReturnValue(
      makeLoggedInSessionResult({ name: "Patron User" }),
    );
    mockUseAuthExtras.mockReturnValue({ roles: [], isPatron: true });

    render(<UserMenu />);

    const avatar = screen.getByText("PU");
    expect(avatar.className).toContain("patronAvatar");
  });

  it("does not render patron avatar ring for non-patron", () => {
    mockUseSession.mockReturnValue(
      makeLoggedInSessionResult({ name: "Regular User" }),
    );
    mockUseAuthExtras.mockReturnValue({ roles: [], isPatron: false });

    render(<UserMenu />);

    const avatar = screen.getByText("RU");
    expect(avatar.className).not.toContain("patronAvatar");
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
      roles: ["stakeholder"] as Role[],
      isPatron: false,
    };

    render(<UserMenu serverAuth={serverAuth} />);

    await user.click(screen.getByLabelText("User menu"));

    const coopItem = await screen.findByRole("menuitem", { name: /Co-op/ });
    expect(coopItem).toHaveAttribute("href", "/governance");
  });
});
