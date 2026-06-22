import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

import { extractRouteComponent } from "../../../../helpers/route-test-utils.js";
import { createRouterMock } from "../../../../helpers/router-mock.js";

// ── Hoisted Mocks ──

const { mockRouteLoaderData, mockParentLoaderData } = vi.hoisted(() => ({
  // The route's own loader data — `{ channelId }`.
  mockRouteLoaderData: vi.fn(),
  // The parent `/creators/$creatorId/manage` loader data — `{ creator, ... }`.
  mockParentLoaderData: vi.fn(),
}));

vi.mock("@tanstack/react-router", () => {
  const base = createRouterMock({
    // Parent route api (getRouteApi) — supplies `{ creator }`.
    getRouteApi: () => ({
      useLoaderData: mockParentLoaderData,
      useParams: () => ({ creatorId: "creator-123" }),
      useRouteContext: () => ({}),
    }),
  });
  // The Route object's own useLoaderData returns the route loader data (`{ channelId }`).
  base.createFileRoute = () => (routeOptions: Record<string, unknown>) => ({
    ...routeOptions,
    useLoaderData: mockRouteLoaderData,
    useParams: () => ({ creatorId: "creator-123" }),
  });
  return base;
});

// The surface is mounted only in the provisioned branch; stub it so the route test
// stays focused on the mount decision (the surface has its own isolated test suite).
const { mockEditorialSurface } = vi.hoisted(() => ({
  mockEditorialSurface: vi.fn(),
}));

vi.mock("../../../../../src/components/playout/editorial-surface.js", () => ({
  EditorialSurface: (props: { channelId: string; spineTopic: string }) => {
    mockEditorialSurface(props);
    return <div data-testid="editorial-surface" data-channel={props.channelId} data-topic={props.spineTopic} />;
  },
}));

vi.mock("../../../../../src/contexts/spine-context.js", () => ({
  SpineProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("../../../../../src/lib/api-server.js", () => ({
  fetchApiServer: vi.fn(),
}));

// ── Component Under Test ──

const ProgrammingPage = extractRouteComponent(
  () => import("../../../../../src/routes/creators/$creatorId/manage/programming.js"),
);

// ── Lifecycle ──

beforeEach(() => {
  mockParentLoaderData.mockReturnValue({ creator: { id: "creator-123", handle: "my-band" } });
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ── Tests ──

describe("ProgrammingPage", () => {
  it("renders the editorial surface wired to the content topic when a channel exists", async () => {
    mockRouteLoaderData.mockReturnValue({ channelId: "ch_creator_1" });

    render(<ProgrammingPage />);

    await waitFor(() => {
      expect(screen.getByTestId("editorial-surface")).toBeInTheDocument();
    });
    const surface = screen.getByTestId("editorial-surface");
    expect(surface).toHaveAttribute("data-channel", "ch_creator_1");
    // Creator editorial rides the `content` spine topic, not the admin-only `playout`.
    expect(surface).toHaveAttribute("data-topic", "content");
    // Page heading is present regardless of branch (WCAG 1.3.1).
    expect(screen.getByRole("heading", { level: 1, name: "Programming" })).toBeInTheDocument();
  });

  it("shows the setup affordance (not an error) when the channel is unprovisioned", () => {
    mockRouteLoaderData.mockReturnValue({ channelId: null });

    render(<ProgrammingPage />);

    // No surface — the setup card instead.
    expect(screen.queryByTestId("editorial-surface")).toBeNull();
    expect(screen.getByText("Set up streaming to start programming")).toBeInTheDocument();
    // Honest guidance, not an error alert.
    expect(screen.queryByRole("alert")).toBeNull();
    // Heading still present in the null branch.
    expect(screen.getByRole("heading", { level: 1, name: "Programming" })).toBeInTheDocument();
  });

  it("links the setup affordance to the Streaming tab", () => {
    mockRouteLoaderData.mockReturnValue({ channelId: null });

    render(<ProgrammingPage />);

    const link = screen.getByRole("link", { name: "Go to Streaming" });
    // The StubLink renders the resolved href; it points at this creator's Streaming tab.
    expect(link).toHaveAttribute("href", "/creators/my-band/manage/streaming");
  });
});
