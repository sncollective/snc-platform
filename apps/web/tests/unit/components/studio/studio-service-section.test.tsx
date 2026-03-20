import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

import { StudioServiceSection } from "../../../../src/components/studio/studio-service-section.js";

describe("StudioServiceSection", () => {
  it("renders the recording section with correct label", () => {
    render(<StudioServiceSection service="recording" />);

    expect(
      screen.getByRole("heading", { level: 2, name: "Recording" }),
    ).toBeInTheDocument();
  });

  it("renders the podcast section with correct label", () => {
    render(<StudioServiceSection service="podcast" />);

    expect(
      screen.getByRole("heading", { level: 2, name: "Podcast Production" }),
    ).toBeInTheDocument();
  });

  it("renders the practice-space section with correct label", () => {
    render(<StudioServiceSection service="practice-space" />);

    expect(
      screen.getByRole("heading", { level: 2, name: "Practice Space" }),
    ).toBeInTheDocument();
  });

  it("renders the venue-hire section with correct label", () => {
    render(<StudioServiceSection service="venue-hire" />);

    expect(
      screen.getByRole("heading", { level: 2, name: "Venue Hire" }),
    ).toBeInTheDocument();
  });

  it("renders description text for the recording section", () => {
    render(<StudioServiceSection service="recording" />);

    expect(
      screen.getByText(/acoustically treated live room/i),
    ).toBeInTheDocument();
  });

  it("renders feature list items for the recording section", () => {
    render(<StudioServiceSection service="recording" />);

    expect(screen.getByText("Multi-track recording")).toBeInTheDocument();
    expect(screen.getByText("Basic mixing included")).toBeInTheDocument();
  });

  it("renders rate range for the recording section", () => {
    render(<StudioServiceSection service="recording" />);

    expect(screen.getByText("From $30/hr")).toBeInTheDocument();
  });

  it("renders rate range for the venue-hire section", () => {
    render(<StudioServiceSection service="venue-hire" />);

    expect(screen.getByText("From $150/half-day")).toBeInTheDocument();
  });

  it("section has the correct id anchor", () => {
    const { container } = render(<StudioServiceSection service="recording" />);

    const section = container.querySelector("section");
    expect(section?.id).toBe("service-recording");
  });
});
