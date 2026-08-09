import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { createRouterMock } from "../../../../helpers/router-mock.js";
import { extractRouteComponent } from "../../../../helpers/route-test-utils.js";

const {
  mockUseParams,
  mockFetchConfig,
  mockUpdateConfig,
  mockFetchProfile,
  mockUpdateProfile,
  mockApiMutate,
} = vi.hoisted(() => ({
  mockUseParams: vi.fn(() => ({ creatorId: "c1" })),
  mockFetchConfig: vi.fn(),
  mockUpdateConfig: vi.fn(),
  mockFetchProfile: vi.fn(),
  mockUpdateProfile: vi.fn(),
  mockApiMutate: vi.fn(),
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

vi.mock("../../../../../src/lib/creator.js", () => ({
  fetchCreatorProfile: mockFetchProfile,
  updateCreatorProfile: mockUpdateProfile,
}));

vi.mock("../../../../../src/lib/fetch-utils.js", () => ({
  apiMutate: mockApiMutate,
}));

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

vi.mock("../../../../../src/components/press/index.js", () => ({
  PressImageField: ({ label, value, onChange }: {
    label: string;
    value: typeof imageA | null;
    onChange: (value: typeof imageA | null) => void;
  }) => value ? (
    <section aria-label={label}>
      <img src={`/api/library/raw/${value.key.slice("library/".length)}`} alt={value.alt} />
      <textarea aria-label={`${label} alternative text`} value={value.alt} onChange={(event) => onChange({ ...value, alt: event.target.value })} />
      <button type="button" onClick={() => onChange({ ...value, alt: "" })}>Clear alt {label}</button>
      <button type="button" onClick={() => onChange(null)}>Remove {label}</button>
    </section>
  ) : (
    <section aria-label={label}>
      <p>No image selected</p>
      <button type="button" onClick={() => onChange(imageB)}>Choose {label}</button>
    </section>
  ),
}));

const ManagePressPage = extractRouteComponent(
  () => import("../../../../../src/routes/creators/$creatorId/manage/press.js"),
);

const config = {
  enabled: false,
  template: "A" as const,
  tagline: "Socially conscious punk",
  shortBio: "Short bio",
  longBio: "Long bio",
  forFansOf: ["The Replacements"],
  banner: null,
  aboutPhoto: null,
  members: [
    { name: "LeAnna Warren", role: "Vocals", bio: "Band founder", photo: null },
    { name: "Charles Tyrie", role: "Drums", bio: null, photo: null },
  ],
  streamingLinks: [{ label: "Spotify", url: "https://open.spotify.com/artist/a", service: "spotify" as const }],
  liveDatesUrl: "https://example.com/shows",
  standoutTrack: { title: "Get to You", url: null, streamsLabel: "14.5k" },
  highlights: [{ eyebrow: "New release", title: "The Illusionist", description: "New single", metric: "14.5k", url: "https://example.com/release", coverArt: null }],
  pressContactEmail: "press@s-nc.org",
  location: "Fort Collins, CO",
  photos: [],
  gallery: [],
  releases: [],
};

const profile = {
  id: "c1",
  displayName: "Animal Future",
  brandColor: "#f4a261" as const,
};

beforeEach(() => {
  vi.clearAllMocks();
  mockFetchConfig.mockResolvedValue(config);
  mockUpdateConfig.mockImplementation(async (_id: string, patch: object) => ({ ...config, ...patch }));
  mockFetchProfile.mockResolvedValue(profile);
  mockUpdateProfile.mockImplementation(async (_id: string, patch: object) => ({ ...profile, ...patch }));
  mockApiMutate.mockImplementation(async (endpoint: string) => endpoint.endsWith("/publish")
    ? { ...config, enabled: true }
    : config);
});

describe("manage press editor", () => {
  it("implements roving WAI-ARIA tabs with Arrow, Home, and End keys", async () => {
    const user = userEvent.setup();
    render(<ManagePressPage />);

    const appearance = await screen.findByRole("tab", { name: /Appearance & media/ });
    const about = screen.getByRole("tab", { name: /About/ });
    const links = screen.getByRole("tab", { name: /Links & contact/ });

    expect(appearance).toHaveAttribute("aria-selected", "true");
    expect(appearance).toHaveAttribute("tabindex", "0");
    expect(about).toHaveAttribute("tabindex", "-1");

    appearance.focus();
    await user.keyboard("{ArrowRight}");
    await waitFor(() => expect(about).toHaveFocus());
    expect(about).toHaveAttribute("aria-selected", "true");

    await user.keyboard("{End}");
    await waitFor(() => expect(links).toHaveFocus());
    await user.keyboard("{Home}");
    await waitFor(() => expect(appearance).toHaveFocus());
  });

  it("loads the cohesive draft, marks its tab dirty, and saves draft content without publishing", async () => {
    const user = userEvent.setup();
    render(<ManagePressPage />);

    await user.click(await screen.findByRole("tab", { name: /About/ }));
    const bio = screen.getByLabelText("Short bio");
    await user.clear(bio);
    await user.type(bio, "Updated bio");

    expect(screen.getByRole("tab", { name: /About.*Unsaved/ })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Save draft" }));

    await waitFor(() => expect(mockUpdateConfig).toHaveBeenCalledWith(
      "c1",
      expect.objectContaining({
        enabled: false,
        shortBio: "Updated bio",
        members: config.members,
        highlights: config.highlights,
        gallery: [],
        photos: [],
      }),
    ));
    expect(mockApiMutate).not.toHaveBeenCalled();
    expect(within(screen.getByRole("status")).getByText("Saved (draft)", { selector: "strong" })).toBeVisible();
  });

  it("shows cross-tab errors, blocks publish, and opens/focuses a hidden invalid field", async () => {
    mockFetchConfig.mockResolvedValueOnce({
      ...config,
      streamingLinks: [{ label: "Spotify", url: "open.spotify/animal-future", service: "spotify" }],
    });
    const user = userEvent.setup();
    render(<ManagePressPage />);

    const errorLink = await screen.findByRole("button", { name: /Links & contact — Spotify needs a full URL/ });
    expect(screen.getByRole("button", { name: "Publish draft to live" })).toBeDisabled();

    await user.click(errorLink);
    expect(screen.getByRole("tab", { name: /Links & contact.*1 issue/ })).toHaveAttribute("aria-selected", "true");
    await waitFor(() => expect(screen.getByLabelText("URL")).toHaveFocus());
    expect(mockApiMutate).not.toHaveBeenCalled();
  });

  it("publishes only after saving an enabled, valid draft", async () => {
    const user = userEvent.setup();
    render(<ManagePressPage />);

    await user.click(await screen.findByRole("button", { name: "Publish draft to live" }));

    await waitFor(() => expect(mockUpdateConfig).toHaveBeenCalledWith(
      "c1",
      expect.objectContaining({ enabled: true }),
    ));
    expect(mockApiMutate).toHaveBeenCalledWith(
      "/api/creators/c1/press-config/publish",
      { method: "POST" },
    );
    expect(within(screen.getByRole("status")).getByText("Published to live", { selector: "strong" })).toBeVisible();
  });

  it("saves the curated brand color and emits the selected PDF preview scheme", async () => {
    const user = userEvent.setup();
    render(<ManagePressPage />);

    await user.click(await screen.findByRole("button", { name: /#e9c46a brand color/ }));
    await user.click(screen.getByRole("button", { name: /Creator Accent/ }));
    expect(screen.getByRole("link", { name: "Preview PDF" })).toHaveAttribute(
      "href",
      "/api/creators/c1/press/one-pager.pdf?theme=brand",
    );
    await user.click(screen.getByRole("button", { name: "Save draft" }));

    await waitFor(() => expect(mockUpdateProfile).toHaveBeenCalledWith("c1", { brandColor: "#e9c46a" }));
  });

  it("reorders members with keyboard-size controls and announces the new position", async () => {
    const user = userEvent.setup();
    render(<ManagePressPage />);

    await user.click(await screen.findByRole("tab", { name: /Members/ }));
    await user.click(screen.getByRole("button", { name: "Move Charles Tyrie up" }));

    expect(screen.getByText("Charles Tyrie moved to position 1 of 2.")).toHaveAttribute("role", "status");
    await user.click(screen.getByRole("button", { name: "Save draft" }));
    await waitFor(() => expect(mockUpdateConfig).toHaveBeenCalledWith(
      "c1",
      expect.objectContaining({ members: [config.members[1], config.members[0]] }),
    ));
  });

  it("keeps remove-and-replace gallery state local and derives transitional photo keys on save", async () => {
    mockFetchConfig.mockResolvedValueOnce({ ...config, gallery: [imageA], photos: [keyA] });
    const user = userEvent.setup();
    render(<ManagePressPage />);

    await user.click(await screen.findByRole("tab", { name: /Gallery/ }));
    expect(screen.getByRole("img", { name: "Press photo A" })).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Remove Gallery image 1 · 4:3" }));
    await user.click(screen.getByRole("button", { name: "Choose Add gallery image · 4:3" }));
    expect(screen.getByRole("img", { name: "Press photo B" })).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Save draft" }));
    await waitFor(() => expect(mockUpdateConfig).toHaveBeenCalledWith(
      "c1",
      expect.objectContaining({ gallery: [imageB], photos: [keyB] }),
    ));
  });

  it("keeps a save failure visible while preserving unsaved browser changes", async () => {
    mockUpdateConfig.mockRejectedValueOnce(new Error("Connection lost"));
    const user = userEvent.setup();
    render(<ManagePressPage />);

    await user.click(await screen.findByRole("tab", { name: /About/ }));
    await user.type(screen.getByLabelText("Tagline"), " now");
    await user.click(screen.getByRole("button", { name: "Save draft" }));

    expect(await screen.findByText("Error · draft not saved", { selector: "strong" })).toBeVisible();
    expect(screen.getByText("Connection lost")).toBeVisible();
    expect(screen.getByLabelText("Tagline")).toHaveValue("Socially conscious punk now");
  });
});
