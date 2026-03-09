import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";

import { stubComponent } from "../../helpers/component-stubs.js";

// ── Hoisted Mocks ──

const { mockSubscribeCta } = vi.hoisted(() => ({
  mockSubscribeCta: vi.fn(),
}));

vi.mock("../../../src/components/content/subscribe-cta.js", () =>
  stubComponent("SubscribeCta", "subscribe-cta", mockSubscribeCta),
);

// ── Component Under Test ──

import { ContentFooter } from "../../../src/components/content/content-footer.js";

// ── Lifecycle ──

afterEach(() => {
  vi.restoreAllMocks();
});

// ── Tests ──

describe("ContentFooter", () => {
  it("renders description with divider when description is provided", () => {
    const { container } = render(
      <ContentFooter description="A great piece of content" />,
    );
    expect(screen.getByText("A great piece of content")).toBeInTheDocument();
    expect(container.querySelector("hr")).not.toBeNull();
  });

  it("returns null when description is null and not locked", () => {
    const { container } = render(<ContentFooter description={null} />);
    expect(container.innerHTML).toBe("");
  });

  it("does not render SubscribeCta when not locked", () => {
    render(<ContentFooter description="Some text" />);
    expect(screen.queryByTestId("subscribe-cta")).toBeNull();
  });

  it("renders SubscribeCta when locked with creatorId and contentType", () => {
    render(
      <ContentFooter
        description={null}
        creatorId="creator-1"
        contentType="video"
        locked
      />,
    );
    expect(screen.getByTestId("subscribe-cta")).toBeInTheDocument();
    expect(mockSubscribeCta).toHaveBeenCalledWith(
      expect.objectContaining({ creatorId: "creator-1", contentType: "video" }),
    );
  });

  it("renders both SubscribeCta and description when locked with description", () => {
    render(
      <ContentFooter
        description="Locked content description"
        creatorId="creator-2"
        contentType="audio"
        locked
      />,
    );
    expect(screen.getByTestId("subscribe-cta")).toBeInTheDocument();
    expect(screen.getByText("Locked content description")).toBeInTheDocument();
  });

  it("does not render SubscribeCta when locked but missing creatorId", () => {
    render(
      <ContentFooter
        description="Some text"
        contentType="video"
        locked
      />,
    );
    expect(screen.queryByTestId("subscribe-cta")).toBeNull();
    expect(screen.getByText("Some text")).toBeInTheDocument();
  });

  it("does not render SubscribeCta when locked but missing contentType", () => {
    render(
      <ContentFooter
        description="Some text"
        creatorId="creator-3"
        locked
      />,
    );
    expect(screen.queryByTestId("subscribe-cta")).toBeNull();
    expect(screen.getByText("Some text")).toBeInTheDocument();
  });
});
