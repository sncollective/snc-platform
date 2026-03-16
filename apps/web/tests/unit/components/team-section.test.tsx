import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, fireEvent, act } from "@testing-library/react";

import {
  makeMockCreatorMember,
  makeMockMemberCandidate,
} from "../../helpers/creator-fixtures.js";

// ── Hoisted Mocks ──

const {
  mockFetchCreatorMembers,
  mockAddCreatorMember,
  mockUpdateCreatorMember,
  mockRemoveCreatorMember,
  mockFetchMemberCandidates,
} = vi.hoisted(() => ({
  mockFetchCreatorMembers: vi.fn(),
  mockAddCreatorMember: vi.fn(),
  mockUpdateCreatorMember: vi.fn(),
  mockRemoveCreatorMember: vi.fn(),
  mockFetchMemberCandidates: vi.fn(),
}));

vi.mock("../../../src/lib/creator.js", () => ({
  fetchCreatorMembers: mockFetchCreatorMembers,
  addCreatorMember: mockAddCreatorMember,
  updateCreatorMember: mockUpdateCreatorMember,
  removeCreatorMember: mockRemoveCreatorMember,
  fetchMemberCandidates: mockFetchMemberCandidates,
  fetchCreatorProfile: vi.fn(),
  updateCreatorProfile: vi.fn(),
  createCreatorEntity: vi.fn(),
  fetchMyCreatorPages: vi.fn(),
}));

// ── Import under test ──

import { TeamSection } from "../../../src/components/creator/team-section.js";

// ── Constants ──

const CREATOR_ID = "creator_1";
const CURRENT_USER_ID = "user_owner";

const OWNER_MEMBER = makeMockCreatorMember({
  userId: CURRENT_USER_ID,
  displayName: "Owner User",
  role: "owner",
});
const EDITOR_MEMBER = makeMockCreatorMember({
  userId: "user_editor",
  displayName: "Editor User",
  role: "editor",
});

// ── Setup ──

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ shouldAdvanceTime: true });

  mockFetchCreatorMembers.mockResolvedValue({
    members: [OWNER_MEMBER, EDITOR_MEMBER],
  });
  mockFetchMemberCandidates.mockResolvedValue({ candidates: [] });
  mockAddCreatorMember.mockResolvedValue({
    members: [OWNER_MEMBER, EDITOR_MEMBER],
  });
  mockUpdateCreatorMember.mockResolvedValue({
    members: [OWNER_MEMBER, EDITOR_MEMBER],
  });
  mockRemoveCreatorMember.mockResolvedValue({
    members: [OWNER_MEMBER],
  });
});

afterEach(() => {
  vi.useRealTimers();
});

// ── Tests ──

describe("TeamSection", () => {
  it("renders member list with names", async () => {
    render(
      <TeamSection creatorId={CREATOR_ID} currentUserId={CURRENT_USER_ID} />,
    );

    await waitFor(() => {
      expect(screen.getByText("Owner User")).toBeInTheDocument();
    });
    expect(screen.getByText("Editor User")).toBeInTheDocument();
  });

  it("shows role dropdowns for owners", async () => {
    render(
      <TeamSection creatorId={CREATOR_ID} currentUserId={CURRENT_USER_ID} />,
    );

    await waitFor(() => {
      expect(screen.getByLabelText("Role for Owner User")).toBeInTheDocument();
    });
    expect(screen.getByLabelText("Role for Editor User")).toBeInTheDocument();
  });

  it("shows remove buttons for owners", async () => {
    render(
      <TeamSection creatorId={CREATOR_ID} currentUserId={CURRENT_USER_ID} />,
    );

    await waitFor(() => {
      expect(screen.getByLabelText("Remove Owner User")).toBeInTheDocument();
    });
    expect(screen.getByLabelText("Remove Editor User")).toBeInTheDocument();
  });

  it("shows search input for owners", async () => {
    render(
      <TeamSection creatorId={CREATOR_ID} currentUserId={CURRENT_USER_ID} />,
    );

    await waitFor(() => {
      expect(screen.getByLabelText("Search users to add")).toBeInTheDocument();
    });
  });

  it("hides add form and remove buttons for non-owners", async () => {
    mockFetchCreatorMembers.mockResolvedValue({
      members: [
        makeMockCreatorMember({
          userId: "user_owner_other",
          displayName: "Owner Other",
          role: "owner",
        }),
        makeMockCreatorMember({
          userId: "user_viewer",
          displayName: "Viewer User",
          role: "viewer",
        }),
      ],
    });

    render(
      <TeamSection creatorId={CREATOR_ID} currentUserId="user_viewer" />,
    );

    await waitFor(() => {
      expect(screen.getByText("Owner Other")).toBeInTheDocument();
    });

    // Should show role badges instead of dropdowns
    expect(screen.getByText("owner")).toBeInTheDocument();
    expect(screen.getByText("viewer")).toBeInTheDocument();

    // No search input or remove buttons
    expect(screen.queryByLabelText("Search users to add")).toBeNull();
    expect(screen.queryByLabelText(/Remove/)).toBeNull();
  });

  it("disables remove for sole owner", async () => {
    mockFetchCreatorMembers.mockResolvedValue({
      members: [OWNER_MEMBER],
    });

    render(
      <TeamSection creatorId={CREATOR_ID} currentUserId={CURRENT_USER_ID} />,
    );

    await waitFor(() => {
      expect(screen.getByLabelText("Remove Owner User")).toBeDisabled();
    });
  });

  it("disables role change for sole owner", async () => {
    mockFetchCreatorMembers.mockResolvedValue({
      members: [OWNER_MEMBER],
    });

    render(
      <TeamSection creatorId={CREATOR_ID} currentUserId={CURRENT_USER_ID} />,
    );

    await waitFor(() => {
      expect(screen.getByLabelText("Role for Owner User")).toBeDisabled();
    });
  });

  it("searches candidates and shows dropdown", async () => {
    const candidate = makeMockMemberCandidate({
      id: "user_new",
      name: "New User",
      email: "new@example.com",
    });
    mockFetchMemberCandidates.mockResolvedValue({
      candidates: [candidate],
    });

    render(
      <TeamSection creatorId={CREATOR_ID} currentUserId={CURRENT_USER_ID} />,
    );

    await waitFor(() => {
      expect(screen.getByLabelText("Search users to add")).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.change(screen.getByLabelText("Search users to add"), {
        target: { value: "New" },
      });
      await vi.advanceTimersByTimeAsync(350);
    });

    await waitFor(() => {
      expect(screen.getByText("New User")).toBeInTheDocument();
    });
    expect(screen.getByText("new@example.com")).toBeInTheDocument();
  });

  it("adds a member after selecting candidate", async () => {
    const candidate = makeMockMemberCandidate({
      id: "user_new",
      name: "New User",
      email: "new@example.com",
    });
    mockFetchMemberCandidates.mockResolvedValue({
      candidates: [candidate],
    });

    const newMembers = [
      OWNER_MEMBER,
      EDITOR_MEMBER,
      makeMockCreatorMember({
        userId: "user_new",
        displayName: "New User",
        role: "editor",
      }),
    ];
    mockAddCreatorMember.mockResolvedValue({ members: newMembers });

    render(
      <TeamSection creatorId={CREATOR_ID} currentUserId={CURRENT_USER_ID} />,
    );

    await waitFor(() => {
      expect(screen.getByLabelText("Search users to add")).toBeInTheDocument();
    });

    // Search
    await act(async () => {
      fireEvent.change(screen.getByLabelText("Search users to add"), {
        target: { value: "New" },
      });
      await vi.advanceTimersByTimeAsync(350);
    });

    // Select candidate
    await waitFor(() => {
      expect(screen.getByText("New User")).toBeInTheDocument();
    });
    await act(async () => {
      fireEvent.click(screen.getByText("New User"));
    });

    // Click Add
    await act(async () => {
      fireEvent.click(screen.getByText("Add"));
    });

    await waitFor(() => {
      expect(mockAddCreatorMember).toHaveBeenCalledWith(CREATOR_ID, {
        userId: "user_new",
        role: "editor",
      });
    });
  });

  it("changes member role", async () => {
    const updatedMembers = [
      OWNER_MEMBER,
      makeMockCreatorMember({
        userId: "user_editor",
        displayName: "Editor User",
        role: "viewer",
      }),
    ];
    mockUpdateCreatorMember.mockResolvedValue({ members: updatedMembers });

    render(
      <TeamSection creatorId={CREATOR_ID} currentUserId={CURRENT_USER_ID} />,
    );

    await waitFor(() => {
      expect(screen.getByLabelText("Role for Editor User")).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.change(screen.getByLabelText("Role for Editor User"), {
        target: { value: "viewer" },
      });
    });

    await waitFor(() => {
      expect(mockUpdateCreatorMember).toHaveBeenCalledWith(
        CREATOR_ID,
        "user_editor",
        { role: "viewer" },
      );
    });
  });

  it("removes a member", async () => {
    render(
      <TeamSection creatorId={CREATOR_ID} currentUserId={CURRENT_USER_ID} />,
    );

    await waitFor(() => {
      expect(screen.getByLabelText("Remove Editor User")).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(screen.getByLabelText("Remove Editor User"));
    });

    await waitFor(() => {
      expect(mockRemoveCreatorMember).toHaveBeenCalledWith(
        CREATOR_ID,
        "user_editor",
      );
    });
  });

  it("shows error on fetch failure", async () => {
    mockFetchCreatorMembers.mockRejectedValue(new Error("Network error"));

    render(
      <TeamSection creatorId={CREATOR_ID} currentUserId={CURRENT_USER_ID} />,
    );

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Failed to load team members",
      );
    });
  });

  it("shows error on add failure", async () => {
    const candidate = makeMockMemberCandidate();
    mockFetchMemberCandidates.mockResolvedValue({
      candidates: [candidate],
    });
    mockAddCreatorMember.mockRejectedValue(new Error("Already a member"));

    render(
      <TeamSection creatorId={CREATOR_ID} currentUserId={CURRENT_USER_ID} />,
    );

    await waitFor(() => {
      expect(screen.getByLabelText("Search users to add")).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.change(screen.getByLabelText("Search users to add"), {
        target: { value: "cand" },
      });
      await vi.advanceTimersByTimeAsync(350);
    });

    await waitFor(() => {
      expect(screen.getByText("Candidate User")).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(screen.getByText("Candidate User"));
    });

    await act(async () => {
      fireEvent.click(screen.getByText("Add"));
    });

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Already a member");
    });
  });
});
