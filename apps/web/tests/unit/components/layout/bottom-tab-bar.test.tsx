import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

import { createRouterMock } from "../../../helpers/router-mock.js";

// ── Hoisted Mocks ──

const { mockUseRouterState } = vi.hoisted(() => ({
  mockUseRouterState: vi.fn(),
}));

vi.mock("@tanstack/react-router", () =>
  createRouterMock({ useRouterState: mockUseRouterState }),
);

// ── Import component under test (after mocks) ──

import { BottomTabBar } from "../../../../src/components/layout/bottom-tab-bar.js";

// ── Test Lifecycle ──

beforeEach(() => {
  mockUseRouterState.mockReturnValue({ location: { pathname: "/" } });
});

// ── Tests ──

describe("BottomTabBar", () => {
  it("renders 4 tab items: Home, Feed, Live, Creators", () => {
    render(<BottomTabBar />);

    expect(screen.getByRole("link", { name: /Home/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Feed/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Live/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Creators/i })).toBeInTheDocument();
  });

  it("has aria-label='Primary navigation' on the nav element", () => {
    render(<BottomTabBar />);

    expect(screen.getByRole("navigation", { name: "Primary navigation" })).toBeInTheDocument();
  });

  it("links have correct href attributes", () => {
    render(<BottomTabBar />);

    expect(screen.getByRole("link", { name: /Home/i })).toHaveAttribute("href", "/");
    expect(screen.getByRole("link", { name: /Feed/i })).toHaveAttribute("href", "/feed");
    expect(screen.getByRole("link", { name: /Live/i })).toHaveAttribute("href", "/live");
    expect(screen.getByRole("link", { name: /Creators/i })).toHaveAttribute("href", "/creators");
  });

  it("Home tab is active on /", () => {
    mockUseRouterState.mockReturnValue({ location: { pathname: "/" } });

    render(<BottomTabBar />);

    expect(screen.getByRole("link", { name: /Home/i })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: /Feed/i })).not.toHaveAttribute("aria-current");
    expect(screen.getByRole("link", { name: /Live/i })).not.toHaveAttribute("aria-current");
    expect(screen.getByRole("link", { name: /Creators/i })).not.toHaveAttribute("aria-current");
  });

  it("Feed tab is active on /feed", () => {
    mockUseRouterState.mockReturnValue({ location: { pathname: "/feed" } });

    render(<BottomTabBar />);

    expect(screen.getByRole("link", { name: /Feed/i })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: /Home/i })).not.toHaveAttribute("aria-current");
  });

  it("Feed tab is active on sub-path /feed/something", () => {
    mockUseRouterState.mockReturnValue({ location: { pathname: "/feed/something" } });

    render(<BottomTabBar />);

    expect(screen.getByRole("link", { name: /Feed/i })).toHaveAttribute("aria-current", "page");
  });

  it("Creators tab is active on /creators/some-id", () => {
    mockUseRouterState.mockReturnValue({ location: { pathname: "/creators/some-id" } });

    render(<BottomTabBar />);

    expect(screen.getByRole("link", { name: /Creators/i })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: /Home/i })).not.toHaveAttribute("aria-current");
  });

  it("Home tab is not active on /feed (exact match required)", () => {
    mockUseRouterState.mockReturnValue({ location: { pathname: "/feed" } });

    render(<BottomTabBar />);

    expect(screen.getByRole("link", { name: /Home/i })).not.toHaveAttribute("aria-current");
  });

  it("no tab is active on an unmatched path like /settings", () => {
    mockUseRouterState.mockReturnValue({ location: { pathname: "/settings" } });

    render(<BottomTabBar />);

    expect(screen.getByRole("link", { name: /Home/i })).not.toHaveAttribute("aria-current");
    expect(screen.getByRole("link", { name: /Feed/i })).not.toHaveAttribute("aria-current");
    expect(screen.getByRole("link", { name: /Live/i })).not.toHaveAttribute("aria-current");
    expect(screen.getByRole("link", { name: /Creators/i })).not.toHaveAttribute("aria-current");
  });

  it("renders a More tab that opens the overflow sheet", () => {
    render(<BottomTabBar />);

    const moreTab = screen.getByRole("button", { name: "More navigation" });
    expect(moreTab).toBeInTheDocument();
    expect(moreTab).toHaveAttribute("aria-haspopup", "dialog");
    expect(moreTab).toHaveAttribute("aria-expanded", "false");
  });

  it("More tab becomes active on overflow paths like /studio, /merch, /emissions", () => {
    for (const path of ["/studio", "/merch", "/emissions"]) {
      mockUseRouterState.mockReturnValue({ location: { pathname: path } });
      const { unmount } = render(<BottomTabBar />);

      const moreTab = screen.getByRole("button", { name: "More navigation" });
      // Active state is encoded via styles.tabActive class; the button doesn't
      // carry aria-current because it's not a page link. Verify via className.
      expect(moreTab.className).toMatch(/tabActive/);

      unmount();
    }
  });
});
