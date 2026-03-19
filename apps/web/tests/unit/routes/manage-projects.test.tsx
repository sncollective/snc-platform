import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { makeMockProject } from "../../helpers/project-fixtures.js";
import { createRouterMock } from "../../helpers/router-mock.js";
import { extractRouteComponent } from "../../helpers/route-test-utils.js";

// ── Hoisted Mocks ──

const {
  mockUseLoaderData,
  mockFetchProjects,
  mockCreateProject,
  mockUpdateProject,
  mockDeleteProject,
  mockIsFeatureEnabled,
} = vi.hoisted(() => ({
  mockUseLoaderData: vi.fn(),
  mockFetchProjects: vi.fn(),
  mockCreateProject: vi.fn(),
  mockUpdateProject: vi.fn(),
  mockDeleteProject: vi.fn(),
  mockIsFeatureEnabled: vi.fn(),
}));

vi.mock("@tanstack/react-router", () =>
  createRouterMock({
    getRouteApi: () => ({
      useLoaderData: mockUseLoaderData,
      useParams: () => ({}),
      useRouteContext: () => ({}),
    }),
  }),
);

vi.mock("../../../src/lib/project.js", () => ({
  fetchProjects: mockFetchProjects,
  createProject: mockCreateProject,
  updateProject: mockUpdateProject,
  deleteProject: mockDeleteProject,
}));

vi.mock("../../../src/lib/config.js", () => ({
  DEMO_MODE: false,
  features: {},
  isFeatureEnabled: mockIsFeatureEnabled,
}));

vi.mock("../../../src/styles/detail-section.module.css", () => ({
  default: { section: "section", sectionHeading: "sectionHeading" },
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

vi.mock(
  "../../../src/routes/creators/$creatorId/manage/projects-manage.module.css",
  () => ({
    default: {
      projectsManage: "projectsManage",
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
      completedBadge: "completedBadge",
      projectItemActions: "projectItemActions",
      actionButton: "actionButton",
      deleteButton: "deleteButton",
      projectDescription: "projectDescription",
      status: "status",
    },
  }),
);

// ── Component Under Test ──

const ManageProjectsPage = extractRouteComponent(
  () =>
    import(
      "../../../src/routes/creators/$creatorId/manage/projects.js"
    ),
);

// ── Test Lifecycle ──

beforeEach(() => {
  mockIsFeatureEnabled.mockReturnValue(true);
  mockUseLoaderData.mockReturnValue({
    creator: { id: "creator-uuid-123", displayName: "Test Creator" },
    memberRole: "owner",
    isAdmin: false,
    userId: "user-1",
  });
  mockFetchProjects.mockResolvedValue({
    items: [makeMockProject()],
    nextCursor: null,
  });
  mockCreateProject.mockResolvedValue(
    makeMockProject({ id: "new-proj", name: "New Project" }),
  );
  mockUpdateProject.mockResolvedValue(
    makeMockProject({ completed: true }),
  );
  mockDeleteProject.mockResolvedValue(undefined);
});

// ── Tests ──

describe("ManageProjectsPage", () => {
  it("renders the Projects heading", () => {
    render(<ManageProjectsPage />);
    expect(
      screen.getByRole("heading", { name: "Projects" }),
    ).toBeInTheDocument();
  });

  it("renders the New Project button", () => {
    render(<ManageProjectsPage />);
    expect(
      screen.getByRole("button", { name: "New Project" }),
    ).toBeInTheDocument();
  });

  it("shows loading state initially", () => {
    render(<ManageProjectsPage />);
    expect(screen.getByText(/loading projects/i)).toBeInTheDocument();
  });

  it("shows the project list after loading", async () => {
    render(<ManageProjectsPage />);
    await waitFor(() => {
      expect(screen.getByText("Animal Future LP")).toBeInTheDocument();
    });
  });

  it("fetches projects with the creator id", async () => {
    render(<ManageProjectsPage />);
    await waitFor(() => {
      expect(mockFetchProjects).toHaveBeenCalledWith(
        expect.objectContaining({ creatorId: "creator-uuid-123" }),
      );
    });
  });

  it("shows the project form when New Project is clicked", async () => {
    const user = userEvent.setup();
    render(<ManageProjectsPage />);

    await user.click(screen.getByRole("button", { name: "New Project" }));

    expect(screen.getByLabelText(/name/i)).toBeInTheDocument();
  });

  it("hides the form when Cancel is clicked", async () => {
    const user = userEvent.setup();
    render(<ManageProjectsPage />);

    await user.click(screen.getByRole("button", { name: "New Project" }));
    expect(screen.getByRole("button", { name: /create project/i })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /cancel/i }));
    expect(screen.queryByRole("button", { name: /create project/i })).not.toBeInTheDocument();
  });

  it("shows empty state when no projects exist", async () => {
    mockFetchProjects.mockResolvedValue({ items: [], nextCursor: null });
    render(<ManageProjectsPage />);

    await waitFor(() => {
      expect(screen.getByText(/no projects yet/i)).toBeInTheDocument();
    });
  });
});
