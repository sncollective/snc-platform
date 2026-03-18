import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

import { makeMockCreatorListItem } from "../../../helpers/creator-fixtures.js";
import { createRouterMock } from "../../../helpers/router-mock.js";

// ── Hoisted Mocks ──

vi.mock("@tanstack/react-router", () => createRouterMock());

// ── Import component under test (after mocks) ──

import { FeaturedCreators } from "../../../../src/components/landing/featured-creators.js";

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
      makeMockCreatorListItem({ id: "u1", displayName: "Alice" }),
      makeMockCreatorListItem({ id: "u2", displayName: "Bob" }),
      makeMockCreatorListItem({ id: "u3", displayName: "Carol" }),
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
