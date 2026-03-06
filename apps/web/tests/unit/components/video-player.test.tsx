import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";

import { VideoPlayer } from "../../../src/components/media/video-player.js";

describe("VideoPlayer", () => {
  it("renders a video element with controls", () => {
    render(<VideoPlayer src="test.mp4" />);
    const video = document.querySelector("video")!;
    expect(video).toBeTruthy();
    expect(video.controls).toBe(true);
  });

  it("sets preload to metadata", () => {
    render(<VideoPlayer src="test.mp4" />);
    const video = document.querySelector("video")!;
    expect(video.preload).toBe("metadata");
  });

  it("does not autoplay", () => {
    render(<VideoPlayer src="test.mp4" />);
    const video = document.querySelector("video")!;
    expect(video.autoplay).toBe(false);
  });

  it("sets controlsList to nodownload", () => {
    render(<VideoPlayer src="test.mp4" />);
    const video = document.querySelector("video")!;
    expect(video.getAttribute("controlslist")).toBe("nodownload");
  });

  it("renders source with the provided src", () => {
    render(<VideoPlayer src="/api/content/vid-1/media" />);
    const source = document.querySelector("source")!;
    expect(source.src).toContain("/api/content/vid-1/media");
  });

  it("sets poster when provided", () => {
    render(<VideoPlayer src="test.mp4" poster="/poster.jpg" />);
    const video = document.querySelector("video")!;
    expect(video.poster).toContain("poster.jpg");
  });

  it("does not set poster when not provided", () => {
    render(<VideoPlayer src="test.mp4" />);
    const video = document.querySelector("video")!;
    expect(video.poster).toBe("");
  });
});
