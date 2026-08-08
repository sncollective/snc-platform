import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import type React from "react";

import type { DeliveredPressPagePayload } from "../../../../src/components/press/press-types.js";
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

const payload: DeliveredPressPagePayload = {
  creator: { id: "c1", handle: "animalfuture", displayName: "Animal Future", location: "Fort Collins, CO" },
  content: {
    enabled: true,
    template: "A" as const,
    tagline: "Socially conscious punk / alt-rock",
    shortBio: "Punk songs for the long way home.",
    longBio: null,
    forFansOf: ["The Replacements"],
    banner: {
      key: "creators/c1/press/banner.jpg",
      alt: "Animal Future live",
      src: "https://images.example/banner.jpg",
      srcSet: "https://images.example/banner.jpg 1920w",
      sizes: "100vw",
    },
    aboutPhoto: null,
    members: [],
    streamingLinks: [{ label: "Spotify", url: "https://open.spotify.com/artist/animal", service: "spotify" as const }],
    liveDatesUrl: "https://animalfuture.example/shows",
    standoutTrack: null,
    highlights: [{ eyebrow: "Standout track", title: "Get to You", metric: "14.5k streams and climbing", coverArt: null }],
    pressContactEmail: "press@s-nc.org",
    location: "Fort Collins, CO",
    photos: [],
    gallery: [],
    releases: [{ slug: "the-illusionist", title: "The Illusionist", catalogNumber: "SNCR-001", personnel: [], fcc: "clean" as const }],
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  mockParentLoader.mockReturnValue({ id: "c1", displayName: "Animal Future", handle: "animalfuture" });
  mockPageLoader.mockReturnValue(payload);
});

describe("public press page", () => {
  it("renders delivered v2 content, exact contact, and PDF links", () => {
    render(<PressPage />);

    expect(screen.getByRole("heading", { level: 1, name: "Animal Future" })).toBeInTheDocument();
    expect(screen.getByText("Punk songs for the long way home.")).toBeInTheDocument();
    expect(screen.getByText("14.5k streams and climbing")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Animal Future live" })).toHaveAttribute(
      "src",
      "https://images.example/banner.jpg",
    );
    expect(screen.getByRole("link", { name: "press@s-nc.org" })).toHaveAttribute("href", "mailto:press@s-nc.org");
    expect(screen.getAllByRole("link", { name: "Download one-pager (PDF) ↓" })[0]).toHaveAttribute(
      "href",
      "/api/creators/c1/press/one-pager.pdf",
    );
  });

  it("builds OG and Twitter metadata from the delivered banner", () => {
    const head = pressRoute.head as ((args: { loaderData: typeof payload }) => { meta?: Array<Record<string, string>> });
    const result = head({ loaderData: payload });

    expect(result.meta).toEqual(expect.arrayContaining([
      { property: "og:title", content: "Animal Future — Press kit" },
      { property: "og:description", content: "Punk songs for the long way home." },
      { property: "og:image", content: "https://images.example/banner.jpg" },
      { name: "twitter:card", content: "summary_large_image" },
    ]));
  });

  it("falls back from about media to the first delivered gallery image", () => {
    const head = pressRoute.head as ((args: { loaderData: typeof payload }) => { meta?: Array<Record<string, string>> });
    const galleryImage = {
      key: "gallery.jpg",
      alt: "Gallery",
      src: "/images/gallery.jpg",
      srcSet: "/images/gallery.jpg 960w",
      sizes: "300px",
    };
    const result = head({
      loaderData: {
        ...payload,
        content: { ...payload.content, banner: null, aboutPhoto: null, gallery: [galleryImage] },
      },
    });

    expect(result.meta).toEqual(expect.arrayContaining([
      { property: "og:image", content: "/images/gallery.jpg" },
      { name: "twitter:image", content: "/images/gallery.jpg" },
    ]));
  });

  it("dispatches the delivered Template B selection", () => {
    mockPageLoader.mockReturnValue({
      ...payload,
      content: { ...payload.content, template: "B" },
    });
    const { container } = render(<PressPage />);
    expect(container.querySelector('[data-press-template="B"]')).toBeInTheDocument();
    expect(container.querySelector('[data-press-template="A"]')).not.toBeInTheDocument();
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
