import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PressTemplateB } from "../../../../src/components/press/press-template-b.js";
import { makePressTemplateProps } from "../../../helpers/press-fixtures.js";

describe("PressTemplateB", () => {
  it("renders names-only members and the first three highlights in the two-column composition", () => {
    const { container } = render(<PressTemplateB {...makePressTemplateProps()} />);

    expect(container.querySelector('[data-press-template="B"]')).toBeInTheDocument();
    expect(screen.getByText("LeAnna Warren")).toBeInTheDocument();
    expect(screen.queryByText("LeAnna biography")).not.toBeInTheDocument();
    expect(screen.queryByText("Charles biography")).not.toBeInTheDocument();
    expect(screen.getByText("The Illusionist")).toBeInTheDocument();
    expect(screen.getByText("Get to You")).toBeInTheDocument();
    expect(screen.getByText("Survived By")).toBeInTheDocument();
    expect(screen.queryByText("Fourth Highlight")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "press@s-nc.org" })).toHaveAttribute("href", "mailto:press@s-nc.org");
  });

  it("compacts naturally around fewer items without synthetic cards", () => {
    render(<PressTemplateB {...makePressTemplateProps({
      members: [{ name: "Solo Member", role: "Everything", photo: null }],
      highlights: [{ eyebrow: "Only", title: "One Highlight", coverArt: null }],
      gallery: [],
    })} />);

    expect(screen.getAllByText("Solo Member")).toHaveLength(1);
    expect(screen.getAllByText("One Highlight")).toHaveLength(1);
    expect(screen.queryByText("LeAnna Warren")).not.toBeInTheDocument();
    expect(screen.queryByText("The Illusionist")).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Press photos" })).not.toBeInTheDocument();
  });
});
