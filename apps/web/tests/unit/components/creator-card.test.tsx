import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

import { createRouterMock } from "../../helpers/router-mock.js";

// ── Hoisted Mocks ──

vi.mock("@tanstack/react-router", () => createRouterMock());

// ── Import component under test (after mocks) ──

import { CreatorCard } from "../../../src/components/creator/creator-card.js";
import { makeMockCreatorListItem } from "../../helpers/creator-fixtures.js";

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
      "/api/creators/user_test123/avatar",
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
    const creator = makeMockCreatorListItem({ id: "creator-42" });

    render(<CreatorCard creator={creator} />);

    const link = screen.getByRole("link", { name: /Test Creator/ });
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

  it("renders manage link when canManage is true", () => {
    const creator = makeMockCreatorListItem({
      id: "creator-99",
      canManage: true,
    });

    render(<CreatorCard creator={creator} />);

    const manageLink = screen.getByRole("link", { name: "Manage" });
    expect(manageLink).toBeInTheDocument();
    expect(manageLink).toHaveAttribute("href", "/creators/creator-99/manage");
  });

  it("does not render manage link when canManage is undefined", () => {
    const creator = makeMockCreatorListItem();

    render(<CreatorCard creator={creator} />);

    expect(screen.queryByRole("link", { name: "Manage" })).toBeNull();
  });

  it("does not render manage link when canManage is false", () => {
    const creator = makeMockCreatorListItem({ canManage: false });

    render(<CreatorCard creator={creator} />);

    expect(screen.queryByRole("link", { name: "Manage" })).toBeNull();
  });

  it("renders subscribed star when isSubscribed is true", () => {
    const creator = makeMockCreatorListItem({ isSubscribed: true });
    render(<CreatorCard creator={creator} />);
    expect(screen.getByLabelText("Subscribed")).toBeInTheDocument();
    expect(screen.getByText("★")).toBeInTheDocument();
  });

  it("does not render star when isSubscribed is false", () => {
    const creator = makeMockCreatorListItem({ isSubscribed: false });
    render(<CreatorCard creator={creator} />);
    expect(screen.queryByLabelText("Subscribed")).toBeNull();
  });

  it("does not render star when isSubscribed is undefined", () => {
    const creator = makeMockCreatorListItem();
    render(<CreatorCard creator={creator} />);
    expect(screen.queryByLabelText("Subscribed")).toBeNull();
  });

  it("renders list view layout when viewMode is list", () => {
    const creator = makeMockCreatorListItem();
    const { container } = render(<CreatorCard creator={creator} viewMode="list" />);
    expect(container.querySelector('[class*="listItem"]')).not.toBeNull();
    expect(container.querySelector('[class*="card"]')).toBeNull();
  });

  it("renders grid view layout by default", () => {
    const creator = makeMockCreatorListItem();
    const { container } = render(<CreatorCard creator={creator} />);
    expect(container.querySelector('[class*="card"]')).not.toBeNull();
    expect(container.querySelector('[class*="listItem"]')).toBeNull();
  });

  it("renders stakeholder KPIs in list view", () => {
    const creator = makeMockCreatorListItem({
      subscriberCount: 42,
      lastPublishedAt: "2026-03-15T00:00:00.000Z",
    });
    render(<CreatorCard creator={creator} viewMode="list" />);
    expect(screen.getByText("42 subscribers")).toBeInTheDocument();
  });

  it("still links to detail page when manage link is present", () => {
    const creator = makeMockCreatorListItem({
      id: "creator-77",
      canManage: true,
    });

    render(<CreatorCard creator={creator} />);

    const detailLink = screen.getByRole("link", { name: /Test Creator/ });
    expect(detailLink).toHaveAttribute("href", "/creators/creator-77");

    const manageLink = screen.getByRole("link", { name: "Manage" });
    expect(manageLink).toHaveAttribute("href", "/creators/creator-77/manage");
  });
});
