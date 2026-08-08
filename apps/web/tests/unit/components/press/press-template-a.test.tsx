import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PressTemplateA } from "../../../../src/components/press/press-template-a.js";
import { makePressTemplateProps } from "../../../helpers/press-fixtures.js";

describe("PressTemplateA", () => {
  it("renders the locked editorial order, member bios, and first two highlights", () => {
    render(<PressTemplateA {...makePressTemplateProps()} />);

    expect(screen.getByRole("heading", { level: 1, name: "Animal Future" })).toBeInTheDocument();
    const sectionNames = screen.getAllByRole("heading", { level: 2 }).map((heading) => heading.textContent);
    expect(sectionNames).toEqual(["About", "Members", "Highlights", "Live dates", "Listen", "Press photos"]);
    expect(screen.getByText("LeAnna biography")).toBeInTheDocument();
    expect(screen.getByText("Charles biography")).toBeInTheDocument();
    expect(screen.getByText("The Illusionist")).toBeInTheDocument();
    expect(screen.getByText("Get to You")).toBeInTheDocument();
    expect(screen.queryByText("Survived By")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "press@s-nc.org" })).toHaveAttribute("href", "mailto:press@s-nc.org");
    expect(screen.getAllByRole("link", { name: "Download one-pager (PDF) ↓" })[0]).toHaveAttribute(
      "href",
      "/api/creators/creator-1/press/one-pager.pdf",
    );
  });

  it("keeps a text-only hero and collapses every absent image wrapper", () => {
    const props = makePressTemplateProps({
      banner: null,
      aboutPhoto: null,
      members: [{ name: "LeAnna Warren", role: "Vocals", bio: "LeAnna biography", photo: null }],
      highlights: [{ eyebrow: "New", title: "The Illusionist", coverArt: null }],
      gallery: [],
    });
    const { container } = render(<PressTemplateA {...props} />);

    expect(screen.getByRole("heading", { level: 1, name: "Animal Future" })).toBeInTheDocument();
    expect(screen.getByText("LeAnna biography")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Press photos" })).not.toBeInTheDocument();
    expect(container.querySelectorAll("img")).toHaveLength(0);
    expect(container.querySelector('img[src=""]')).not.toBeInTheDocument();
  });
});
