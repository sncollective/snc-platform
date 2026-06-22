import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";

import { extractRouteComponent } from "../../../../helpers/route-test-utils.js";
import { createRouterMock } from "../../../../helpers/router-mock.js";

// jsdom does not implement scrollIntoView — ContextShell's chip-bar effect calls it.
window.HTMLElement.prototype.scrollIntoView = vi.fn();

// ── Hoisted Mocks ──

const { mockUseLoaderData } = vi.hoisted(() => ({
  mockUseLoaderData: vi.fn(),
}));

vi.mock("@tanstack/react-router", () => {
  const base = createRouterMock({
    // ManageLayout renders <Outlet />; ContextShell reads the path via useRouterState.
    outlet: true,
    useRouterState: (opts?: { select?: (s: unknown) => unknown }) => {
      const state = { location: { pathname: "/creators/my-band/manage" } };
      return opts?.select ? opts.select(state) : state;
    },
  });
  base.createFileRoute = () => (routeOptions: Record<string, unknown>) => ({
    ...routeOptions,
    useLoaderData: mockUseLoaderData,
  });
  return base;
});

vi.mock("../../../../../src/components/layout/creator-switcher.js", () => ({
  CreatorSwitcher: () => <div data-testid="creator-switcher" />,
}));

vi.mock("../../../../../src/hooks/use-context-announcer.js", () => ({
  useContextAnnouncer: vi.fn(),
}));

vi.mock("../../../../../src/lib/config.js", () => ({
  // No feature flags gate the manage items under test.
  isFeatureEnabled: () => true,
}));

// ── Component Under Test ──

const ManageLayout = extractRouteComponent(
  () => import("../../../../../src/routes/creators/$creatorId/manage.js"),
);

// ── Helpers ──

const CREATOR = { id: "creator-123", handle: "my-band", displayName: "My Band" };

// ── Lifecycle ──

afterEach(() => {
  vi.restoreAllMocks();
});

beforeEach(() => {
  vi.clearAllMocks();
});

// ── Tests ──

describe("ManageLayout — Programming nav visibility", () => {
  it("shows the Programming nav item for an owner (manageStreaming = true)", () => {
    mockUseLoaderData.mockReturnValue({
      creator: CREATOR,
      memberRole: "owner",
      isAdmin: false,
      userId: "u1",
    });

    render(<ManageLayout />);

    // Dual-rendered (sidebar + mobile chip bar), so at least one link exists.
    expect(screen.getAllByRole("link", { name: "Programming" }).length).toBeGreaterThan(0);
  });

  it("shows the Programming nav item for a platform admin", () => {
    mockUseLoaderData.mockReturnValue({
      creator: CREATOR,
      memberRole: "viewer",
      isAdmin: true,
      userId: "u1",
    });

    render(<ManageLayout />);

    expect(screen.getAllByRole("link", { name: "Programming" }).length).toBeGreaterThan(0);
  });

  it("hides the Programming nav item for a viewer-role member", () => {
    mockUseLoaderData.mockReturnValue({
      creator: CREATOR,
      memberRole: "viewer",
      isAdmin: false,
      userId: "u1",
    });

    render(<ManageLayout />);

    expect(screen.queryByRole("link", { name: "Programming" })).toBeNull();
  });

  it("hides the Programming nav item for an editor-role member (manageStreaming = false)", () => {
    mockUseLoaderData.mockReturnValue({
      creator: CREATOR,
      memberRole: "editor",
      isAdmin: false,
      userId: "u1",
    });

    render(<ManageLayout />);

    expect(screen.queryByRole("link", { name: "Programming" })).toBeNull();
  });
});
