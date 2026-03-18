import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

import { createRouterMock } from "../../helpers/router-mock.js";
import { extractRouteComponent } from "../../helpers/route-test-utils.js";

// ── Mocks ──

const mockUseLoaderData = vi.hoisted(() => vi.fn());

vi.mock("@tanstack/react-router", () =>
  createRouterMock({
    getRouteApi: () => ({
      useLoaderData: mockUseLoaderData,
      useParams: () => ({}),
      useRouteContext: () => ({}),
    }),
  }),
);

vi.mock("../../../src/components/content/content-form.js", () => ({
  ContentForm: ({ creatorId }: { creatorId: string }) => (
    <div data-testid="content-form" data-creator-id={creatorId} />
  ),
}));

vi.mock("../../../src/components/content/my-content-list.js", () => ({
  MyContentList: ({
    creatorId,
    refreshKey,
  }: {
    creatorId: string;
    refreshKey: number;
  }) => (
    <div
      data-testid="content-list"
      data-creator-id={creatorId}
      data-refresh-key={refreshKey}
    />
  ),
}));

// ── Component Under Test ──

const ManageContentPage = extractRouteComponent(
  () => import("../../../src/routes/creators/$creatorId/manage/content.js"),
);

// ── Lifecycle ──

beforeEach(() => {
  mockUseLoaderData.mockReturnValue({
    creator: { id: "creator-uuid-123", displayName: "Test Creator" },
    memberRole: "owner",
    isAdmin: false,
    userId: "user-1",
  });
});

// ── Tests ──

describe("ManageContentPage", () => {
  it("renders section headings", () => {
    render(<ManageContentPage />);
    expect(
      screen.getByRole("heading", { name: "Create New Content" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Published Content" }),
    ).toBeInTheDocument();
  });

  it("passes creator UUID (not handle) to ContentForm", () => {
    render(<ManageContentPage />);
    const form = screen.getByTestId("content-form");
    expect(form).toHaveAttribute("data-creator-id", "creator-uuid-123");
  });

  it("passes creator UUID (not handle) to MyContentList", () => {
    render(<ManageContentPage />);
    const list = screen.getByTestId("content-list");
    expect(list).toHaveAttribute("data-creator-id", "creator-uuid-123");
  });

  it("initialises refreshKey to 0", () => {
    render(<ManageContentPage />);
    const list = screen.getByTestId("content-list");
    expect(list).toHaveAttribute("data-refresh-key", "0");
  });
});
