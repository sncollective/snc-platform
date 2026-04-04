import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// ── Hoisted Mocks ──

const { mockApiGet, mockApiMutate } = vi.hoisted(() => ({
  mockApiGet: vi.fn(),
  mockApiMutate: vi.fn(),
}));

vi.mock("../../../src/lib/fetch-utils.js", () => ({
  apiGet: mockApiGet,
  apiMutate: mockApiMutate,
}));

// ── Import component under test (after mocks) ──

import { FollowButton } from "../../../src/components/creator/follow-button.js";

// ── Helpers ──

function defaultStatus(overrides?: { isFollowing?: boolean; followerCount?: number }) {
  return {
    isFollowing: overrides?.isFollowing ?? false,
    followerCount: overrides?.followerCount ?? 0,
  };
}

// ── Test Lifecycle ──

beforeEach(() => {
  mockApiGet.mockResolvedValue(defaultStatus());
  mockApiMutate.mockResolvedValue(undefined);
});

// ── Tests ──

describe("FollowButton", () => {
  it("renders Follow button when not following", async () => {
    mockApiGet.mockResolvedValue(defaultStatus({ isFollowing: false }));
    render(<FollowButton creatorId="creator-1" isAuthenticated={true} />);
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Follow" })).toBeInTheDocument();
    });
  });

  it("renders Following button when already following", async () => {
    mockApiGet.mockResolvedValue(defaultStatus({ isFollowing: true, followerCount: 5 }));
    render(<FollowButton creatorId="creator-1" isAuthenticated={true} />);
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Following" })).toBeInTheDocument();
    });
  });

  it("shows follower count when count is greater than zero", async () => {
    mockApiGet.mockResolvedValue(defaultStatus({ isFollowing: false, followerCount: 42 }));
    render(<FollowButton creatorId="creator-1" isAuthenticated={true} />);
    await waitFor(() => {
      expect(screen.getByText("42")).toBeInTheDocument();
    });
  });

  it("does not show follower count when count is zero", async () => {
    mockApiGet.mockResolvedValue(defaultStatus({ isFollowing: false, followerCount: 0 }));
    render(<FollowButton creatorId="creator-1" isAuthenticated={true} />);
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Follow" })).toBeInTheDocument();
      expect(screen.queryByText("0")).toBeNull();
    });
  });

  it("is disabled for unauthenticated users", async () => {
    mockApiGet.mockResolvedValue(defaultStatus({ isFollowing: false }));
    render(<FollowButton creatorId="creator-1" isAuthenticated={false} />);
    await waitFor(() => {
      const button = screen.getByRole("button", { name: "Follow" });
      expect(button).toBeDisabled();
    });
  });

  it("shows sign in hint title for unauthenticated users", async () => {
    mockApiGet.mockResolvedValue(defaultStatus({ isFollowing: false }));
    render(<FollowButton creatorId="creator-1" isAuthenticated={false} />);
    await waitFor(() => {
      const button = screen.getByRole("button", { name: "Follow" });
      expect(button).toHaveAttribute("title", "Sign in to follow");
    });
  });

  it("optimistically increments count when following", async () => {
    const user = userEvent.setup();
    mockApiGet.mockResolvedValue(defaultStatus({ isFollowing: false, followerCount: 3 }));
    render(<FollowButton creatorId="creator-1" isAuthenticated={true} />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Follow" })).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "Follow" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Following" })).toBeInTheDocument();
      expect(screen.getByText("4")).toBeInTheDocument();
    });
  });

  it("optimistically decrements count when unfollowing", async () => {
    const user = userEvent.setup();
    mockApiGet.mockResolvedValue(defaultStatus({ isFollowing: true, followerCount: 5 }));
    render(<FollowButton creatorId="creator-1" isAuthenticated={true} />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Following" })).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "Following" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Follow" })).toBeInTheDocument();
      expect(screen.getByText("4")).toBeInTheDocument();
    });
  });

  it("calls DELETE endpoint when unfollowing", async () => {
    const user = userEvent.setup();
    mockApiGet.mockResolvedValue(defaultStatus({ isFollowing: true, followerCount: 1 }));
    render(<FollowButton creatorId="creator-1" isAuthenticated={true} />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Following" })).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "Following" }));

    await waitFor(() => {
      expect(mockApiMutate).toHaveBeenCalledWith(
        "/api/creators/creator-1/follow",
        { method: "DELETE" },
      );
    });
  });

  it("calls POST endpoint when following", async () => {
    const user = userEvent.setup();
    mockApiGet.mockResolvedValue(defaultStatus({ isFollowing: false }));
    render(<FollowButton creatorId="creator-1" isAuthenticated={true} />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Follow" })).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "Follow" }));

    await waitFor(() => {
      expect(mockApiMutate).toHaveBeenCalledWith(
        "/api/creators/creator-1/follow",
        { method: "POST" },
      );
    });
  });
});
