import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

import { SocialLinksSection } from "../../../src/components/social-links/social-links-section.js";
import type { SocialLink } from "@snc/shared";

// ── Tests ──

describe("SocialLinksSection", () => {
  it("returns nothing when socialLinks is empty", () => {
    const { container } = render(<SocialLinksSection socialLinks={[]} />);
    expect(container.innerHTML).toBe("");
  });

  it("renders section heading when links exist", () => {
    const links: SocialLink[] = [
      { platform: "bandcamp", url: "https://myband.bandcamp.com" },
    ];
    render(<SocialLinksSection socialLinks={links} />);
    expect(screen.getByText("Links")).toBeInTheDocument();
  });

  it("renders one link per social link entry", () => {
    const links: SocialLink[] = [
      { platform: "bandcamp", url: "https://myband.bandcamp.com" },
      { platform: "spotify", url: "https://open.spotify.com/artist/123" },
    ];
    render(<SocialLinksSection socialLinks={links} />);

    const anchors = screen.getAllByRole("link");
    expect(anchors).toHaveLength(2);
    expect(anchors[0]).toHaveAttribute("href", "https://myband.bandcamp.com");
    expect(anchors[1]).toHaveAttribute("href", "https://open.spotify.com/artist/123");
  });

  it("opens links in new tab with noopener noreferrer", () => {
    const links: SocialLink[] = [
      { platform: "bandcamp", url: "https://myband.bandcamp.com" },
    ];
    render(<SocialLinksSection socialLinks={links} />);

    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("uses platform display name as default label", () => {
    const links: SocialLink[] = [
      { platform: "bandcamp", url: "https://myband.bandcamp.com" },
    ];
    render(<SocialLinksSection socialLinks={links} />);
    expect(screen.getByText("Bandcamp")).toBeInTheDocument();
  });

  it("uses custom label when provided", () => {
    const links: SocialLink[] = [
      { platform: "bandcamp", url: "https://myband.bandcamp.com", label: "My Band on BC" },
    ];
    render(<SocialLinksSection socialLinks={links} />);
    expect(screen.getByText("My Band on BC")).toBeInTheDocument();
    expect(screen.queryByText("Bandcamp")).toBeNull();
  });

  it("renders platform icon for each link", () => {
    const links: SocialLink[] = [
      { platform: "spotify", url: "https://open.spotify.com/artist/123" },
    ];
    render(<SocialLinksSection socialLinks={links} />);

    // The icon renders an SVG with aria-hidden on the container
    const icon = document.querySelector('[aria-hidden="true"]');
    expect(icon).toBeInTheDocument();
    expect(icon?.querySelector("svg")).toBeInTheDocument();
  });
});
