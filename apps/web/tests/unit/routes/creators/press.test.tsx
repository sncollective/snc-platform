import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import type React from "react";

import { createRouterMock } from "../../../helpers/router-mock.js";
import { extractRoute } from "../../../helpers/route-test-utils.js";

const {
  mockFetchApiServer,
  mockNotFound,
  mockParentLoader,
  mockPageLoader,
} = vi.hoisted(() => ({
  mockFetchApiServer: vi.fn(),
  mockNotFound: vi.fn(() => ({ isNotFound: true, statusCode: 404 })),
  mockParentLoader: vi.fn(),
  mockPageLoader: vi.fn(),
}));

vi.mock("@tanstack/react-router", () =>
  createRouterMock({
    useLoaderData: mockPageLoader,
    getRouteApi: () => ({ useLoaderData: mockParentLoader }),
    extras: { notFound: mockNotFound },
  }),
);
vi.mock("../../../../src/lib/api-server.js", () => ({
  fetchApiServer: mockFetchApiServer,
}));

const { component: PressPage, route: pressRoute } = extractRoute(
  () => import("../../../../src/routes/creators/$creatorId/press.js"),
);
const { component: ReleaseOneSheetPage, route: releaseRoute } = extractRoute(
  () => import("../../../../src/routes/creators/$creatorId/press/releases/$releaseSlug.js"),
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

  it("turns a disabled or missing creator API response into a real route 404", async () => {
    const apiError = Object.assign(new Error("Press page not found"), {
      statusCode: 404,
    });
    mockFetchApiServer.mockRejectedValueOnce(apiError);
    const loader = pressRoute.loader as (args: {
      params: { creatorId: string };
    }) => Promise<unknown>;

    await expect(loader({ params: { creatorId: "missing" } })).rejects.toMatchObject({
      isNotFound: true,
      statusCode: 404,
    });
    expect(mockNotFound).toHaveBeenCalledOnce();
  });

  it("propagates non-404 API failures", async () => {
    const apiError = Object.assign(new Error("API unavailable"), {
      statusCode: 503,
    });
    mockFetchApiServer.mockRejectedValueOnce(apiError);
    const loader = pressRoute.loader as (args: {
      params: { creatorId: string };
    }) => Promise<unknown>;

    await expect(loader({ params: { creatorId: "animalfuture" } })).rejects.toBe(
      apiError,
    );
    expect(mockNotFound).not.toHaveBeenCalled();
  });

  it("keeps a graceful unavailable component for route 404s", () => {
    const NotFound = pressRoute.notFoundComponent as () => React.ReactElement;
    render(<NotFound />);

    expect(screen.getByRole("heading", { name: "Press kit unavailable" })).toBeInTheDocument();
  });
});

describe("release one-sheet page", () => {
  const releaseData = {
    release: {
      ...payload.content.releases[0]!,
      releaseDate: "2026-08-06",
      format: "Single",
      genre: "Alternative",
      isrc: "US-SNC-26-00001",
      duration: "3:42",
      label: "S/NC Records",
    },
    press: payload,
  };

  it("renders release metadata and the PDF download link", () => {
    mockPageLoader.mockReturnValue(releaseData);
    render(<ReleaseOneSheetPage />);

    expect(screen.getByRole("heading", { level: 1, name: "The Illusionist" })).toBeInTheDocument();
    expect(screen.getByText("SNCR-001")).toBeInTheDocument();
    expect(screen.getByText("US-SNC-26-00001")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Download one-sheet (PDF)" })).toHaveAttribute(
      "href",
      "/api/creators/c1/press/releases/the-illusionist/one-sheet.pdf",
    );
  });

  it("turns a missing release API response into a real route 404", async () => {
    mockFetchApiServer.mockRejectedValueOnce(
      Object.assign(new Error("Release not found"), { statusCode: 404 }),
    );
    const loader = releaseRoute.loader as (args: {
      params: { creatorId: string; releaseSlug: string };
    }) => Promise<unknown>;

    await expect(
      loader({
        params: { creatorId: "animalfuture", releaseSlug: "missing" },
      }),
    ).rejects.toMatchObject({ isNotFound: true, statusCode: 404 });
    expect(mockNotFound).toHaveBeenCalledOnce();
  });
});
