import { createElement } from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";

import { extractRouteComponent } from "../../helpers/route-test-utils.js";
import { createRouterMock } from "../../helpers/router-mock.js";

// ── Hoisted Mocks ──

const { mockIsFeatureEnabled, mockUseLoaderData } = vi.hoisted(() => ({
  mockIsFeatureEnabled: vi.fn(),
  mockUseLoaderData: vi.fn(),
}));

vi.mock("../../../src/lib/config.js", () => ({
  DEMO_MODE: false,
  features: {},
  isFeatureEnabled: mockIsFeatureEnabled,
}));

vi.mock("@tanstack/react-router", () =>
  createRouterMock({ useLoaderData: mockUseLoaderData }),
);

vi.mock("vidstack", () => ({
  MediaPlayer: (props: Record<string, unknown>) =>
    createElement("div", { "data-testid": "media-player", "data-src": props.src }),
  MediaProvider: () => createElement("div", { "data-testid": "media-provider" }),
}));

vi.mock("../../../src/lib/api-server.js", () => ({
  fetchApiServer: vi.fn(),
}));

vi.mock("../../../src/lib/fetch-utils.js", () => ({
  apiGet: vi.fn(),
  throwIfNotOk: vi.fn(),
}));

// ── Component Under Test ──

const LivePage = extractRouteComponent(() => import("../../../src/routes/live.js"));

// ── Test Lifecycle ──

beforeEach(() => {
  mockIsFeatureEnabled.mockReturnValue(true);
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ── Tests ──

describe("LivePage", () => {
  it("renders Coming Soon when stream is offline", () => {
    mockUseLoaderData.mockReturnValue({
      initialStatus: {
        isLive: false,
        viewerCount: 0,
        lastLiveAt: null,
        hlsUrl: null,
      },
    });

    render(<LivePage />);

    expect(screen.getByRole("heading", { level: 1, name: "Coming Soon" })).toBeInTheDocument();
    expect(screen.getByText("Live streaming is on its way. Stay tuned.")).toBeInTheDocument();
  });

  it("renders Coming Soon when initial status is null", () => {
    mockUseLoaderData.mockReturnValue({ initialStatus: null });

    render(<LivePage />);

    expect(screen.getByRole("heading", { level: 1, name: "Coming Soon" })).toBeInTheDocument();
  });

  it("renders player when stream is live", () => {
    mockUseLoaderData.mockReturnValue({
      initialStatus: {
        isLive: true,
        viewerCount: 42,
        lastLiveAt: "2026-03-25T20:00:00.000Z",
        hlsUrl: "https://stream.example.com/live.m3u8",
      },
    });

    render(<LivePage />);

    expect(screen.getByText("LIVE")).toBeInTheDocument();
    expect(screen.getByText(/42 viewers/)).toBeInTheDocument();
  });

  it("shows singular 'viewer' for count of 1", () => {
    mockUseLoaderData.mockReturnValue({
      initialStatus: {
        isLive: true,
        viewerCount: 1,
        lastLiveAt: "2026-03-25T20:00:00.000Z",
        hlsUrl: "https://stream.example.com/live.m3u8",
      },
    });

    render(<LivePage />);

    expect(screen.getByText(/1 viewer/)).toBeInTheDocument();
    expect(screen.queryByText(/viewers/)).toBeNull();
  });
});
