import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
} from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { CreatorProfileResponse } from "@snc/shared";
import { createRouterMock } from "../../../helpers/router-mock.js";
import { extractRouteComponent } from "../../../helpers/route-test-utils.js";

// ── Fixtures ──

function makeMockCreator(
  overrides?: Partial<CreatorProfileResponse>,
): CreatorProfileResponse {
  return {
    id: "creator_001",
    displayName: "Alice Smith",
    bio: null,
    handle: "alice",
    avatarUrl: null,
    bannerUrl: null,
    socialLinks: [],
    contentCount: 3,
    status: "active",
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

// ── Hoisted Mocks ──

const {
  mockCreateCreator,
  mockUpdateCreatorStatus,
  mockApiMutate,
} = vi.hoisted(() => ({
  mockCreateCreator: vi.fn(),
  mockUpdateCreatorStatus: vi.fn(),
  mockApiMutate: vi.fn(),
}));

const mockUseLoaderData = vi.hoisted(() => vi.fn());

vi.mock("@tanstack/react-router", () =>
  createRouterMock({
    useLoaderData: mockUseLoaderData,
  }),
);

vi.mock("../../../../src/lib/api-server.js", () => ({
  fetchAuthStateServer: vi.fn().mockResolvedValue({
    user: { id: "u1" },
    roles: ["admin"],
  }),
  fetchApiServer: vi.fn(),
}));

vi.mock("../../../../src/lib/admin.js", () => ({
  listAdminCreators: vi.fn(),
  createCreator: mockCreateCreator,
  updateCreatorStatus: mockUpdateCreatorStatus,
}));

vi.mock("../../../../src/lib/fetch-utils.js", () => ({
  apiMutate: mockApiMutate,
  apiGet: vi.fn(),
  apiUpload: vi.fn(),
}));

// ── Component Under Test ──

const CreatorsPage = extractRouteComponent(
  () => import("../../../../src/routes/admin/creators.js"),
);

// ── Lifecycle ──

beforeEach(() => {
  const alice = makeMockCreator();
  const bob = makeMockCreator({
    id: "creator_002",
    displayName: "Bob Jones",
    handle: "bob",
    status: "inactive",
    contentCount: 0,
  });
  mockUseLoaderData.mockReturnValue({ creators: [alice, bob] });
  mockCreateCreator.mockResolvedValue({
    creator: makeMockCreator({
      id: "creator_new",
      displayName: "New Creator",
      handle: "new",
    }),
  });
  mockUpdateCreatorStatus.mockResolvedValue({
    creator: makeMockCreator({ status: "inactive" }),
  });
  mockApiMutate.mockResolvedValue({});
});

// ── Tests ──

describe("AdminCreatorsPage", () => {
  it("renders page heading 'Creators'", () => {
    render(<CreatorsPage />);
    expect(screen.getByRole("heading", { name: "Creators" })).toBeInTheDocument();
  });

  it("renders table with creator data", () => {
    render(<CreatorsPage />);
    expect(screen.getByText("Alice Smith")).toBeInTheDocument();
    expect(screen.getByText("Bob Jones")).toBeInTheDocument();
  });

  it("renders handles with @ prefix", () => {
    render(<CreatorsPage />);
    expect(screen.getByText("@alice")).toBeInTheDocument();
    expect(screen.getByText("@bob")).toBeInTheDocument();
  });

  it("renders status badges", () => {
    render(<CreatorsPage />);
    expect(screen.getByText("active")).toBeInTheDocument();
    expect(screen.getByText("inactive")).toBeInTheDocument();
  });

  it("renders Invite Creator and Create Creator buttons", () => {
    render(<CreatorsPage />);
    expect(screen.getByRole("button", { name: "Invite Creator" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create Creator" })).toBeInTheDocument();
  });

  it("renders filter tabs with counts", () => {
    render(<CreatorsPage />);
    expect(screen.getByRole("button", { name: /All/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Active/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Inactive/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Archived/ })).toBeInTheDocument();
  });

  it("renders search input", () => {
    render(<CreatorsPage />);
    expect(screen.getByRole("textbox", { name: "Search creators" })).toBeInTheDocument();
  });
});

describe("status filter tabs", () => {
  it("shows only active creators when Active tab is clicked", async () => {
    const userSetup = userEvent.setup();
    render(<CreatorsPage />);

    await userSetup.click(screen.getByRole("button", { name: /Active/ }));

    expect(screen.getByText("Alice Smith")).toBeInTheDocument();
    expect(screen.queryByText("Bob Jones")).not.toBeInTheDocument();
  });

  it("shows only inactive creators when Inactive tab is clicked", async () => {
    const userSetup = userEvent.setup();
    render(<CreatorsPage />);

    await userSetup.click(screen.getByRole("button", { name: /Inactive/ }));

    expect(screen.queryByText("Alice Smith")).not.toBeInTheDocument();
    expect(screen.getByText("Bob Jones")).toBeInTheDocument();
  });

  it("shows all creators when All tab is clicked after filtering", async () => {
    const userSetup = userEvent.setup();
    render(<CreatorsPage />);

    await userSetup.click(screen.getByRole("button", { name: /Inactive/ }));
    await userSetup.click(screen.getByRole("button", { name: /All/ }));

    expect(screen.getByText("Alice Smith")).toBeInTheDocument();
    expect(screen.getByText("Bob Jones")).toBeInTheDocument();
  });
});

describe("search filter", () => {
  it("filters creators by name", async () => {
    const userSetup = userEvent.setup();
    render(<CreatorsPage />);

    const search = screen.getByRole("textbox", { name: "Search creators" });
    await userSetup.type(search, "Alice");

    expect(screen.getByText("Alice Smith")).toBeInTheDocument();
    expect(screen.queryByText("Bob Jones")).not.toBeInTheDocument();
  });

  it("filters creators by handle", async () => {
    const userSetup = userEvent.setup();
    render(<CreatorsPage />);

    const search = screen.getByRole("textbox", { name: "Search creators" });
    await userSetup.type(search, "bob");

    expect(screen.queryByText("Alice Smith")).not.toBeInTheDocument();
    expect(screen.getByText("Bob Jones")).toBeInTheDocument();
  });
});

describe("column sorting", () => {
  it("sorts by name when Name column header is clicked", async () => {
    const userSetup = userEvent.setup();
    render(<CreatorsPage />);

    const nameHeader = screen.getByRole("columnheader", { name: /Name/ });
    await userSetup.click(nameHeader);

    // After clicking, sort indicator (↑) appears
    expect(nameHeader.textContent).toContain("↑");
  });

  it("toggles sort direction on second click", async () => {
    const userSetup = userEvent.setup();
    render(<CreatorsPage />);

    const nameHeader = screen.getByRole("columnheader", { name: /Name/ });
    await userSetup.click(nameHeader);
    await userSetup.click(nameHeader);

    expect(nameHeader.textContent).toContain("↓");
  });
});

describe("status actions", () => {
  it("calls updateCreatorStatus when Deactivate is clicked for active creator", async () => {
    const userSetup = userEvent.setup();
    render(<CreatorsPage />);

    const deactivateButtons = screen.getAllByRole("button", { name: "Deactivate" });
    await userSetup.click(deactivateButtons[0]!);

    await waitFor(() => {
      expect(mockUpdateCreatorStatus).toHaveBeenCalledWith(
        "creator_001",
        { status: "inactive" },
      );
    });
  });

  it("calls updateCreatorStatus when Activate is clicked for inactive creator", async () => {
    const userSetup = userEvent.setup();
    render(<CreatorsPage />);

    const activateButton = screen.getByRole("button", { name: "Activate" });
    await userSetup.click(activateButton);

    await waitFor(() => {
      expect(mockUpdateCreatorStatus).toHaveBeenCalledWith(
        "creator_002",
        { status: "active" },
      );
    });
  });
});

describe("create creator form", () => {
  it("shows create form when Create Creator is clicked", async () => {
    const userSetup = userEvent.setup();
    render(<CreatorsPage />);

    await userSetup.click(screen.getByRole("button", { name: "Create Creator" }));

    expect(screen.getByPlaceholderText("Display name")).toBeInTheDocument();
  });

  it("calls createCreator and updates list on submit", async () => {
    const userSetup = userEvent.setup();
    render(<CreatorsPage />);

    await userSetup.click(screen.getByRole("button", { name: "Create Creator" }));
    await userSetup.type(screen.getByPlaceholderText("Display name"), "New Creator");
    await userSetup.click(screen.getByRole("button", { name: "Create" }));

    await waitFor(() => {
      expect(mockCreateCreator).toHaveBeenCalledWith({ displayName: "New Creator" });
    });
  });

  it("hides form when Cancel is clicked", async () => {
    const userSetup = userEvent.setup();
    render(<CreatorsPage />);

    await userSetup.click(screen.getByRole("button", { name: "Create Creator" }));
    await userSetup.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.queryByPlaceholderText("Display name")).not.toBeInTheDocument();
  });
});

describe("invite creator dialog", () => {
  it("opens invite dialog when Invite Creator is clicked", async () => {
    const userSetup = userEvent.setup();
    render(<CreatorsPage />);

    await userSetup.click(screen.getByRole("button", { name: "Invite Creator" }));

    expect(screen.getByRole("dialog", { name: "Invite Creator" })).toBeInTheDocument();
  });

  it("calls apiMutate with invite data on submit", async () => {
    const userSetup = userEvent.setup();
    render(<CreatorsPage />);

    await userSetup.click(screen.getByRole("button", { name: "Invite Creator" }));

    await userSetup.type(screen.getByLabelText("Email"), "new@example.com");
    await userSetup.type(screen.getByLabelText("Display Name"), "New Person");
    await userSetup.click(screen.getByRole("button", { name: "Send Invite" }));

    await waitFor(() => {
      expect(mockApiMutate).toHaveBeenCalledWith(
        "/api/invites",
        expect.objectContaining({
          method: "POST",
          body: expect.objectContaining({ email: "new@example.com", displayName: "New Person" }),
        }),
      );
    });
  });
});

describe("empty state", () => {
  it("shows empty state when no creators match filter", async () => {
    const userSetup = userEvent.setup();
    render(<CreatorsPage />);

    await userSetup.click(screen.getByRole("button", { name: /Archived/ }));

    expect(screen.getByText("No creators found.")).toBeInTheDocument();
  });
});
