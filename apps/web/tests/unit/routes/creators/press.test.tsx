import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

import { createRouterMock } from "../../../helpers/router-mock.js";
import { extractRoute } from "../../../helpers/route-test-utils.js";

const { mockParentLoader, mockPageLoader } = vi.hoisted(() => ({
  mockParentLoader: vi.fn(),
  mockPageLoader: vi.fn(),
}));

vi.mock("@tanstack/react-router", () =>
  createRouterMock({
    useLoaderData: mockPageLoader,
    getRouteApi: () => ({ useLoaderData: mockParentLoader }),
  }),
);
vi.mock("../../../../src/lib/api-server.js", () => ({ fetchApiServer: vi.fn() }));

const { component: PressPage, route: pressRoute } = extractRoute(
  () => import("../../../../src/routes/creators/$creatorId/press.js"),
);

const payload = {
  creator: { id: "c1", handle: "animalfuture", displayName: "Animal Future", location: "Fort Collins, CO" },
  content: {
    enabled: true,
    shortBio: "Punk songs for the long way home.",
    longBio: null,
    forFansOf: ["The Replacements"],
    streamingLinks: [{ label: "Spotify", url: "https://open.spotify.com/artist/animal" }],
    liveDatesUrl: "https://animalfuture.example/shows",
    standoutTrack: { title: "Get to You", url: "https://open.spotify.com/track/get-to-you", streamsLabel: "14.5k streams and climbing" },
    pressContactEmail: "press@s-nc.org",
    location: "Fort Collins, CO",
    photos: ["creators/c1/press/hero.jpg"],
    releases: [{ slug: "the-illusionist", title: "The Illusionist", catalogNumber: "SNCR-001", personnel: [], fcc: "clean" as const }],
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  mockParentLoader.mockReturnValue({ id: "c1", displayName: "Animal Future", handle: "animalfuture" });
  mockPageLoader.mockReturnValue(payload);
});

describe("public press page", () => {
  it("renders seeded press content, photos, and PDF links", () => {
    render(<PressPage />);

    expect(screen.getByRole("heading", { level: 1, name: "Animal Future" })).toBeInTheDocument();
    expect(screen.getByText("Punk songs for the long way home.")).toBeInTheDocument();
    expect(screen.getByText("14.5k streams and climbing")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Animal Future press photo 1" })).toHaveAttribute(
      "src",
      "/api/creators/c1/press/photos/0",
    );
    expect(screen.getByRole("link", { name: "Download one-pager (PDF)" })).toHaveAttribute(
      "href",
      "/api/creators/c1/press/one-pager.pdf",
    );
  });

  it("builds OG and Twitter metadata from the server loader", () => {
    const head = pressRoute.head as ((args: { loaderData: typeof payload }) => { meta?: Array<Record<string, string>> });
    const result = head({ loaderData: payload });

    expect(result.meta).toEqual(expect.arrayContaining([
      { property: "og:title", content: "Animal Future — Press kit" },
      { property: "og:description", content: "Punk songs for the long way home." },
      { property: "og:image", content: "/api/creators/c1/press/photos/0" },
      { name: "twitter:card", content: "summary_large_image" },
    ]));
  });

  it("renders a graceful unavailable state when the page is disabled", () => {
    mockPageLoader.mockReturnValue(null);
    render(<PressPage />);

    expect(screen.getByRole("heading", { name: "Press kit unavailable" })).toBeInTheDocument();
  });
});
