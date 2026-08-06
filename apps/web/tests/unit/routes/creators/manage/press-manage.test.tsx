import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { createRouterMock } from "../../../../helpers/router-mock.js";
import { extractRouteComponent } from "../../../../helpers/route-test-utils.js";

const { mockUseParams, mockFetchConfig, mockUpdateConfig, mockUploadPhoto } = vi.hoisted(() => ({
  mockUseParams: vi.fn(() => ({ creatorId: "c1" })),
  mockFetchConfig: vi.fn(),
  mockUpdateConfig: vi.fn(),
  mockUploadPhoto: vi.fn(),
}));

vi.mock("@tanstack/react-router", () => {
  const base = createRouterMock();
  base.createFileRoute = () => (routeOptions: Record<string, unknown>) => ({
    ...routeOptions,
    useParams: mockUseParams,
  });
  return base;
});
vi.mock("../../../../../src/lib/press.js", () => ({
  fetchPressConfig: mockFetchConfig,
  updatePressConfig: mockUpdateConfig,
  uploadPressPhoto: mockUploadPhoto,
}));

const ManagePressPage = extractRouteComponent(
  () => import("../../../../../src/routes/creators/$creatorId/manage/press.js"),
);

const config = {
  enabled: false,
  shortBio: "Short bio",
  longBio: "Long bio",
  forFansOf: ["The Replacements"],
  streamingLinks: [{ label: "Spotify", url: "https://open.spotify.com/artist/a" }],
  liveDatesUrl: null,
  standoutTrack: { title: "Get to You", url: null, streamsLabel: "14.5k" },
  pressContactEmail: "press@s-nc.org",
  location: "Fort Collins, CO",
  photos: [],
  releases: [],
};

beforeEach(() => {
  vi.clearAllMocks();
  mockFetchConfig.mockResolvedValue(config);
  mockUpdateConfig.mockImplementation(async (_id: string, patch: object) => ({ ...config, ...patch }));
  mockUploadPhoto.mockResolvedValue({ key: "creators/c1/press/photo.jpg" });
});

describe("manage press editor", () => {
  it("loads the config and saves edits", async () => {
    const user = userEvent.setup();
    render(<ManagePressPage />);

    const bio = await screen.findByLabelText("Short bio");
    await user.clear(bio);
    await user.type(bio, "Updated bio");
    await user.click(screen.getByRole("checkbox", { name: "Publish the public press page" }));
    await user.click(screen.getByRole("button", { name: "Save press page" }));

    await waitFor(() => expect(mockUpdateConfig).toHaveBeenCalledWith(
      "c1",
      expect.objectContaining({ enabled: true, shortBio: "Updated bio" }),
    ));
    expect(await screen.findByRole("status")).toHaveTextContent("Changes saved");
  });

  it("uploads a photo and includes its key in the next save", async () => {
    const user = userEvent.setup();
    render(<ManagePressPage />);
    await screen.findByLabelText("Short bio");

    const file = new File(["photo"], "photo.jpg", { type: "image/jpeg" });
    await user.upload(screen.getByLabelText("Upload press photo"), file);
    expect(await screen.findByRole("img", { name: "Press photo 1" })).toHaveAttribute(
      "src",
      "/api/creators/c1/press/photos/0",
    );

    await user.click(screen.getByRole("button", { name: "Save press page" }));
    await waitFor(() => expect(mockUpdateConfig).toHaveBeenCalledWith(
      "c1",
      expect.objectContaining({ photos: ["creators/c1/press/photo.jpg"] }),
    ));
  });
});
