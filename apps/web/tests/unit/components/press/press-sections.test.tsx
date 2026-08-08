import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  AboutSection,
  HighlightsSection,
  LiveDatesSection,
  MembersSection,
  PressFooter,
} from "../../../../src/components/press/press-sections.js";
import { StreamingServices } from "../../../../src/components/press/streaming-services.js";
import {
  makeDeliveredPressContent,
  makeDeliveredPressImage,
} from "../../../helpers/press-fixtures.js";

describe("press shared sections", () => {
  it("renders semantic biography paragraphs, credits, member options, and highlight limits", () => {
    const content = makeDeliveredPressContent();
    const { rerender } = render(<AboutSection content={content} />);

    expect(screen.getByRole("heading", { name: "About" })).toBeInTheDocument();
    expect(screen.getByText("First biography paragraph.")).toBeInTheDocument();
    expect(screen.getByText("Second biography paragraph.")).toBeInTheDocument();
    expect(screen.getByText("about credit")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "about alt" })).toHaveAttribute("srcset");

    rerender(<MembersSection members={content.members} showBio />);
    expect(screen.getByText("LeAnna biography")).toBeInTheDocument();

    rerender(<MembersSection members={content.members} showBio={false} />);
    expect(screen.queryByText("LeAnna biography")).not.toBeInTheDocument();

    rerender(<HighlightsSection highlights={content.highlights} limit={2} />);
    expect(screen.getByText("The Illusionist")).toBeInTheDocument();
    expect(screen.getByText("Get to You")).toBeInTheDocument();
    expect(screen.queryByText("Survived By")).not.toBeInTheDocument();
  });

  it("infers services, keeps creator labels, and secures outbound links", () => {
    const links = makeDeliveredPressContent().streamingLinks;
    render(<StreamingServices links={links} />);

    for (const label of ["Spotify", "Bandcamp", "Official site"]) {
      const link = screen.getByRole("link", { name: `Listen on ${label}` });
      expect(link).toHaveAttribute("target", "_blank");
      expect(link).toHaveAttribute("rel", "noopener noreferrer");
      expect(within(link).getByText(label)).toBeInTheDocument();
      expect(link.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
    }
  });

  it("renders live rows and exact press contact without inventing content", () => {
    render(
      <>
        <LiveDatesSection
          dates={[{ id: "1", dateTime: "2026-09-12", dateLabel: "Sep 12, 2026", venue: "The Mishawaka", city: "Bellvue, CO", ticketUrl: "https://tickets.example/1" }]}
          liveDatesUrl="https://www.bandsintown.com/a/animal-future"
        />
        <PressFooter email="press@s-nc.org" downloadUrl="/press.pdf" />
      </>,
    );

    expect(screen.getByRole("heading", { name: "Live dates" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Tickets ↗" })).toHaveAttribute("rel", "noopener noreferrer");
    expect(screen.getByRole("link", { name: "press@s-nc.org" })).toHaveAttribute("href", "mailto:press@s-nc.org");
  });

  it("omits empty sections and never renders broken image sources", () => {
    const sparse = makeDeliveredPressContent({
      shortBio: null,
      longBio: null,
      forFansOf: [],
      aboutPhoto: null,
      members: [],
      highlights: [],
      streamingLinks: [],
      liveDatesUrl: null,
    });
    const { container } = render(
      <>
        <AboutSection content={sparse} />
        <MembersSection members={sparse.members} showBio />
        <HighlightsSection highlights={sparse.highlights} limit={2} />
        <LiveDatesSection />
        <StreamingServices links={sparse.streamingLinks} />
      </>,
    );

    expect(container).toBeEmptyDOMElement();
    expect(container.querySelector('img[src=""]')).not.toBeInTheDocument();
  });

  it("preserves image alt text and overlay credit verbatim", () => {
    const image = makeDeliveredPressImage("cover", { alt: "Specific cover description", credit: "© Exact Credit" });
    render(<HighlightsSection highlights={[{ eyebrow: "New", title: "Record", coverArt: image }]} limit={2} />);
    expect(screen.getByRole("img", { name: "Specific cover description" })).toBeInTheDocument();
    expect(screen.getByText("© Exact Credit")).toBeInTheDocument();
  });
});
