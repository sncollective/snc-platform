import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

import { createRouterMock } from "../../helpers/router-mock.js";
import { extractRouteComponent } from "../../helpers/route-test-utils.js";

// ── Hoisted Mocks ──

const {
  mockUseLoaderData,
  mockNavigate,
  mockCreateContent,
} = vi.hoisted(() => ({
  mockUseLoaderData: vi.fn(),
  mockNavigate: vi.fn(),
  mockCreateContent: vi.fn(),
}));

vi.mock("@tanstack/react-router", () =>
  createRouterMock({
    useNavigate: () => mockNavigate,
    getRouteApi: () => ({
      useLoaderData: mockUseLoaderData,
      useParams: () => ({}),
      useRouteContext: () => ({}),
    }),
  }),
);

vi.mock("../../../src/lib/content.js", () => ({
  createContent: mockCreateContent,
  deleteContent: vi.fn(),
}));

vi.mock("../../../src/components/content/content-management-list.js", () => ({
  ContentManagementList: ({
    creatorId,
    refreshKey,
  }: {
    creatorId: string;
    creatorSlug: string;
    refreshKey: number;
    onDeleted: () => void;
  }) => (
    <div
      data-testid="content-management-list"
      data-creator-id={creatorId}
      data-refresh-key={refreshKey}
    />
  ),
}));

// ── Component Under Test ──

const ManageContentPage = extractRouteComponent(
  () => import("../../../src/routes/creators/$creatorId/manage/content/index.js"),
);

// ── Lifecycle ──

beforeEach(() => {
  vi.clearAllMocks();
  mockUseLoaderData.mockReturnValue({
    creator: { id: "creator-uuid-123", displayName: "Test Creator", handle: "test-creator" },
    memberRole: "owner",
    isAdmin: false,
    userId: "user-1",
  });
});

// ── Tests ──

describe("ManageContentPage", () => {
  it("renders Content heading", () => {
    render(<ManageContentPage />);
    expect(screen.getByRole("heading", { name: "Content" })).toBeInTheDocument();
  });

  it("renders ContentManagementList instead of DraftContentList and MyContentList", () => {
    render(<ManageContentPage />);
    expect(screen.getByTestId("content-management-list")).toBeInTheDocument();
  });

  it("shows Create New button initially", () => {
    render(<ManageContentPage />);
    expect(screen.getByRole("button", { name: "Create New" })).toBeInTheDocument();
  });

  it("shows type selector dropdown on Create New click", () => {
    render(<ManageContentPage />);
    fireEvent.click(screen.getByRole("button", { name: "Create New" }));
    expect(screen.getByRole("menuitem", { name: "Video" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Audio" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Written Post" })).toBeInTheDocument();
  });

  it("does not show type selector initially", () => {
    render(<ManageContentPage />);
    expect(screen.queryByRole("menuitem", { name: "Video" })).toBeNull();
  });

  it("closes type selector on Escape key", () => {
    render(<ManageContentPage />);
    fireEvent.click(screen.getByRole("button", { name: "Create New" }));
    expect(screen.getByRole("menu")).toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("cycles focus forward with ArrowDown key in the menu", () => {
    render(<ManageContentPage />);
    fireEvent.click(screen.getByRole("button", { name: "Create New" }));
    const menu = screen.getByRole("menu");
    const items = screen.getAllByRole("menuitem");
    // First item is auto-focused; ArrowDown moves to second
    items[0]?.focus();
    fireEvent.keyDown(menu, { key: "ArrowDown" });
    expect(document.activeElement).toBe(items[1]);
  });

  it("cycles focus backward with ArrowUp key in the menu", () => {
    render(<ManageContentPage />);
    fireEvent.click(screen.getByRole("button", { name: "Create New" }));
    const menu = screen.getByRole("menu");
    const items = screen.getAllByRole("menuitem");
    // Focus first item; ArrowUp wraps to last
    items[0]?.focus();
    fireEvent.keyDown(menu, { key: "ArrowUp" });
    expect(document.activeElement).toBe(items[items.length - 1]);
  });

  it("wraps focus from last to first with ArrowDown", () => {
    render(<ManageContentPage />);
    fireEvent.click(screen.getByRole("button", { name: "Create New" }));
    const menu = screen.getByRole("menu");
    const items = screen.getAllByRole("menuitem");
    items[items.length - 1]?.focus();
    fireEvent.keyDown(menu, { key: "ArrowDown" });
    expect(document.activeElement).toBe(items[0]);
  });

  it("closes type selector on Tab key", () => {
    render(<ManageContentPage />);
    fireEvent.click(screen.getByRole("button", { name: "Create New" }));
    const menu = screen.getByRole("menu");
    expect(menu).toBeInTheDocument();
    fireEvent.keyDown(menu, { key: "Tab" });
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("creates draft and navigates on type selection", async () => {
    mockCreateContent.mockResolvedValue({
      id: "new-draft-id",
      slug: "untitled-video",
    });

    render(<ManageContentPage />);
    fireEvent.click(screen.getByRole("button", { name: "Create New" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Video" }));

    await vi.waitFor(() => {
      expect(mockCreateContent).toHaveBeenCalledWith(
        expect.objectContaining({
          creatorId: "creator-uuid-123",
          type: "video",
          title: "Untitled Video",
        }),
      );
    });

    await vi.waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith(
        expect.objectContaining({
          to: "/creators/$creatorId/manage/content/$contentId",
          params: expect.objectContaining({
            creatorId: "test-creator",
            contentId: "untitled-video",
          }),
        }),
      );
    });
  });
});
