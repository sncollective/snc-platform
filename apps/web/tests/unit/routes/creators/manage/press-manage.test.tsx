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
  PressImageField: ({ id, label, value, onChange }: {
    id?: string;
    label: string;
    value: typeof imageA | null;
    onChange: (value: typeof imageA | null) => void;
  }) => value ? (
    <section aria-label={label}>
      <img src={`/api/library/raw/${value.key.slice("library/".length)}`} alt={value.alt} />
      <textarea
        id={id ? `${id}-alt` : undefined}
        aria-label={`${label} alternative text`}
        aria-invalid={!value.alt.trim()}
        aria-describedby={!value.alt.trim() && id ? `${id}-alt-error` : undefined}
        value={value.alt}
        onChange={(event) => onChange({ ...value, alt: event.target.value })}
      />
      {!value.alt.trim() && id && <p id={`${id}-alt-error`}>Alternative text is required before publishing.</p>}
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
  pressQuotes: [],
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
    : { ...config, enabled: false });
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

  it("saves publish-invalid blank entities and malformed URLs as a draft", async () => {
    mockFetchConfig.mockResolvedValueOnce({
      ...config,
      members: [{ name: "", role: "Vocals", bio: null, photo: null }],
      highlights: [{ eyebrow: "Release", title: "", description: null, metric: null, url: "coming-soon", coverArt: null }],
      streamingLinks: [{ label: "Spotify", url: "open.spotify/draft", service: "spotify" }],
      liveDatesUrl: "dates pending",
      pressContactEmail: "press at s-nc dot org",
      pressQuotes: [],
    });
    const user = userEvent.setup();
    render(<ManagePressPage />);

    await user.click(await screen.findByRole("button", { name: "Save draft" }));

    await waitFor(() => expect(mockUpdateConfig).toHaveBeenCalledWith(
      "c1",
      expect.objectContaining({
        members: [expect.objectContaining({ name: "" })],
        highlights: [expect.objectContaining({ title: "", url: "coming-soon" })],
        streamingLinks: [expect.objectContaining({ url: "open.spotify/draft" })],
        liveDatesUrl: "dates pending",
        pressContactEmail: "press at s-nc dot org",
        pressQuotes: [],
      }),
    ));
    expect(within(screen.getByRole("status")).getByText("Saved (draft)", { selector: "strong" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Publish draft to live" })).toBeDisabled();
  });

  it("does not overwrite edits made while an older save is in flight", async () => {
    let resolveSave: ((value: typeof config) => void) | undefined;
    mockUpdateConfig.mockImplementationOnce((_id: string, patch: object) => new Promise((resolve) => {
      resolveSave = (value) => resolve(value);
      expect(patch).toEqual(expect.objectContaining({ tagline: "Socially conscious punk" }));
    }));
    const user = userEvent.setup();
    render(<ManagePressPage />);

    await user.click(await screen.findByRole("tab", { name: /About/ }));
    await user.click(screen.getByRole("button", { name: "Save draft" }));
    await waitFor(() => expect(mockUpdateConfig).toHaveBeenCalledOnce());
    await user.type(screen.getByLabelText("Tagline"), " newer");
    resolveSave?.(config);

    await waitFor(() => expect(screen.getByLabelText("Tagline")).toHaveValue("Socially conscious punk newer"));
    expect(within(screen.getByRole("status")).getByText("Unsaved changes", { selector: "strong" })).toBeVisible();
    expect(screen.getByText("Earlier changes saved · newer edits still need saving")).toBeVisible();
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

  it("opens a hidden image issue on its stable invalid alt textarea", async () => {
    mockFetchConfig.mockResolvedValueOnce({
      ...config,
      members: [{ ...config.members[0], photo: { ...imageA, alt: "" } }],
    });
    const user = userEvent.setup();
    render(<ManagePressPage />);

    await user.click(await screen.findByRole("button", { name: /Members — LeAnna Warren photo needs alternative text/ }));

    const alt = screen.getByLabelText(/LeAnna Warren photo.*alternative text/i);
    await waitFor(() => expect(alt).toHaveFocus());
    expect(alt).toHaveAttribute("id", "press-member-0-photo-alt");
    expect(alt).toHaveAttribute("aria-invalid", "true");
    expect(alt).toHaveAccessibleDescription("Alternative text is required before publishing.");
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

  it("unpublishes the live page without saving over or discarding the draft", async () => {
    mockFetchConfig.mockResolvedValueOnce({ ...config, enabled: true });
    const user = userEvent.setup();
    render(<ManagePressPage />);

    await user.click(await screen.findByRole("button", { name: "Unpublish · take offline" }));
    expect(screen.getByRole("alertdialog", { name: "Take the press page offline?" })).toBeVisible();
    expect(screen.getByText(/draft and all authored content stay in the editor/i)).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Unpublish press page" }));

    await waitFor(() => expect(mockApiMutate).toHaveBeenCalledWith(
      "/api/creators/c1/press-config/unpublish",
      { method: "POST" },
    ));
    expect(mockUpdateConfig).not.toHaveBeenCalled();
    expect(within(screen.getByRole("status")).getByText("Press page offline", { selector: "strong" })).toBeVisible();
    expect(screen.getByLabelText("Short bio")).toHaveValue("Short bio");
  });

  it("renders a meaningful full-draft review with composed content", async () => {
    mockFetchConfig.mockResolvedValueOnce({
      ...config,
      banner: imageA,
      aboutPhoto: imageB,
      members: [{ ...config.members[0], photo: imageA }],
      highlights: [{ ...config.highlights[0], coverArt: imageB }],
      gallery: [imageA, imageB],
    });
    const user = userEvent.setup();
    render(<ManagePressPage />);

    await user.click(await screen.findByRole("button", { name: "Open full draft review" }));
    const dialog = screen.getByRole("dialog");

    expect(within(dialog).getByRole("heading", { name: "Draft preview · Animal Future" })).toBeVisible();
    expect(within(dialog).getByRole("heading", { name: "About" })).toBeVisible();
    expect(within(dialog).getByRole("heading", { name: "Members" })).toBeVisible();
    expect(within(dialog).getByRole("heading", { name: "Highlights" })).toBeVisible();
    expect(within(dialog).getByRole("heading", { name: "Gallery" })).toBeVisible();
    expect(within(dialog).getByRole("heading", { name: "Listen" })).toBeVisible();
    expect(within(dialog).getByText("press@s-nc.org")).toBeVisible();
    expect(within(dialog).getAllByRole("img").length).toBeGreaterThanOrEqual(4);
  });

  it("confirms discard and entity removals before applying them", async () => {
    const user = userEvent.setup();
    render(<ManagePressPage />);

    await user.click(await screen.findByRole("button", { name: "Discard draft" }));
    expect(screen.getByRole("alertdialog", { name: "Discard this draft?" })).toBeVisible();
    expect(mockApiMutate).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    await user.click(screen.getByRole("tab", { name: /Members/ }));
    await user.click(screen.getByRole("button", { name: "Remove LeAnna Warren" }));
    expect(screen.getByRole("alertdialog", { name: "Remove LeAnna Warren?" })).toBeVisible();
    expect(screen.getByText("LeAnna Warren", { selector: "strong" })).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Remove item" }));
    expect(screen.queryByText("LeAnna Warren", { selector: "strong" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: /Highlights/ }));
    await user.click(screen.getByRole("button", { name: "Remove The Illusionist" }));
    expect(screen.getByRole("alertdialog", { name: "Remove The Illusionist?" })).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Remove item" }));
    expect(screen.queryByRole("button", { name: "Remove The Illusionist" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: /Links & contact/ }));
    await user.click(screen.getByRole("button", { name: "Remove Spotify" }));
    expect(screen.getByRole("alertdialog", { name: "Remove Spotify?" })).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Remove item" }));
    expect(screen.queryByRole("button", { name: "Remove Spotify" })).not.toBeInTheDocument();
  });

  it("warns when the selected template hides later authored highlights", async () => {
    mockFetchConfig.mockResolvedValueOnce({
      ...config,
      template: "A",
      highlights: [
        ...config.highlights,
        { ...config.highlights[0], title: "Second" },
        { ...config.highlights[0], title: "Third" },
        { ...config.highlights[0], title: "Fourth" },
      ],
    });
    const user = userEvent.setup();
    render(<ManagePressPage />);

    await user.click(await screen.findByRole("tab", { name: /Highlights/ }));

    expect(screen.getByRole("alert")).toHaveTextContent("Template A displays the first 2 authored highlights.");
    expect(screen.getByRole("alert")).toHaveTextContent("2 later highlights are retained in the draft but hidden");
    expect(screen.getByRole("alert")).toHaveTextContent("one-sheet is separately curated to the first 2 or 3 highlights");
  });

  it("saves and clears the curated brand color while exposing query-free PDF previews", async () => {
    const user = userEvent.setup();
    render(<ManagePressPage />);

    await screen.findByRole("heading", { name: "PDF previews" });
    expect(screen.queryByRole("button", { name: "Light" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Dark" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Creator Accent/ })).not.toBeInTheDocument();
    expect(screen.getByText(/not draft-isolated/i)).toBeVisible();
    expect(screen.getByText(/eligible federated creators automatically receive that color as non-text decoration/i)).toBeVisible();
    expect(screen.getByRole("link", { name: "Preview full press PDF" })).toHaveAttribute(
      "href",
      "/api/creators/c1/press/one-pager.pdf",
    );
    expect(screen.getByRole("link", { name: "Preview one-sheet PDF" })).toHaveAttribute(
      "href",
      "/api/creators/c1/press/one-sheet.pdf",
    );

    await user.click(screen.getByRole("button", { name: /#e9c46a brand color/ }));
    await user.click(screen.getByRole("button", { name: "Save draft" }));
    await waitFor(() => expect(mockUpdateProfile).toHaveBeenCalledWith("c1", { brandColor: "#e9c46a" }));

    await user.click(screen.getByRole("button", { name: "Use platform default brand color" }));
    await user.click(screen.getByRole("button", { name: "Save draft" }));
    await waitFor(() => expect(mockUpdateProfile).toHaveBeenCalledWith("c1", { brandColor: null }));
  });

  it("reorders members with keyboard-size controls and announces the new position", async () => {
    const user = userEvent.setup();
    render(<ManagePressPage />);

    await user.click(await screen.findByRole("tab", { name: /Members/ }));
    await user.click(screen.getByRole("button", { name: "Move Charles Tyrie up" }));

    expect(screen.getByText("Charles Tyrie moved to position 1 of 2.")).toHaveAttribute("role", "status");
    await waitFor(() => expect(screen.getAllByRole("button", { name: "Edit" })[0]).toHaveFocus());
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
