import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";

import { makeMockCreatorListItem } from "../../../helpers/creator-fixtures.js";

// ── Hoisted Mocks ──

vi.mock("@tanstack/react-router", async () => {
  const React = await import("react");
  return {
    Link: ({ to, children, className, ...rest }: Record<string, unknown>) =>
      React.createElement(
        "a",
        { href: to as string, className, ...rest },
        children as React.ReactNode,
      ),
  };
});

// ── Import component under test (after mocks) ──

import { FeaturedCreators } from "../../../../src/components/landing/featured-creators.js";

// ── Lifecycle ──

afterEach(() => {
  vi.restoreAllMocks();
});

// ── Tests ──

describe("FeaturedCreators", () => {
  it("renders section heading 'Featured Creators'", () => {
    render(
      <FeaturedCreators creators={[makeMockCreatorListItem()]} />,
    );

    expect(
      screen.getByRole("heading", { level: 2, name: "Featured Creators" }),
    ).toBeInTheDocument();
  });

  it("renders creator cards from passed data", () => {
    const creators = [
      makeMockCreatorListItem({ userId: "u1", displayName: "Alice" }),
      makeMockCreatorListItem({ userId: "u2", displayName: "Bob" }),
      makeMockCreatorListItem({ userId: "u3", displayName: "Carol" }),
    ];

    render(<FeaturedCreators creators={creators} />);

    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("Bob")).toBeInTheDocument();
    expect(screen.getByText("Carol")).toBeInTheDocument();
  });

  it("scroll container has role='region' and aria-label", () => {
    render(
      <FeaturedCreators creators={[makeMockCreatorListItem()]} />,
    );

    const region = screen.getByRole("region", {
      name: "Featured creators",
    });
    expect(region).toBeInTheDocument();
  });

  it("shows empty message when creators array is empty", () => {
    render(<FeaturedCreators creators={[]} />);

    expect(screen.getByText(/No creators yet/)).toBeInTheDocument();
  });
});
