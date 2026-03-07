import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";

import { makeMockFeedItem } from "../../../helpers/content-fixtures.js";
import { createRouterMock } from "../../../helpers/router-mock.js";

// ── Hoisted Mocks ──

vi.mock("@tanstack/react-router", () => createRouterMock());

// ── Import component under test (after mocks) ──

import { RecentContent } from "../../../../src/components/landing/recent-content.js";

// ── Lifecycle ──

afterEach(() => {
  vi.restoreAllMocks();
});

// ── Tests ──

describe("RecentContent", () => {
  it("renders section heading 'Recent Content'", () => {
    render(<RecentContent items={[makeMockFeedItem()]} />);

    expect(
      screen.getByRole("heading", { level: 2, name: "Recent Content" }),
    ).toBeInTheDocument();
  });

  it("renders content cards from passed data", () => {
    const items = [
      makeMockFeedItem({ id: "c1", title: "First Post" }),
      makeMockFeedItem({ id: "c2", title: "Second Post" }),
      makeMockFeedItem({ id: "c3", title: "Third Post" }),
    ];

    render(<RecentContent items={items} />);

    expect(screen.getByText("First Post")).toBeInTheDocument();
    expect(screen.getByText("Second Post")).toBeInTheDocument();
    expect(screen.getByText("Third Post")).toBeInTheDocument();
  });

  it("renders 'View all content' link with href to /feed", () => {
    render(<RecentContent items={[makeMockFeedItem()]} />);

    const link = screen.getByRole("link", { name: /view all content/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "/feed");
  });

  it("shows empty message when items array is empty", () => {
    render(<RecentContent items={[]} />);

    expect(screen.getByText(/No content yet/)).toBeInTheDocument();
  });
});
