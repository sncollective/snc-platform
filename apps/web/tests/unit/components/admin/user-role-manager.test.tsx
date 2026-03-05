import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import type { Role } from "@snc/shared";

import { makeMockAdminUser } from "../../../helpers/admin-fixtures.js";
import { UserRoleManager } from "../../../../src/components/admin/user-role-manager.js";

// ── Lifecycle ──

let mockOnAssignRole: ReturnType<typeof vi.fn<(userId: string, role: Role) => Promise<void>>>;
let mockOnRevokeRole: ReturnType<typeof vi.fn<(userId: string, role: Role) => Promise<void>>>;

beforeEach(() => {
  mockOnAssignRole = vi.fn<(userId: string, role: Role) => Promise<void>>().mockResolvedValue(undefined);
  mockOnRevokeRole = vi.fn<(userId: string, role: Role) => Promise<void>>().mockResolvedValue(undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ── Tests ──

describe("UserRoleManager", () => {
  it("renders user name and email", () => {
    const user = makeMockAdminUser({ name: "Jane Doe", email: "jane@test.com" });

    render(
      <UserRoleManager
        user={user}
        onAssignRole={mockOnAssignRole}
        onRevokeRole={mockOnRevokeRole}
      />,
    );

    expect(screen.getByText("Jane Doe")).toBeInTheDocument();
    expect(screen.getByText("jane@test.com")).toBeInTheDocument();
  });

  it("renders role badges for each user role", () => {
    const user = makeMockAdminUser({ roles: ["admin", "creator"] });

    render(
      <UserRoleManager
        user={user}
        onAssignRole={mockOnAssignRole}
        onRevokeRole={mockOnRevokeRole}
      />,
    );

    expect(screen.getByText("admin")).toBeInTheDocument();
    expect(screen.getByText("creator")).toBeInTheDocument();
  });

  it("renders remove button for each role", () => {
    const user = makeMockAdminUser({ roles: ["admin", "subscriber"] });

    render(
      <UserRoleManager
        user={user}
        onAssignRole={mockOnAssignRole}
        onRevokeRole={mockOnRevokeRole}
      />,
    );

    expect(
      screen.getByRole("button", { name: "Remove admin role" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Remove subscriber role" }),
    ).toBeInTheDocument();
  });

  it("calls onRevokeRole when remove button is clicked", async () => {
    const user = makeMockAdminUser({
      id: "user_123",
      roles: ["admin", "subscriber"],
    });
    const userSetup = userEvent.setup();

    render(
      <UserRoleManager
        user={user}
        onAssignRole={mockOnAssignRole}
        onRevokeRole={mockOnRevokeRole}
      />,
    );

    await userSetup.click(
      screen.getByRole("button", { name: "Remove subscriber role" }),
    );

    expect(mockOnRevokeRole).toHaveBeenCalledWith("user_123", "subscriber");
  });

  it("renders role select dropdown with available roles", () => {
    const user = makeMockAdminUser({ roles: ["subscriber"] });

    render(
      <UserRoleManager
        user={user}
        onAssignRole={mockOnAssignRole}
        onRevokeRole={mockOnRevokeRole}
      />,
    );

    const select = screen.getByRole("combobox", { name: "Select role to add" });
    expect(select).toBeInTheDocument();
  });

  it("calls onAssignRole when a role is selected and Add is clicked", async () => {
    const user = makeMockAdminUser({
      id: "user_123",
      roles: ["subscriber"],
    });
    const userSetup = userEvent.setup();

    render(
      <UserRoleManager
        user={user}
        onAssignRole={mockOnAssignRole}
        onRevokeRole={mockOnRevokeRole}
      />,
    );

    const select = screen.getByRole("combobox", { name: "Select role to add" });
    await userSetup.selectOptions(select, "creator");
    await userSetup.click(screen.getByRole("button", { name: "Add" }));

    expect(mockOnAssignRole).toHaveBeenCalledWith("user_123", "creator");
  });

  it("disables Add button when no role is selected", () => {
    const user = makeMockAdminUser({ roles: ["subscriber"] });

    render(
      <UserRoleManager
        user={user}
        onAssignRole={mockOnAssignRole}
        onRevokeRole={mockOnRevokeRole}
      />,
    );

    expect(screen.getByRole("button", { name: "Add" })).toBeDisabled();
  });
});
