import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

import { extractRouteComponent } from "../../../../helpers/route-test-utils.js";
import { createRouterMock } from "../../../../helpers/router-mock.js";

// ── Hoisted Mocks ──

const {
  mockUseLoaderData,
  mockUseParams,
  mockUseSearch,
  mockFetchStreamKeys,
  mockCreateStreamKey,
  mockRevokeStreamKey,
} = vi.hoisted(() => ({
  mockUseLoaderData: vi.fn(),
  mockUseParams: vi.fn(),
  mockUseSearch: vi.fn(),
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
  // Override createFileRoute to also attach useParams + useLoaderData + useSearch on the Route object
  base.createFileRoute = () => (routeOptions: Record<string, unknown>) => ({
    ...routeOptions,
    useLoaderData: mockUseLoaderData,
    useParams: mockUseParams,
    useSearch: mockUseSearch,
  });
  return base;
});

vi.mock("../../../../../src/lib/streaming.js", () => ({
  fetchStreamKeys: mockFetchStreamKeys,
  createStreamKey: mockCreateStreamKey,
  revokeStreamKey: mockRevokeStreamKey,
  fetchCreatorSimulcastDestinations: vi.fn().mockResolvedValue({ destinations: [] }),
  createCreatorSimulcastDestination: vi.fn(),
  updateCreatorSimulcastDestination: vi.fn(),
  deleteCreatorSimulcastDestination: vi.fn(),
}));

vi.mock("../../../../../src/lib/fetch-utils.js", () => ({
  apiMutate: vi.fn(),
}));

vi.mock("../../../../../src/lib/url.js", () => ({
  navigateExternal: vi.fn(),
}));

// ── Component Under Test ──

const StreamingPage = extractRouteComponent(
  () => import("../../../../../src/routes/creators/$creatorId/manage/streaming.js"),
);

// ── Test Lifecycle ──

beforeEach(() => {
  mockUseParams.mockReturnValue({ creatorId: "creator-123" });
  mockUseSearch.mockReturnValue({});
  mockFetchStreamKeys.mockResolvedValue({ keys: [] });
  mockCreateStreamKey.mockReset();
  mockRevokeStreamKey.mockReset();
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
    expect(screen.getByRole("button", { name: "Revoke key OBS Home" })).toBeInTheDocument();
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

  it("renders next-publish semantics copy in simulcast section", async () => {
    mockUseLoaderData.mockReturnValue({ creator: { id: "creator-123" }, memberRole: "owner", isAdmin: false });

    render(<StreamingPage />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Create Key" })).toBeInTheDocument();
    });

    expect(
      screen.getByText(/Changes apply the next time you start streaming/),
    ).toBeInTheDocument();
  });

  it("copies stream key to clipboard when copy button is clicked", async () => {
    const mockWriteText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText: mockWriteText } });

    mockUseLoaderData.mockReturnValue({ creator: { id: "creator-123" }, memberRole: "owner", isAdmin: false });
    mockCreateStreamKey.mockResolvedValue({
      ...makeKey({ name: "OBS Home" }),
      rawKey: "sk_rawkey_secret",
    });
    mockFetchStreamKeys.mockResolvedValue({ keys: [] });

    render(<StreamingPage />);

    await waitFor(() => {
      expect(screen.getByRole("textbox", { name: "Stream key name" })).toBeInTheDocument();
    });

    const input = screen.getByRole("textbox", { name: "Stream key name" });
    fireEvent.change(input, { target: { value: "OBS Home" } });
    fireEvent.click(screen.getByRole("button", { name: "Create Key" }));

    // Banner appears with copy button
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Copy stream key to clipboard" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Copy stream key to clipboard" }));

    await waitFor(() => {
      expect(mockWriteText).toHaveBeenCalledWith("sk_rawkey_secret");
    });

    // Copied feedback state
    expect(screen.getByRole("button", { name: "Copy stream key to clipboard" })).toHaveTextContent("Copied!");
  });

  it("confirm path: revoke confirmation dialog confirms revoke and shows success", async () => {
    mockUseLoaderData.mockReturnValue({ creator: { id: "creator-123" }, memberRole: "owner", isAdmin: false });
    mockFetchStreamKeys.mockResolvedValue({
      keys: [makeKey({ name: "OBS Home" })],
    });
    mockRevokeStreamKey.mockResolvedValue({
      ...makeKey({ revokedAt: "2026-03-26T00:00:00.000Z" }),
    });

    render(<StreamingPage />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Revoke key OBS Home" })).toBeInTheDocument();
    });

    // After revoke, mock returns revoked key in the list
    mockFetchStreamKeys.mockResolvedValue({
      keys: [makeKey({ name: "OBS Home", revokedAt: "2026-03-26T00:00:00.000Z" })],
    });

    // Open the confirmation dialog
    fireEvent.click(screen.getByRole("button", { name: "Revoke key OBS Home" }));

    // Dialog should appear with key name and consequence
    await waitFor(() => {
      expect(screen.getByText(/Revoking/)).toBeInTheDocument();
    });
    expect(screen.getByText(/This cannot be undone/)).toBeInTheDocument();

    // Confirm the revoke
    fireEvent.click(screen.getByRole("button", { name: "Revoke key" }));

    await waitFor(() => {
      expect(screen.getByText(/Key "OBS Home" revoked/)).toBeInTheDocument();
    });

    expect(mockRevokeStreamKey).toHaveBeenCalledWith("creator-123", "key-1");
  });

  it("cancel path: revoke confirmation dialog cancel does not call revokeStreamKey", async () => {
    mockUseLoaderData.mockReturnValue({ creator: { id: "creator-123" }, memberRole: "owner", isAdmin: false });
    mockFetchStreamKeys.mockResolvedValue({
      keys: [makeKey({ name: "OBS Home" })],
    });

    render(<StreamingPage />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Revoke key OBS Home" })).toBeInTheDocument();
    });

    // Open the confirmation dialog
    fireEvent.click(screen.getByRole("button", { name: "Revoke key OBS Home" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
    });

    // Cancel — dialog should close, revokeStreamKey must NOT have been called
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    await waitFor(() => {
      expect(screen.queryByRole("button", { name: "Cancel" })).not.toBeInTheDocument();
    });

    expect(mockRevokeStreamKey).not.toHaveBeenCalled();
  });
});
