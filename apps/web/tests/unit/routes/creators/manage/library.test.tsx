import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import type { ContentAsset } from "@snc/shared";

import { createRouterMock } from "../../../../helpers/router-mock.js";
import { extractRouteComponent } from "../../../../helpers/route-test-utils.js";

const {
  mockUseCursorPagination,
  mockLoadMore,
} = vi.hoisted(() => ({
  mockUseCursorPagination: vi.fn(),
  mockLoadMore: vi.fn(),
}));

vi.mock("@tanstack/react-router", () => {
  const base = createRouterMock({
    getRouteApi: () => ({
      useLoaderData: () => ({
        creator: { id: "creator-1", displayName: "Animal Future", handle: "animal-future" },
        memberRole: "owner",
        isAdmin: false,
        userId: "user-1",
      }),
    }),
  });
  base.createFileRoute = () => (routeOptions: Record<string, unknown>) => ({
    ...routeOptions,
    useParams: () => ({ creatorId: "animal-future" }),
  });
  return base;
});

vi.mock("../../../../../src/hooks/use-cursor-pagination.js", () => ({
  useCursorPagination: mockUseCursorPagination,
}));

const LibraryPage = extractRouteComponent(
  () => import("../../../../../src/routes/creators/$creatorId/manage/library.js"),
);

const makeAsset = ({ id, ...overrides }: Partial<ContentAsset> & Pick<ContentAsset, "id">): ContentAsset => ({
  id,
  creatorId: "creator-1",
  blobSha256: "a".repeat(64),
  sharing: "private",
  originalFilename: "image.jpg",
  createdAt: "2026-08-09T12:00:00.000Z",
  storageKey: `library/aa/${"a".repeat(64)}.jpg`,
  mimeType: "image/jpeg",
  size: 100,
  width: 1800,
  height: 2400,
  canUse: true,
  useStatus: "own",
  ...overrides,
});

const ownPrivate = makeAsset({
  id: "00000000-0000-4000-8000-000000000001",
  originalFilename: "private-portrait.jpg",
  sharing: "private",
  size: 100,
  createdAt: "2026-08-08T12:00:00.000Z",
});
const ownOpen = makeAsset({
  id: "00000000-0000-4000-8000-000000000002",
  originalFilename: "open-stage.jpg",
  sharing: "open",
  size: 500,
  createdAt: "2026-08-09T12:00:00.000Z",
});
const sharedOpen = makeAsset({
  id: "00000000-0000-4000-8000-000000000003",
  creatorId: "creator-2",
  originalFilename: "shared-open.jpg",
  sharing: "open",
  size: 300,
  useStatus: "open",
});
const sharedRequestable = makeAsset({
  id: "00000000-0000-4000-8000-000000000004",
  creatorId: "creator-2",
  originalFilename: "shared-requestable.jpg",
  sharing: "requestable",
  size: 700,
  canUse: false,
  useStatus: "requestable-needs-grant",
});

const setPaginationState = (overrides: Partial<{
  items: ContentAsset[];
  nextCursor: string | null;
  isLoading: boolean;
  error: string | null;
}> = {}): void => {
  mockUseCursorPagination.mockReturnValue({
    items: [ownPrivate, ownOpen, sharedOpen, sharedRequestable],
    nextCursor: null,
    isLoading: false,
    error: null,
    loadMore: mockLoadMore,
    ...overrides,
  });
};

beforeEach(() => {
  vi.clearAllMocks();
  setPaginationState();
});

describe("creator content library page", () => {
  it("opens in the current creator's grid and exposes accessible view state", () => {
    render(<LibraryPage />);

    expect(screen.getByRole("heading", { name: "Animal Future library" })).toBeVisible();
    expect(screen.getByText("private-portrait.jpg")).toBeVisible();
    expect(screen.getByText("open-stage.jpg")).toBeVisible();
    expect(screen.queryByText("shared-open.jpg")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Grid view" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Table view" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByText("Source: My library")).toBeVisible();
    expect(screen.getByText("1 filter active")).toBeVisible();
  });

  it("filters shared assets by sharing scope, shows chips, and clears to defaults", async () => {
    const user = userEvent.setup();
    render(<LibraryPage />);

    await user.click(screen.getByRole("button", { name: /Source: My library/ }));
    await user.click(screen.getByRole("radio", { name: /Shared with me/ }));

    expect(screen.getByText("shared-open.jpg")).toBeVisible();
    expect(screen.getByText("shared-requestable.jpg")).toBeVisible();
    expect(screen.queryByText("private-portrait.jpg")).not.toBeInTheDocument();

    const sharingButton = screen.getByRole("button", { name: /Sharing scope/ });
    await user.click(sharingButton);
    await user.click(screen.getByRole("checkbox", { name: /Open/ }));
    await user.keyboard("{Escape}");

    expect(sharingButton).toHaveFocus();
    expect(sharingButton).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByText("shared-open.jpg")).toBeVisible();
    expect(screen.queryByText("shared-requestable.jpg")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Sharing: Open/ })).toBeVisible();
    expect(screen.getByText("2 filters active")).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(screen.getByText("private-portrait.jpg")).toBeVisible();
    expect(screen.queryByText("shared-open.jpg")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Clear filters" })).not.toBeInTheDocument();
  });

  it("sorts loaded assets by size and renders semantic property columns in table view", async () => {
    const user = userEvent.setup();
    render(<LibraryPage />);

    await user.selectOptions(screen.getByLabelText("Sort"), "largest");
    await user.click(screen.getByRole("button", { name: "Table view" }));

    const table = screen.getByRole("table", { name: "Library image properties" });
    expect(within(table).getByRole("columnheader", { name: "Dimensions" })).toBeVisible();
    expect(within(table).getByRole("columnheader", { name: "Sharing" })).toBeVisible();
    expect(within(table).getByRole("columnheader", { name: "Use status" })).toBeVisible();
    expect(within(table).getByRole("columnheader", { name: "Date added" })).toBeVisible();
    expect(within(table).getByRole("columnheader", { name: "Size" })).toBeVisible();

    const rows = within(table).getAllByRole("row");
    expect(rows[1]).toHaveTextContent("open-stage.jpg");
    expect(screen.getAllByText("Own")).toHaveLength(2);
    expect(screen.getByRole("button", { name: "Table view" })).toHaveAttribute("aria-pressed", "true");
  });

  it("distinguishes loading, empty-library, and no-results states", async () => {
    setPaginationState({ items: [], isLoading: true });
    const { unmount } = render(<LibraryPage />);
    expect(screen.getByRole("status")).toHaveTextContent("Loading image library");
    unmount();

    setPaginationState({ items: [], isLoading: false });
    const emptyRender = render(<LibraryPage />);
    expect(screen.getByText("Your library is ready for its first image.")).toBeVisible();
    expect(screen.getByRole("link", { name: "Upload a press image" })).toBeVisible();
    emptyRender.unmount();

    setPaginationState({ items: [ownOpen], isLoading: false });
    const user = userEvent.setup();
    render(<LibraryPage />);
    await user.click(screen.getByRole("button", { name: /Sharing scope/ }));
    await user.click(screen.getByRole("checkbox", { name: /Private/ }));
    expect(screen.getByRole("status")).toHaveTextContent("No images match these filters");
  });

  it("loads another cursor page without changing client-side filters", async () => {
    setPaginationState({ nextCursor: "cursor-2" });
    const user = userEvent.setup();
    render(<LibraryPage />);

    await user.click(screen.getByRole("button", { name: "Load more images" }));

    expect(mockLoadMore).toHaveBeenCalledOnce();
    expect(screen.getByText("Filters apply to every loaded page.")).toBeVisible();
  });
});
