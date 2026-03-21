import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

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
  ContentForm: ({
    creatorId,
    onSuccess,
    onCancel,
  }: {
    creatorId: string;
    onSuccess: () => void;
    onCancel?: () => void;
    onUploadComplete?: () => void;
  }) => (
    <div data-testid="content-form" data-creator-id={creatorId}>
      <button type="button" data-testid="form-success-trigger" onClick={onSuccess}>
        Trigger Success
      </button>
      {onCancel && (
        <button type="button" data-testid="form-cancel-trigger" onClick={onCancel}>
          Trigger Cancel
        </button>
      )}
    </div>
  ),
}));

vi.mock("../../../src/components/content/draft-content-list.js", () => ({
  DraftContentList: ({
    creatorId,
    refreshKey,
  }: {
    creatorId: string;
    refreshKey: number;
    onPublished: () => void;
  }) => (
    <div
      data-testid="draft-content-list"
      data-creator-id={creatorId}
      data-refresh-key={refreshKey}
    />
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
  it("renders Content heading", () => {
    render(<ManageContentPage />);
    expect(screen.getByRole("heading", { name: "Content" })).toBeInTheDocument();
  });

  it("renders Drafts and Published sections", () => {
    render(<ManageContentPage />);
    expect(screen.getByRole("heading", { name: "Drafts" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Published" })).toBeInTheDocument();
  });

  it("shows Create New button initially", () => {
    render(<ManageContentPage />);
    expect(screen.getByRole("button", { name: "Create New" })).toBeInTheDocument();
  });

  it("does not show ContentForm initially", () => {
    render(<ManageContentPage />);
    expect(screen.queryByTestId("content-form")).toBeNull();
  });

  it("shows ContentForm when Create New button is clicked", () => {
    render(<ManageContentPage />);
    fireEvent.click(screen.getByRole("button", { name: "Create New" }));
    expect(screen.getByTestId("content-form")).toBeInTheDocument();
  });

  it("hides Create New button when form is shown", () => {
    render(<ManageContentPage />);
    fireEvent.click(screen.getByRole("button", { name: "Create New" }));
    expect(screen.queryByRole("button", { name: "Create New" })).toBeNull();
  });

  it("hides ContentForm after cancel", () => {
    render(<ManageContentPage />);
    fireEvent.click(screen.getByRole("button", { name: "Create New" }));
    expect(screen.getByTestId("content-form")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("form-cancel-trigger"));
    expect(screen.queryByTestId("content-form")).toBeNull();
  });

  it("hides ContentForm after success", () => {
    render(<ManageContentPage />);
    fireEvent.click(screen.getByRole("button", { name: "Create New" }));
    fireEvent.click(screen.getByTestId("form-success-trigger"));
    expect(screen.queryByTestId("content-form")).toBeNull();
  });

  it("passes creator UUID to ContentForm", () => {
    render(<ManageContentPage />);
    fireEvent.click(screen.getByRole("button", { name: "Create New" }));
    const form = screen.getByTestId("content-form");
    expect(form).toHaveAttribute("data-creator-id", "creator-uuid-123");
  });

  it("passes creator UUID to DraftContentList", () => {
    render(<ManageContentPage />);
    const list = screen.getByTestId("draft-content-list");
    expect(list).toHaveAttribute("data-creator-id", "creator-uuid-123");
  });

  it("passes creator UUID to MyContentList", () => {
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
