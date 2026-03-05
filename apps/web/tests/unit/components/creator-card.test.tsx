import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";

// ── Hoisted Mocks ──

vi.mock("@tanstack/react-router", async () => {
  const React = await import("react");
  return {
    Link: ({
      to,
      params,
      children,
      className,
    }: Record<string, unknown>) =>
      React.createElement(
        "a",
        {
          href:
            typeof params === "object" && params !== null
              ? (to as string).replace(
                  "$creatorId",
                  (params as Record<string, string>).creatorId!,
                )
              : (to as string),
          className,
        },
        children as React.ReactNode,
      ),
  };
});

// ── Import component under test (after mocks) ──

import { CreatorCard } from "../../../src/components/creator/creator-card.js";
import { makeMockCreatorListItem } from "../../helpers/creator-fixtures.js";

afterEach(() => {
  vi.restoreAllMocks();
});

// ── Tests ──

describe("CreatorCard", () => {
  it("renders display name and bio", () => {
    const creator = makeMockCreatorListItem({
      displayName: "Alice Music",
      bio: "I make ambient music and soundscapes",
    });

    render(<CreatorCard creator={creator} />);

    expect(screen.getByText("Alice Music")).toBeInTheDocument();
    expect(
      screen.getByText("I make ambient music and soundscapes"),
    ).toBeInTheDocument();
  });

  it("renders avatar image when avatarUrl is present", () => {
    const creator = makeMockCreatorListItem({
      displayName: "Alice Music",
      avatarUrl: "/api/creators/user_test123/avatar",
    });

    render(<CreatorCard creator={creator} />);

    const img = screen.getByRole("img", { name: "Alice Music avatar" });
    expect(img).toHaveAttribute(
      "src",
      "http://localhost:3000/api/creators/user_test123/avatar",
    );
  });

  it("renders placeholder when avatarUrl is null", () => {
    const creator = makeMockCreatorListItem({ avatarUrl: null });

    render(<CreatorCard creator={creator} />);

    expect(screen.queryByRole("img")).toBeNull();
  });

  it("renders content count with plural form", () => {
    const creator = makeMockCreatorListItem({ contentCount: 12 });

    render(<CreatorCard creator={creator} />);

    expect(screen.getByText("12 posts")).toBeInTheDocument();
  });

  it("renders content count with singular form", () => {
    const creator = makeMockCreatorListItem({ contentCount: 1 });

    render(<CreatorCard creator={creator} />);

    expect(screen.getByText("1 post")).toBeInTheDocument();
  });

  it("links to the creator detail page", () => {
    const creator = makeMockCreatorListItem({ userId: "creator-42" });

    render(<CreatorCard creator={creator} />);

    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "/creators/creator-42");
  });

  it("does not render bio when bio is null", () => {
    const creator = makeMockCreatorListItem({
      displayName: "No Bio Creator",
      bio: null,
    });

    render(<CreatorCard creator={creator} />);

    expect(screen.getByText("No Bio Creator")).toBeInTheDocument();
    // Only display name and content count should be in the info section
    expect(screen.queryByText("A test creator bio")).toBeNull();
  });
});
