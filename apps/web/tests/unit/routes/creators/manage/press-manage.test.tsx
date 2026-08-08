import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { createRouterMock } from "../../../../helpers/router-mock.js";
import { extractRouteComponent } from "../../../../helpers/route-test-utils.js";

const {
  mockUseParams,
  mockFetchConfig,
  mockUpdateConfig,
  mockSelectFile,
} = vi.hoisted(() => ({
  mockUseParams: vi.fn(() => ({ creatorId: "c1" })),
  mockFetchConfig: vi.fn(),
  mockUpdateConfig: vi.fn(),
  mockSelectFile: vi.fn(),
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
}));
vi.mock("../../../../../src/components/press/index.js", () => ({
  PressImageField: ({ label, value, onChange }: {
    label: string;
    value: { key: string; alt: string } | null;
    onChange: (value: { key: string; alt: string; credit: null; crop: { x: number; y: number; width: number; height: number } } | null) => void;
  }) => value ? (
    <div>
      <img src={`/api/library/raw/${value.key.slice("library/".length)}`} alt={value.alt} />
      <button type="button" onClick={() => onChange(null)}>Remove {label}</button>
    </div>
  ) : (
    <label>
      Upload {label}
      <input
        type="file"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void mockSelectFile(file).then(onChange);
        }}
      />
    </label>
  ),
}));

const ManagePressPage = extractRouteComponent(
  () => import("../../../../../src/routes/creators/$creatorId/manage/press.js"),
);

const keyA = `library/aa/${"a".repeat(64)}.jpg`;
const keyB = `library/bb/${"b".repeat(64)}.jpg`;
const imageA = {
  key: keyA,
  alt: "Press photo A",
  credit: null,
  crop: { x: 0, y: 0, width: 1, height: 1 },
};
const imageB = {
  key: keyB,
  alt: "Press photo B",
  credit: null,
  crop: { x: 0, y: 0, width: 1, height: 1 },
};

const config = {
  enabled: false,
  template: "A",
  tagline: null,
  shortBio: "Short bio",
  longBio: "Long bio",
  forFansOf: ["The Replacements"],
  banner: null,
  aboutPhoto: null,
  members: [],
  streamingLinks: [{ label: "Spotify", url: "https://open.spotify.com/artist/a" }],
  liveDatesUrl: null,
  standoutTrack: { title: "Get to You", url: null, streamsLabel: "14.5k" },
  highlights: [],
  pressContactEmail: "press@s-nc.org",
  location: "Fort Collins, CO",
  photos: [],
  gallery: [],
  releases: [],
};

beforeEach(() => {
  vi.clearAllMocks();
  mockFetchConfig.mockResolvedValue(config);
  mockUpdateConfig.mockImplementation(async (_id: string, patch: object) => ({ ...config, ...patch }));
  mockSelectFile.mockImplementation(async (file: File) =>
    file.size === "changed bytes".length ? imageB : imageA);
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
      expect.objectContaining({
        enabled: true,
        shortBio: "Updated bio",
        gallery: [],
        photos: [],
      }),
    ));
    expect(await screen.findByRole("status")).toHaveTextContent("Changes saved");
  });

  it("previews changed bytes under the same filename before saving the new key", async () => {
    mockFetchConfig.mockResolvedValueOnce({ ...config, gallery: [imageA], photos: [keyA] });
    const user = userEvent.setup();
    render(<ManagePressPage />);

    expect(await screen.findByRole("img", { name: "Press photo A" })).toHaveAttribute(
      "src",
      `/api/library/raw/aa/${"a".repeat(64)}.jpg`,
    );
    await user.click(screen.getByRole("button", { name: "Remove Press photo 1" }));
    expect(screen.queryByRole("img", { name: "Press photo A" })).not.toBeInTheDocument();

    const changed = new File(["changed bytes"], "press-photo.jpg", { type: "image/jpeg" });
    await user.upload(screen.getByLabelText("Upload Add press photo"), changed);
    expect(await screen.findByRole("img", { name: "Press photo B" })).toHaveAttribute(
      "src",
      `/api/library/raw/bb/${"b".repeat(64)}.jpg`,
    );

    await user.click(screen.getByRole("button", { name: "Save press page" }));
    await waitFor(() => expect(mockUpdateConfig).toHaveBeenCalledWith(
      "c1",
      expect.objectContaining({ gallery: [imageB], photos: [keyB] }),
    ));
  });

  it("saves explicit empty gallery and photos after removing every image", async () => {
    mockFetchConfig.mockResolvedValueOnce({ ...config, gallery: [imageA], photos: [keyA] });
    const user = userEvent.setup();
    render(<ManagePressPage />);

    await user.click(await screen.findByRole("button", { name: "Remove Press photo 1" }));
    await user.click(screen.getByRole("button", { name: "Save press page" }));

    await waitFor(() => expect(mockUpdateConfig).toHaveBeenCalledWith(
      "c1",
      expect.objectContaining({ gallery: [], photos: [] }),
    ));
  });

  it("treats byte-identical uploads as the same reusable key", async () => {
    const user = userEvent.setup();
    render(<ManagePressPage />);
    await screen.findByLabelText("Short bio");

    await user.upload(
      screen.getByLabelText("Upload Add press photo"),
      new File(["original bytes"], "press-photo.jpg", { type: "image/jpeg" }),
    );

    expect(await screen.findByRole("img", { name: "Press photo A" })).toBeVisible();
    expect(mockSelectFile).toHaveBeenCalledWith(expect.objectContaining({ name: "press-photo.jpg" }));
  });
});
