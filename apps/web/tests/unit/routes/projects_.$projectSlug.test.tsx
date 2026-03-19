import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { makeMockProject } from "../../helpers/project-fixtures.js";
import { makeMockCalendarEvent } from "../../helpers/calendar-fixtures.js";
import { createRouterMock } from "../../helpers/router-mock.js";
import { extractRouteComponent } from "../../helpers/route-test-utils.js";

// ── Hoisted Mocks ──

const {
  mockUseLoaderData,
  mockUpdateProject,
  mockDeleteProject,
  mockToggleEventComplete,
  mockFetchAuthStateServer,
  mockFetchApiServer,
  mockIsFeatureEnabled,
  mockRedirect,
} = vi.hoisted(() => ({
  mockUseLoaderData: vi.fn(),
  mockUpdateProject: vi.fn(),
  mockDeleteProject: vi.fn(),
  mockToggleEventComplete: vi.fn(),
  mockFetchAuthStateServer: vi.fn(),
  mockFetchApiServer: vi.fn(),
  mockIsFeatureEnabled: vi.fn(),
  mockRedirect: vi.fn(),
}));

vi.mock("@tanstack/react-router", () =>
  createRouterMock({ redirect: mockRedirect, useLoaderData: mockUseLoaderData }),
);

vi.mock("../../../src/lib/project.js", () => ({
  fetchProject: vi.fn(),
  fetchProjects: vi.fn(),
  updateProject: mockUpdateProject,
  deleteProject: mockDeleteProject,
  fetchProjectEvents: vi.fn(),
  createProject: vi.fn(),
}));

vi.mock("../../../src/lib/calendar.js", () => ({
  toggleEventComplete: mockToggleEventComplete,
  fetchCalendarEvents: vi.fn(),
  createCalendarEvent: vi.fn(),
  updateCalendarEvent: vi.fn(),
  deleteCalendarEvent: vi.fn(),
  fetchFeedToken: vi.fn(),
  generateFeedToken: vi.fn(),
  fetchCreatorEvents: vi.fn(),
  createCreatorEvent: vi.fn(),
  updateCreatorEvent: vi.fn(),
  fetchEventTypes: vi.fn(),
  createCustomEventType: vi.fn(),
  deleteCreatorEvent: vi.fn(),
}));

vi.mock("../../../src/lib/api-server.js", () => ({
  fetchAuthStateServer: mockFetchAuthStateServer,
  fetchApiServer: mockFetchApiServer,
}));

vi.mock("../../../src/lib/config.js", () => ({
  DEMO_MODE: false,
  features: {},
  isFeatureEnabled: mockIsFeatureEnabled,
}));

vi.mock("../../../src/styles/listing-page.module.css", () => ({
  default: { heading: "heading", status: "status" },
}));

vi.mock("../../../src/routes/projects_.$projectSlug.module.css", () => ({
  default: {
    page: "page",
    backLink: "backLink",
    projectHeader: "projectHeader",
    projectTitleRow: "projectTitleRow",
    completedBadge: "completedBadge",
    projectDescription: "projectDescription",
    projectActions: "projectActions",
    actionButton: "actionButton",
    deleteButton: "deleteButton",
    error: "error",
    timelineSection: "timelineSection",
    timelineHeader: "timelineHeader",
    timelineHeading: "timelineHeading",
    addEventButton: "addEventButton",
    formWrapper: "formWrapper",
    timelineList: "timelineList",
  },
}));

vi.mock("../../../src/components/calendar/event-card.js", () => ({
  EventCard: ({ event, onToggleComplete }: { event: { id: string; title: string }; onToggleComplete?: (id: string) => void }) => (
    <div data-testid="event-card" data-event-id={event.id}>
      <span>{event.title}</span>
      {onToggleComplete && (
        <button type="button" onClick={() => onToggleComplete(event.id)}>
          Toggle
        </button>
      )}
    </div>
  ),
}));

vi.mock("../../../src/components/calendar/event-form.js", () => ({
  EventForm: ({ onCancel }: { onCancel: () => void; onSuccess: () => void }) => (
    <div data-testid="event-form">
      <button type="button" onClick={onCancel}>Cancel Form</button>
    </div>
  ),
}));

// ── Component Under Test ──

const ProjectDetailPage = extractRouteComponent(
  () => import("../../../src/routes/projects_.$projectSlug.js"),
);

// ── Test Lifecycle ──

const defaultProject = makeMockProject();
const defaultEvent = makeMockCalendarEvent({ eventType: "task", completedAt: null });

beforeEach(() => {
  mockIsFeatureEnabled.mockReturnValue(true);
  mockFetchAuthStateServer.mockResolvedValue({
    user: { id: "user-1" },
    roles: ["stakeholder"],
    isPatron: false,
  });
  mockFetchApiServer.mockResolvedValue({ project: defaultProject });
  mockUseLoaderData.mockReturnValue({
    project: defaultProject,
    events: { items: [defaultEvent], nextCursor: null },
  });
  mockUpdateProject.mockResolvedValue({ ...defaultProject, completed: true });
  mockDeleteProject.mockResolvedValue(undefined);
  mockToggleEventComplete.mockResolvedValue({ ...defaultEvent, completedAt: "2026-03-19T12:00:00.000Z" });
});

// ── Tests ──

describe("ProjectDetailPage", () => {
  it("renders project name", () => {
    render(<ProjectDetailPage />);
    expect(screen.getByText(defaultProject.name)).toBeInTheDocument();
  });

  it("renders project description", () => {
    render(<ProjectDetailPage />);
    expect(screen.getByText(defaultProject.description)).toBeInTheDocument();
  });

  it("shows Completed badge when project is completed", () => {
    mockUseLoaderData.mockReturnValue({
      project: { ...defaultProject, completed: true },
      events: { items: [], nextCursor: null },
    });
    render(<ProjectDetailPage />);
    expect(screen.getByText("Completed")).toBeInTheDocument();
  });

  it("renders timeline events from loader", () => {
    render(<ProjectDetailPage />);
    expect(screen.getByTestId("event-card")).toBeInTheDocument();
    expect(screen.getByText(defaultEvent.title)).toBeInTheDocument();
  });

  it("shows empty timeline message when no events", () => {
    mockUseLoaderData.mockReturnValue({
      project: defaultProject,
      events: { items: [], nextCursor: null },
    });
    render(<ProjectDetailPage />);
    expect(screen.getByText(/no upcoming events or tasks/i)).toBeInTheDocument();
  });

  it("calls toggleEventComplete when task toggle is clicked", async () => {
    const user = userEvent.setup();
    render(<ProjectDetailPage />);

    await user.click(screen.getByRole("button", { name: /toggle/i }));

    await waitFor(() => {
      expect(mockToggleEventComplete).toHaveBeenCalledWith(defaultEvent.id);
    });
  });

  it("renders back link to projects", () => {
    render(<ProjectDetailPage />);
    expect(screen.getByText("Back to Projects")).toBeInTheDocument();
  });

  it("shows the Add Event button", () => {
    render(<ProjectDetailPage />);
    expect(screen.getByRole("button", { name: /add event/i })).toBeInTheDocument();
  });

  it("shows event form when Add Event is clicked", async () => {
    const user = userEvent.setup();
    render(<ProjectDetailPage />);

    await user.click(screen.getByRole("button", { name: /add event/i }));

    expect(screen.getByTestId("event-form")).toBeInTheDocument();
  });
});
