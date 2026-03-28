import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

import { extractRouteComponent } from "../../../../helpers/route-test-utils.js";
import { createRouterMock } from "../../../../helpers/router-mock.js";

// ── Hoisted Mocks ──

const {
  mockUseLoaderData,
  mockUseParams,
  mockFetchStreamKeys,
  mockCreateStreamKey,
  mockRevokeStreamKey,
} = vi.hoisted(() => ({
  mockUseLoaderData: vi.fn(),
  mockUseParams: vi.fn(),
  mockFetchStreamKeys: vi.fn(),
  mockCreateStreamKey: vi.fn(),
  mockRevokeStreamKey: vi.fn(),
}));

vi.mock("@tanstack/react-router", () => {
  const base = createRouterMock({
    getRouteApi: () => ({
      useLoaderData: mockUseLoaderData,
      useParams: mockUseParams,
      useRouteContext: () => ({}),
    }),
  });
  // Override createFileRoute to also attach useParams + useLoaderData on the Route object
  base.createFileRoute = () => (routeOptions: Record<string, unknown>) => ({
    ...routeOptions,
    useLoaderData: mockUseLoaderData,
    useParams: mockUseParams,
  });
  return base;
});

vi.mock("../../../../../src/lib/streaming.js", () => ({
  fetchStreamKeys: mockFetchStreamKeys,
  createStreamKey: mockCreateStreamKey,
  revokeStreamKey: mockRevokeStreamKey,
}));

// ── Component Under Test ──

const StreamingPage = extractRouteComponent(
  () => import("../../../../../src/routes/creators/$creatorId/manage/streaming.js"),
);

// ── Test Lifecycle ──

beforeEach(() => {
  mockUseParams.mockReturnValue({ creatorId: "creator-123" });
  mockFetchStreamKeys.mockResolvedValue({ keys: [] });
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ── Helpers ──

function makeKey(overrides: Record<string, unknown> = {}) {
  return {
    id: "key-1",
    name: "OBS Home",
    keyPrefix: "sk_a1b2c3d4e",
    createdAt: "2026-03-01T00:00:00.000Z",
    revokedAt: null,
    ...overrides,
  };
}

// ── Tests ──

describe("StreamingPage", () => {
  it("renders create form for owner", async () => {
    mockUseLoaderData.mockReturnValue({ creator: { id: "creator-123" }, memberRole: "owner", isAdmin: false });

    render(<StreamingPage />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Create Key" })).toBeInTheDocument();
    });
    expect(screen.getByRole("textbox", { name: "Stream key name" })).toBeInTheDocument();
  });

  it("renders create form for admin", async () => {
    mockUseLoaderData.mockReturnValue({ creator: { id: "creator-123" }, memberRole: "viewer", isAdmin: true });

    render(<StreamingPage />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Create Key" })).toBeInTheDocument();
    });
  });

  it("shows permission message for non-owner", () => {
    mockUseLoaderData.mockReturnValue({ creator: { id: "creator-123" }, memberRole: "editor", isAdmin: false });

    render(<StreamingPage />);

    expect(screen.getByText("Only creator owners can manage stream keys.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Create Key" })).toBeNull();
  });

  it("lists active keys", async () => {
    mockUseLoaderData.mockReturnValue({ creator: { id: "creator-123" }, memberRole: "owner", isAdmin: false });
    mockFetchStreamKeys.mockResolvedValue({
      keys: [makeKey({ name: "OBS Home" })],
    });

    render(<StreamingPage />);

    await waitFor(() => {
      expect(screen.getByText("OBS Home")).toBeInTheDocument();
    });
    expect(screen.getByText("Active Keys")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Revoke" })).toBeInTheDocument();
  });

  it("creates key and shows raw key banner", async () => {
    mockUseLoaderData.mockReturnValue({ creator: { id: "creator-123" }, memberRole: "owner", isAdmin: false });
    mockCreateStreamKey.mockResolvedValue({
      ...makeKey({ name: "New Key" }),
      rawKey: "sk_abc123rawkey",
    });
    mockFetchStreamKeys.mockResolvedValue({ keys: [] });

    render(<StreamingPage />);

    await waitFor(() => {
      expect(screen.getByRole("textbox", { name: "Stream key name" })).toBeInTheDocument();
    });

    const input = screen.getByRole("textbox", { name: "Stream key name" });
    fireEvent.change(input, { target: { value: "New Key" } });

    const createBtn = screen.getByRole("button", { name: "Create Key" });
    fireEvent.click(createBtn);

    await waitFor(() => {
      expect(screen.getByText("sk_abc123rawkey")).toBeInTheDocument();
    });

    expect(screen.getByText("New stream key (copy now):")).toBeInTheDocument();
    expect(mockCreateStreamKey).toHaveBeenCalledWith("creator-123", "New Key");
  });

  it("revokes a key and shows success message", async () => {
    mockUseLoaderData.mockReturnValue({ creator: { id: "creator-123" }, memberRole: "owner", isAdmin: false });
    mockFetchStreamKeys.mockResolvedValue({
      keys: [makeKey({ name: "OBS Home" })],
    });
    mockRevokeStreamKey.mockResolvedValue({
      ...makeKey({ revokedAt: "2026-03-26T00:00:00.000Z" }),
    });

    render(<StreamingPage />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Revoke" })).toBeInTheDocument();
    });

    // After revoke, mock returns revoked key in the list
    mockFetchStreamKeys.mockResolvedValue({
      keys: [makeKey({ name: "OBS Home", revokedAt: "2026-03-26T00:00:00.000Z" })],
    });

    fireEvent.click(screen.getByRole("button", { name: "Revoke" }));

    await waitFor(() => {
      expect(screen.getByText(/Key "OBS Home" revoked/)).toBeInTheDocument();
    });

    expect(mockRevokeStreamKey).toHaveBeenCalledWith("creator-123", "key-1");
  });
});
