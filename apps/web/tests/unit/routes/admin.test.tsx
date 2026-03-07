import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  afterEach,
} from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { makeMockAdminUser } from "../../helpers/admin-fixtures.js";
import { createRouterMock } from "../../helpers/router-mock.js";
import { extractRouteComponent } from "../../helpers/route-test-utils.js";

// ── Helpers ──

function makeAdminUsersResponse(
  items: ReturnType<typeof makeMockAdminUser>[],
  nextCursor: string | null = null,
): Response {
  return new Response(
    JSON.stringify({ items, nextCursor }),
    { status: 200 },
  );
}

// ── Hoisted Mocks ──

const { mockAssignRole, mockRevokeRole } = vi.hoisted(() => ({
  mockAssignRole: vi.fn(),
  mockRevokeRole: vi.fn(),
}));

vi.mock("@tanstack/react-router", () =>
  createRouterMock({ redirect: vi.fn() }),
);

vi.mock("../../../src/lib/api-server.js", () => ({
  fetchAuthStateServer: vi.fn().mockResolvedValue({
    user: { id: "u1" },
    roles: ["admin"],
  }),
}));

vi.mock("../../../src/lib/admin.js", () => ({
  assignRole: mockAssignRole,
  revokeRole: mockRevokeRole,
}));

// ── Component Under Test ──

const AdminPage = extractRouteComponent(() => import("../../../src/routes/admin.js"));

// ── Lifecycle ──

beforeEach(() => {
  const defaultUser = makeMockAdminUser({
    id: "user_001",
    name: "Alice Admin",
    email: "alice@example.com",
    roles: ["admin", "subscriber"],
  });

  mockAssignRole.mockResolvedValue({
    user: { ...defaultUser, roles: [...defaultUser.roles, "creator"] },
  });
  mockRevokeRole.mockResolvedValue({
    user: { ...defaultUser, roles: ["admin"] },
  });

  vi.stubGlobal(
    "fetch",
    vi.fn().mockImplementation(() =>
      Promise.resolve(makeAdminUsersResponse([defaultUser])),
    ),
  );
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

// ── Tests ──

describe("AdminPage", () => {
  it("renders page heading 'Admin'", () => {
    render(<AdminPage />);
    expect(
      screen.getByRole("heading", { name: "Admin" }),
    ).toBeInTheDocument();
  });

  it("renders user list with user data", async () => {
    render(<AdminPage />);
    await waitFor(() => {
      expect(screen.getByText("Alice Admin")).toBeInTheDocument();
    });
    expect(screen.getByText("alice@example.com")).toBeInTheDocument();
  });

  it("renders role badges for users", async () => {
    render(<AdminPage />);
    await waitFor(() => {
      expect(screen.getByText("admin")).toBeInTheDocument();
    });
    expect(screen.getByText("subscriber")).toBeInTheDocument();
  });

  it("shows loading state initially", () => {
    vi.stubGlobal("fetch", vi.fn().mockReturnValue(new Promise(() => {})));
    render(<AdminPage />);
    expect(screen.getByText("Loading users...")).toBeInTheDocument();
  });

  it("shows 'Load more' button when nextCursor is present", async () => {
    const user = makeMockAdminUser({ id: "u1", name: "User One" });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(() =>
        Promise.resolve(makeAdminUsersResponse([user], "cursor-abc")),
      ),
    );
    render(<AdminPage />);
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Load more" }),
      ).toBeInTheDocument();
    });
  });

  it("hides 'Load more' button when nextCursor is null", async () => {
    render(<AdminPage />);
    await waitFor(() => {
      expect(screen.getByText("Alice Admin")).toBeInTheDocument();
    });
    expect(
      screen.queryByRole("button", { name: "Load more" }),
    ).not.toBeInTheDocument();
  });

  it("calls assignRole and updates user roles", async () => {
    const userSetup = userEvent.setup();
    render(<AdminPage />);

    await waitFor(() => {
      expect(screen.getByText("Alice Admin")).toBeInTheDocument();
    });

    const select = screen.getByRole("combobox", { name: "Select role to add" });
    await userSetup.selectOptions(select, "creator");
    await userSetup.click(screen.getByRole("button", { name: "Add" }));

    await waitFor(() => {
      expect(mockAssignRole).toHaveBeenCalledWith("user_001", {
        role: "creator",
      });
    });
  });

  it("calls revokeRole when remove button is clicked", async () => {
    const userSetup = userEvent.setup();
    render(<AdminPage />);

    await waitFor(() => {
      expect(screen.getByText("Alice Admin")).toBeInTheDocument();
    });

    await userSetup.click(
      screen.getByRole("button", { name: "Remove subscriber role" }),
    );

    await waitFor(() => {
      expect(mockRevokeRole).toHaveBeenCalledWith("user_001", {
        role: "subscriber",
      });
    });
  });

  it("shows error when fetch fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("Network error")),
    );
    render(<AdminPage />);
    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Network error");
    });
  });

  it("shows error when assign fails", async () => {
    const userSetup = userEvent.setup();
    mockAssignRole.mockRejectedValue(new Error("Permission denied"));

    render(<AdminPage />);

    await waitFor(() => {
      expect(screen.getByText("Alice Admin")).toBeInTheDocument();
    });

    const select = screen.getByRole("combobox", { name: "Select role to add" });
    await userSetup.selectOptions(select, "creator");
    await userSetup.click(screen.getByRole("button", { name: "Add" }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Permission denied");
    });
  });

  it("shows 'No users found' when list is empty", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(() =>
        Promise.resolve(makeAdminUsersResponse([])),
      ),
    );
    render(<AdminPage />);
    await waitFor(() => {
      expect(screen.getByText("No users found")).toBeInTheDocument();
    });
  });
});
