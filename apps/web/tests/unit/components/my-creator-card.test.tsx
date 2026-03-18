import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

import { createRouterMock } from "../../helpers/router-mock.js";

// ── Hoisted Mocks ──

vi.mock("@tanstack/react-router", () => createRouterMock());

// ── Import component under test (after mocks) ──

import { MyCreatorCard } from "../../../src/components/creator/my-creator-card.js";
import { makeMockMyCreatorItem } from "../../helpers/creator-fixtures.js";

// ── Tests ──

describe("MyCreatorCard", () => {
  it("renders creator name, bio, and content count", () => {
    const creator = makeMockMyCreatorItem({
      displayName: "Alice Music",
      bio: "I make ambient music",
      contentCount: 7,
    });

    render(<MyCreatorCard creator={creator} />);

    expect(screen.getByText("Alice Music")).toBeInTheDocument();
    expect(screen.getByText("I make ambient music")).toBeInTheDocument();
    expect(screen.getByText("7 posts")).toBeInTheDocument();
  });

  it("renders singular post count", () => {
    const creator = makeMockMyCreatorItem({ contentCount: 1 });

    render(<MyCreatorCard creator={creator} />);

    expect(screen.getByText("1 post")).toBeInTheDocument();
  });

  it("does not render bio when bio is null", () => {
    const creator = makeMockMyCreatorItem({ bio: null, displayName: "No Bio Creator" });

    render(<MyCreatorCard creator={creator} />);

    expect(screen.getByText("No Bio Creator")).toBeInTheDocument();
    expect(screen.queryByText("A test creator bio")).toBeNull();
  });

  it("shows role badge with correct text for owner", () => {
    const creator = makeMockMyCreatorItem({ memberRole: "owner" });

    render(<MyCreatorCard creator={creator} />);

    expect(screen.getByText("owner")).toBeInTheDocument();
  });

  it("shows role badge with correct text for editor", () => {
    const creator = makeMockMyCreatorItem({ memberRole: "editor" });

    render(<MyCreatorCard creator={creator} />);

    expect(screen.getByText("editor")).toBeInTheDocument();
  });

  it("shows role badge with correct text for viewer", () => {
    const creator = makeMockMyCreatorItem({ memberRole: "viewer" });

    render(<MyCreatorCard creator={creator} />);

    expect(screen.getByText("viewer")).toBeInTheDocument();
  });

  it("name links to the public creator page", () => {
    const creator = makeMockMyCreatorItem({ id: "creator-42", displayName: "Alice Music" });

    render(<MyCreatorCard creator={creator} />);

    const nameLink = screen.getByRole("link", { name: "Alice Music" });
    expect(nameLink).toHaveAttribute("href", "/creators/creator-42");
  });

  it("manage link navigates to /creators/$creatorId/manage", () => {
    const creator = makeMockMyCreatorItem({ id: "creator-42" });

    render(<MyCreatorCard creator={creator} />);

    const manageLink = screen.getByRole("link", { name: "Manage" });
    expect(manageLink).toHaveAttribute("href", "/creators/creator-42/manage");
  });

  it("card is a div — no nested anchor tags inside the outer element", () => {
    const creator = makeMockMyCreatorItem({ id: "creator-42", displayName: "Alice Music" });

    const { container } = render(<MyCreatorCard creator={creator} />);

    // The outermost element should be a div
    const card = container.firstElementChild;
    expect(card?.tagName).toBe("DIV");

    // Both links should be direct children or descendants — none nested inside another <a>
    const allLinks = container.querySelectorAll("a");
    for (const link of allLinks) {
      const parentAnchor = link.parentElement?.closest("a");
      expect(parentAnchor).toBeNull();
    }
  });

  it("renders avatar image when avatarUrl is present", () => {
    const creator = makeMockMyCreatorItem({
      displayName: "Alice Music",
      avatarUrl: "/api/creators/user_test123/avatar",
    });

    render(<MyCreatorCard creator={creator} />);

    const img = screen.getByRole("img", { name: "Alice Music avatar" });
    expect(img).toHaveAttribute("src", "/api/creators/user_test123/avatar");
  });

  it("renders placeholder when avatarUrl is null", () => {
    const creator = makeMockMyCreatorItem({ avatarUrl: null });

    render(<MyCreatorCard creator={creator} />);

    expect(screen.queryByRole("img")).toBeNull();
  });
});
