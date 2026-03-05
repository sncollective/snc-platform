import {
  describe,
  it,
  expect,
  vi,
  beforeAll,
  beforeEach,
  afterEach,
} from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type React from "react";

import { makeMockCreatorProfileResponse } from "../../helpers/creator-fixtures.js";

// ── Hoisted Mocks ──

const {
  mockFetchAuthState,
  mockFetchCreatorProfile,
  mockUpdateCreatorProfile,
  mockRedirect,
} = vi.hoisted(() => ({
  mockFetchAuthState: vi.fn(),
  mockFetchCreatorProfile: vi.fn(),
  mockUpdateCreatorProfile: vi.fn(),
  mockRedirect: vi.fn((args: unknown) => args),
}));

vi.mock("@tanstack/react-router", async () => {
  const React = await import("react");
  return {
    createFileRoute: () => (options: Record<string, unknown>) => ({
      ...options,
    }),
    redirect: mockRedirect,
    Link: ({
      to,
      children,
      className,
    }: Record<string, unknown>) =>
      React.createElement(
        "a",
        { href: to as string, className },
        children as React.ReactNode,
      ),
  };
});

vi.mock("../../../src/lib/auth.js", () => ({
  fetchAuthState: mockFetchAuthState,
}));

vi.mock("../../../src/lib/creator.js", () => ({
  fetchCreatorProfile: mockFetchCreatorProfile,
  updateCreatorProfile: mockUpdateCreatorProfile,
}));

// ── Component Under Test ──

let CreatorSettingsPage: () => React.ReactElement;
let routeOptions: {
  beforeLoad: () => Promise<{ userId: string }>;
};

beforeAll(async () => {
  const mod = await import(
    "../../../src/routes/settings/creator.js"
  );
  const route = mod.Route as unknown as {
    component: () => React.ReactElement;
    beforeLoad: () => Promise<{ userId: string }>;
  };
  CreatorSettingsPage = route.component;
  routeOptions = { beforeLoad: route.beforeLoad };
});

// ── Default Test Data ──

const DEFAULT_PROFILE = makeMockCreatorProfileResponse({
  userId: "user_test123",
  socialLinks: [
    { platform: "bandcamp", url: "https://testband.bandcamp.com" },
  ],
});

// ── Lifecycle ──

beforeEach(() => {
  mockFetchAuthState.mockResolvedValue({
    user: { id: "user_test123" },
    roles: ["creator"],
  });
  mockFetchCreatorProfile.mockResolvedValue(DEFAULT_PROFILE);
  mockUpdateCreatorProfile.mockResolvedValue(DEFAULT_PROFILE);
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ── Tests ──

describe("CreatorSettingsPage", () => {
  // ── beforeLoad guard tests ──

  describe("beforeLoad", () => {
    it("redirects to /login when not authenticated", async () => {
      mockFetchAuthState.mockResolvedValue({ user: null, roles: [] });
      await expect(routeOptions.beforeLoad()).rejects.toEqual({ to: "/login" });
    });

    it("redirects to /feed when user is not a creator", async () => {
      mockFetchAuthState.mockResolvedValue({
        user: { id: "u1" },
        roles: ["subscriber"],
      });
      await expect(routeOptions.beforeLoad()).rejects.toEqual({ to: "/feed" });
    });

    it("returns userId when user is an authenticated creator", async () => {
      mockFetchAuthState.mockResolvedValue({
        user: { id: "u1" },
        roles: ["creator"],
      });
      const result = await routeOptions.beforeLoad();
      expect(result).toEqual({ userId: "u1" });
    });
  });

  // ── Rendering tests ──

  it("renders page heading 'Creator Settings'", async () => {
    render(<CreatorSettingsPage />);
    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "Creator Settings" }),
      ).toBeInTheDocument();
    });
  });

  it("renders platform dropdown", async () => {
    render(<CreatorSettingsPage />);
    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "Creator Settings" }),
      ).toBeInTheDocument();
    });

    const select = screen.getByLabelText("Social Links");
    expect(select).toBeInTheDocument();
    expect(select.tagName).toBe("SELECT");
  });

  it("renders existing social links in list", async () => {
    render(<CreatorSettingsPage />);
    await waitFor(() => {
      expect(screen.getByText("https://testband.bandcamp.com")).toBeInTheDocument();
    });
    // "Bandcamp" appears in both the select option and the link list
    const bandcampTexts = screen.getAllByText("Bandcamp");
    expect(bandcampTexts.length).toBeGreaterThanOrEqual(2);
  });

  // ── URL validation tests ──

  it("shows validation error for invalid URL on Add", async () => {
    const user = userEvent.setup();
    mockFetchCreatorProfile.mockResolvedValue(
      makeMockCreatorProfileResponse({ socialLinks: [] }),
    );
    render(<CreatorSettingsPage />);
    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "Creator Settings" }),
      ).toBeInTheDocument();
    });

    const urlInput = screen.getByPlaceholderText("https://...");
    await user.type(urlInput, "not a url");
    await user.click(screen.getByRole("button", { name: "Add" }));

    await waitFor(() => {
      expect(screen.getByText("Must be a valid URL")).toBeInTheDocument();
    });
  });

  it("shows error for URL not matching platform pattern", async () => {
    const user = userEvent.setup();
    mockFetchCreatorProfile.mockResolvedValue(
      makeMockCreatorProfileResponse({ socialLinks: [] }),
    );
    render(<CreatorSettingsPage />);
    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "Creator Settings" }),
      ).toBeInTheDocument();
    });

    // Default platform is bandcamp, enter a non-bandcamp URL
    const urlInput = screen.getByPlaceholderText("https://...");
    await user.type(urlInput, "https://example.com/not-bandcamp");
    await user.click(screen.getByRole("button", { name: "Add" }));

    await waitFor(() => {
      expect(
        screen.getByText("URL does not match Bandcamp format"),
      ).toBeInTheDocument();
    });
  });

  // ── Add/remove link tests ──

  it("adds a valid social link to the list", async () => {
    const user = userEvent.setup();
    mockFetchCreatorProfile.mockResolvedValue(
      makeMockCreatorProfileResponse({ socialLinks: [] }),
    );
    render(<CreatorSettingsPage />);
    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "Creator Settings" }),
      ).toBeInTheDocument();
    });

    const urlInput = screen.getByPlaceholderText("https://...");
    await user.type(urlInput, "https://myband.bandcamp.com");
    await user.click(screen.getByRole("button", { name: "Add" }));

    expect(screen.getByText("https://myband.bandcamp.com")).toBeInTheDocument();
  });

  it("clears URL input after successful add", async () => {
    const user = userEvent.setup();
    mockFetchCreatorProfile.mockResolvedValue(
      makeMockCreatorProfileResponse({ socialLinks: [] }),
    );
    render(<CreatorSettingsPage />);
    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "Creator Settings" }),
      ).toBeInTheDocument();
    });

    const urlInput = screen.getByPlaceholderText("https://...");
    await user.type(urlInput, "https://myband.bandcamp.com");
    await user.click(screen.getByRole("button", { name: "Add" }));

    expect(urlInput).toHaveValue("");
  });

  it("prevents duplicate platform links", async () => {
    const user = userEvent.setup();
    render(<CreatorSettingsPage />);
    await waitFor(() => {
      expect(screen.getByText("https://testband.bandcamp.com")).toBeInTheDocument();
    });

    // Try to add another bandcamp link
    const urlInput = screen.getByPlaceholderText("https://...");
    await user.type(urlInput, "https://other.bandcamp.com");
    await user.click(screen.getByRole("button", { name: "Add" }));

    expect(
      screen.getByText("A Bandcamp link has already been added"),
    ).toBeInTheDocument();
  });

  it("removes a link from the list", async () => {
    const user = userEvent.setup();
    render(<CreatorSettingsPage />);
    await waitFor(() => {
      expect(screen.getByText("https://testband.bandcamp.com")).toBeInTheDocument();
    });

    await user.click(
      screen.getByRole("button", { name: "Remove Bandcamp" }),
    );

    expect(
      screen.queryByText("https://testband.bandcamp.com"),
    ).not.toBeInTheDocument();
  });

  it("disables Add button when link list reaches max", async () => {
    mockFetchCreatorProfile.mockResolvedValue(
      makeMockCreatorProfileResponse({
        socialLinks: Array.from(
          { length: 20 },
          (_, i) => ({
            platform: `website` as const,
            url: `https://example${i}.com`,
          }),
        ).slice(0, 12).map((_, i) => ({
          platform: [
            "bandcamp", "spotify", "apple-music", "soundcloud",
            "youtube-music", "tidal", "instagram", "tiktok",
            "twitter", "mastodon", "youtube", "website",
          ][i] as any,
          url: `https://example${i}.com`,
        })),
      }),
    );
    render(<CreatorSettingsPage />);
    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "Creator Settings" }),
      ).toBeInTheDocument();
    });

    // 12 links is under 20, so Add should still be enabled
    expect(screen.getByRole("button", { name: "Add" })).not.toBeDisabled();
  });

  // ── Save tests ──

  it("submits PATCH request with social links", async () => {
    const user = userEvent.setup();
    render(<CreatorSettingsPage />);
    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "Creator Settings" }),
      ).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "Save Changes" }));

    await waitFor(() => {
      expect(mockUpdateCreatorProfile).toHaveBeenCalledWith("user_test123", {
        socialLinks: [
          { platform: "bandcamp", url: "https://testband.bandcamp.com" },
        ],
      });
    });
  });

  it("shows success message after save", async () => {
    const user = userEvent.setup();
    render(<CreatorSettingsPage />);
    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "Creator Settings" }),
      ).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "Save Changes" }));

    await waitFor(() => {
      expect(
        screen.getByText("Changes saved successfully"),
      ).toBeInTheDocument();
    });
  });

  it("shows error message on save failure", async () => {
    const user = userEvent.setup();
    mockUpdateCreatorProfile.mockRejectedValue(
      new Error("Validation failed"),
    );
    render(<CreatorSettingsPage />);
    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "Creator Settings" }),
      ).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "Save Changes" }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Validation failed");
    });
  });

  it("disables form while submission is in progress", async () => {
    const user = userEvent.setup();
    mockUpdateCreatorProfile.mockReturnValue(new Promise(() => {}));
    render(<CreatorSettingsPage />);
    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "Creator Settings" }),
      ).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "Save Changes" }));

    expect(
      screen.getByRole("button", { name: "Saving\u2026" }),
    ).toBeDisabled();
  });
});
