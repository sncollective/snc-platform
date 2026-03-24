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
  mockFetchApiServer,
  mockIsFeatureEnabled,
  mockRedirect,
  mockNavigate,
  mockInvalidate,
} = vi.hoisted(() => ({
  mockUseLoaderData: vi.fn(),
  mockUpdateProject: vi.fn(),
  mockDeleteProject: vi.fn(),
  mockToggleEventComplete: vi.fn(),
  mockFetchApiServer: vi.fn(),
  mockIsFeatureEnabled: vi.fn(),
  mockRedirect: vi.fn(),
  mockNavigate: vi.fn(),
  mockInvalidate: vi.fn(),
}));

vi.mock("@tanstack/react-router", () =>
  createRouterMock({
    redirect: mockRedirect,
    useNavigate: () => mockNavigate,
    useRouter: () => ({ invalidate: mockInvalidate }),
    getRouteApi: (routeId: string) => ({
      useLoaderData: routeId === "/creators/$creatorId/manage"
        ? () => ({ creator: { id: "creator-uuid-123", displayName: "Test Creator" }, memberRole: "owner", isAdmin: false, userId: "user-1" })
        : mockUseLoaderData,
      useParams: () => ({ creatorId: "creator-uuid-123", projectSlug: "test-project" }),
      useRouteContext: () => ({}),
    }),
  }),
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
  fetchAuthStateServer: vi.fn(),
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

vi.mock(
  "../../../src/routes/creators/$creatorId/manage/projects/project-detail.module.css",
  () => ({
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
  }),
);

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

const ManageProjectDetailPage = extractRouteComponent(
  () => import("../../../src/routes/creators/$creatorId/manage/projects/$projectSlug.js"),
);

// ── Test Lifecycle ──

const defaultProject = makeMockProject();
const defaultEvent = makeMockCalendarEvent({ eventType: "task", completedAt: null });

beforeEach(() => {
  mockIsFeatureEnabled.mockReturnValue(true);
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

describe("ManageProjectDetailPage", () => {
  it("renders project name", () => {
    render(<ManageProjectDetailPage />);
    expect(screen.getByText(defaultProject.name)).toBeInTheDocument();
  });

  it("renders Back to Projects link", () => {
    render(<ManageProjectDetailPage />);
    expect(screen.getByText("Back to Projects")).toBeInTheDocument();
  });

  it("shows timeline events", () => {
    render(<ManageProjectDetailPage />);
    expect(screen.getByTestId("event-card")).toBeInTheDocument();
    expect(screen.getByText(defaultEvent.title)).toBeInTheDocument();
  });

  it("shows empty timeline message when no events", () => {
    mockUseLoaderData.mockReturnValue({
      project: defaultProject,
      events: { items: [], nextCursor: null },
    });
    render(<ManageProjectDetailPage />);
    expect(screen.getByText(/no upcoming events or tasks/i)).toBeInTheDocument();
  });

  it("calls toggleEventComplete when task toggle is clicked", async () => {
    const user = userEvent.setup();
    render(<ManageProjectDetailPage />);

    await user.click(screen.getByRole("button", { name: /toggle/i }));

    await waitFor(() => {
      expect(mockToggleEventComplete).toHaveBeenCalledWith(defaultEvent.id);
    });
  });

  it("shows Add Event button", () => {
    render(<ManageProjectDetailPage />);
    expect(screen.getByRole("button", { name: /add event/i })).toBeInTheDocument();
  });
});
