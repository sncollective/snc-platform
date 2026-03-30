import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { makeMockProject } from "../../helpers/project-fixtures.js";
import { createRouterMock } from "../../helpers/router-mock.js";
import { extractRouteComponent } from "../../helpers/route-test-utils.js";

// ── Hoisted Mocks ──

const {
  mockFetchProjects,
  mockCreateProject,
  mockUpdateProject,
  mockDeleteProject,
  mockFetchAuthStateServer,
  mockFetchAllCreators,
  mockIsFeatureEnabled,
  mockRedirect,
} = vi.hoisted(() => ({
  mockFetchProjects: vi.fn(),
  mockCreateProject: vi.fn(),
  mockUpdateProject: vi.fn(),
  mockDeleteProject: vi.fn(),
  mockFetchAuthStateServer: vi.fn(),
  mockFetchAllCreators: vi.fn(),
  mockIsFeatureEnabled: vi.fn(),
  mockRedirect: vi.fn(),
}));

vi.mock("@tanstack/react-router", () =>
  createRouterMock({ redirect: mockRedirect }),
);

vi.mock("../../../src/lib/project.js", () => ({
  fetchProjects: mockFetchProjects,
  createProject: mockCreateProject,
  updateProject: mockUpdateProject,
  deleteProject: mockDeleteProject,
}));

vi.mock("../../../src/lib/creator.js", () => ({
  fetchAllCreators: mockFetchAllCreators,
}));

vi.mock("../../../src/lib/api-server.js", () => ({
  fetchAuthStateServer: mockFetchAuthStateServer,
  fetchApiServer: vi.fn(),
}));

vi.mock("../../../src/lib/config.js", () => ({
  DEMO_MODE: false,
  features: {},
  isFeatureEnabled: mockIsFeatureEnabled,
}));

vi.mock("../../../src/styles/listing-page.module.css", () => ({
  default: { heading: "heading", status: "status" },
}));

vi.mock("../../../src/styles/form.module.css", () => ({
  default: {
    fieldGroup: "fieldGroup",
    label: "label",
    input: "input",
    inputError: "inputError",
    fieldError: "fieldError",
    textarea: "textarea",
    submitButton: "submitButton",
    serverError: "serverError",
    select: "select",
  },
}));

vi.mock("../../../src/routes/projects.module.css", () => ({
  default: {
    page: "page",
    headerRow: "headerRow",
    newButton: "newButton",
    error: "error",
    filterRow: "filterRow",
    filterLabel: "filterLabel",
    formWrapper: "formWrapper",
    projectForm: "projectForm",
    formActions: "formActions",
    cancelButton: "cancelButton",
    projectList: "projectList",
    projectItem: "projectItem",
    projectItemHeader: "projectItemHeader",
    projectItemMeta: "projectItemMeta",
    projectName: "projectName",
    projectNameLink: "projectNameLink",
    completedBadge: "completedBadge",
    projectItemActions: "projectItemActions",
    actionButton: "actionButton",
    deleteButton: "deleteButton",
    projectDescription: "projectDescription",
  },
}));

// ── Component Under Test ──

const ProjectsPage = extractRouteComponent(
  () => import("../../../src/routes/governance/projects.js"),
);

// ── Test Lifecycle ──

beforeEach(() => {
  mockIsFeatureEnabled.mockReturnValue(true);
  mockFetchAuthStateServer.mockResolvedValue({
    user: { id: "user-1" },
    roles: ["stakeholder"],
    isPatron: false,
  });
  mockFetchProjects.mockResolvedValue({
    items: [makeMockProject()],
    nextCursor: null,
  });
  mockFetchAllCreators.mockResolvedValue([
    { id: "cr1", displayName: "Creator One", canManage: true },
    { id: "cr2", displayName: "Creator Two", canManage: false },
  ]);
  mockCreateProject.mockResolvedValue(makeMockProject({ id: "new-proj" }));
  mockUpdateProject.mockResolvedValue(makeMockProject({ completed: true }));
  mockDeleteProject.mockResolvedValue(undefined);
});

// ── Tests ──

describe("ProjectsPage", () => {
  it("renders the Projects heading", () => {
    render(<ProjectsPage />);
    expect(
      screen.getByRole("heading", { name: "Projects" }),
    ).toBeInTheDocument();
  });

  it("renders the New Project button", () => {
    render(<ProjectsPage />);
    expect(
      screen.getByRole("button", { name: "New Project" }),
    ).toBeInTheDocument();
  });

  it("shows loading state initially", () => {
    render(<ProjectsPage />);
    expect(screen.getByText(/loading projects/i)).toBeInTheDocument();
  });

  it("shows the project list after loading", async () => {
    render(<ProjectsPage />);
    await waitFor(() => {
      expect(screen.getByText("Animal Future LP")).toBeInTheDocument();
    });
  });

  it("fetches projects on mount", async () => {
    render(<ProjectsPage />);
    await waitFor(() => {
      expect(mockFetchProjects).toHaveBeenCalledWith(
        expect.objectContaining({ completed: "false" }),
      );
    });
  });

  it("shows the project form when New Project is clicked", async () => {
    const user = userEvent.setup();
    render(<ProjectsPage />);

    await user.click(screen.getByRole("button", { name: "New Project" }));

    expect(screen.getByLabelText(/name/i)).toBeInTheDocument();
  });

  it("hides the form when Cancel is clicked", async () => {
    const user = userEvent.setup();
    render(<ProjectsPage />);

    await user.click(screen.getByRole("button", { name: "New Project" }));
    expect(screen.getByRole("button", { name: /create project/i })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /cancel/i }));
    expect(screen.queryByRole("button", { name: /create project/i })).not.toBeInTheDocument();
  });

  it("shows validation error if name is empty on submit", async () => {
    const user = userEvent.setup();
    render(<ProjectsPage />);

    await user.click(screen.getByRole("button", { name: "New Project" }));
    await user.click(screen.getByRole("button", { name: /create project/i }));

    expect(await screen.findByText(/name is required/i)).toBeInTheDocument();
    expect(mockCreateProject).not.toHaveBeenCalled();
  });

  it("shows empty state when no projects exist", async () => {
    mockFetchProjects.mockResolvedValue({ items: [], nextCursor: null });
    render(<ProjectsPage />);

    await waitFor(() => {
      expect(screen.getByText(/no projects yet/i)).toBeInTheDocument();
    });
  });

  it("shows creator selector in new project form", async () => {
    const user = userEvent.setup();
    render(<ProjectsPage />);

    await user.click(screen.getByRole("button", { name: "New Project" }));

    expect(screen.getByLabelText(/creator/i)).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: /creator/i })).toBeInTheDocument();
  });

  it("only shows manageable creators in selector", async () => {
    const user = userEvent.setup();
    render(<ProjectsPage />);

    await user.click(screen.getByRole("button", { name: "New Project" }));

    await waitFor(() => {
      expect(screen.getByRole("option", { name: "Creator One" })).toBeInTheDocument();
    });
    expect(screen.queryByRole("option", { name: "Creator Two" })).not.toBeInTheDocument();
  });

  it("shows None option in creator selector", async () => {
    const user = userEvent.setup();
    render(<ProjectsPage />);

    await user.click(screen.getByRole("button", { name: "New Project" }));

    expect(screen.getByRole("option", { name: "None (org-level)" })).toBeInTheDocument();
  });

  it("creates project with selected creator", async () => {
    const user = userEvent.setup();
    render(<ProjectsPage />);

    await user.click(screen.getByRole("button", { name: "New Project" }));

    await waitFor(() => {
      expect(screen.getByRole("option", { name: "Creator One" })).toBeInTheDocument();
    });

    await user.selectOptions(screen.getByRole("combobox", { name: /creator/i }), "cr1");
    await user.type(screen.getByLabelText(/^name/i), "My Project");
    await user.click(screen.getByRole("button", { name: /create project/i }));

    await waitFor(() => {
      expect(mockCreateProject).toHaveBeenCalledWith(
        expect.objectContaining({ creatorId: "cr1" }),
      );
    });
  });

  it("creates project with null creatorId when None selected", async () => {
    const user = userEvent.setup();
    render(<ProjectsPage />);

    await user.click(screen.getByRole("button", { name: "New Project" }));
    await user.type(screen.getByLabelText(/^name/i), "My Project");
    await user.click(screen.getByRole("button", { name: /create project/i }));

    await waitFor(() => {
      expect(mockCreateProject).toHaveBeenCalledWith(
        expect.objectContaining({ creatorId: null }),
      );
    });
  });

  it("disables creator selector when editing", async () => {
    const user = userEvent.setup();
    render(<ProjectsPage />);

    await waitFor(() => {
      expect(screen.getByText("Animal Future LP")).toBeInTheDocument();
    });

    const editButtons = screen.getAllByRole("button", { name: /edit/i });
    await user.click(editButtons[0]!);

    const select = screen.getByRole("combobox", { name: /creator/i });
    expect(select).toBeDisabled();
  });
});
