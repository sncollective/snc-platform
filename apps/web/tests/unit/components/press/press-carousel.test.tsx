import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PressCarousel } from "../../../../src/components/press/press-carousel.js";
import { makeDeliveredPressImage } from "../../../helpers/press-fixtures.js";

const callbacks: ResizeObserverCallback[] = [];
const disconnect = vi.fn();

class ResizeObserverMock {
  constructor(callback: ResizeObserverCallback) { callbacks.push(callback); }
  observe = vi.fn();
  disconnect = disconnect;
}

const images = ["one", "two", "three", "four"].map((key) => makeDeliveredPressImage(key));

const setGeometry = (
  viewport: HTMLElement,
  track: HTMLElement,
  slide: HTMLElement,
  { viewportWidth, trackWidth, slideWidth }: { viewportWidth: number; trackWidth: number; slideWidth: number },
): void => {
  Object.defineProperty(viewport, "clientWidth", { configurable: true, value: viewportWidth });
  Object.defineProperty(track, "scrollWidth", { configurable: true, value: trackWidth });
  vi.spyOn(slide, "getBoundingClientRect").mockReturnValue({
    width: slideWidth,
    height: 75,
    x: 0,
    y: 0,
    top: 0,
    right: slideWidth,
    bottom: 75,
    left: 0,
    toJSON: () => ({}),
  });
};

beforeEach(() => {
  callbacks.length = 0;
  disconnect.mockClear();
  vi.stubGlobal("ResizeObserver", ResizeObserverMock);
  const actualGetComputedStyle = window.getComputedStyle.bind(window);
  vi.spyOn(window, "getComputedStyle").mockImplementation((element) => {
    const style = actualGetComputedStyle(element);
    Object.defineProperty(style, "gap", { configurable: true, value: "10px" });
    return style;
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("PressCarousel", () => {
  it("moves by measured strides, clamps the final offset, and supports arrow keys", () => {
    render(<PressCarousel creatorName="Animal Future" images={images} />);
    const viewport = screen.getByLabelText("Animal Future press photo carousel");
    const track = viewport.firstElementChild as HTMLElement;
    const slide = track.firstElementChild as HTMLElement;
    setGeometry(viewport, track, slide, { viewportWidth: 250, trackWidth: 500, slideWidth: 100 });
    act(() => callbacks[0]!([], {} as ResizeObserver));

    const previous = screen.getByRole("button", { name: "Previous press photo" });
    const next = screen.getByRole("button", { name: "Next press photo" });
    expect(previous).toBeDisabled();
    expect(next).toBeEnabled();

    fireEvent.click(next);
    expect(track.style.transform).toBe("translate3d(-110px, 0, 0)");
    fireEvent.keyDown(viewport, { key: "ArrowRight" });
    expect(track.style.transform).toBe("translate3d(-220px, 0, 0)");
    fireEvent.click(next);
    expect(track.style.transform).toBe("translate3d(-250px, 0, 0)");
    expect(next).toBeDisabled();

    fireEvent.keyDown(viewport, { key: "ArrowLeft" });
    expect(track.style.transform).toBe("translate3d(-220px, 0, 0)");
    expect(previous).toBeEnabled();
  });

  it("reconciles to a resized end and disconnects its observer", () => {
    const { unmount } = render(<PressCarousel creatorName="Animal Future" images={images} />);
    const viewport = screen.getByLabelText("Animal Future press photo carousel");
    const track = viewport.firstElementChild as HTMLElement;
    const slide = track.firstElementChild as HTMLElement;
    setGeometry(viewport, track, slide, { viewportWidth: 250, trackWidth: 500, slideWidth: 100 });
    act(() => callbacks[0]!([], {} as ResizeObserver));

    fireEvent.click(screen.getByRole("button", { name: "Next press photo" }));
    fireEvent.click(screen.getByRole("button", { name: "Next press photo" }));
    fireEvent.click(screen.getByRole("button", { name: "Next press photo" }));

    Object.defineProperty(track, "scrollWidth", { configurable: true, value: 300 });
    act(() => callbacks[0]!([], {} as ResizeObserver));
    expect(track.style.transform).toBe("translate3d(-50px, 0, 0)");
    expect(screen.getByRole("button", { name: "Next press photo" })).toBeDisabled();

    unmount();
    expect(disconnect).toHaveBeenCalledOnce();
  });

  it("disables both controls when all slides fit and omits an empty gallery", () => {
    const { rerender } = render(<PressCarousel creatorName="Animal Future" images={images.slice(0, 1)} />);
    const viewport = screen.getByLabelText("Animal Future press photo carousel");
    const track = viewport.firstElementChild as HTMLElement;
    const slide = track.firstElementChild as HTMLElement;
    setGeometry(viewport, track, slide, { viewportWidth: 500, trackWidth: 100, slideWidth: 100 });
    act(() => callbacks[0]!([], {} as ResizeObserver));

    expect(screen.getByRole("button", { name: "Previous press photo" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Next press photo" })).toBeDisabled();

    rerender(<PressCarousel creatorName="Animal Future" images={[]} />);
    expect(screen.queryByRole("heading", { name: "Press photos" })).not.toBeInTheDocument();
  });

  it("measures and enables controls when an empty gallery becomes populated", () => {
    const { rerender } = render(<PressCarousel creatorName="Animal Future" images={[]} />);
    rerender(<PressCarousel creatorName="Animal Future" images={images} />);

    const viewport = screen.getByLabelText("Animal Future press photo carousel");
    const track = viewport.firstElementChild as HTMLElement;
    const slide = track.firstElementChild as HTMLElement;
    setGeometry(viewport, track, slide, { viewportWidth: 250, trackWidth: 500, slideWidth: 100 });
    act(() => callbacks.at(-1)?.([], {} as ResizeObserver));

    expect(screen.getByRole("button", { name: "Previous press photo" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Next press photo" })).toBeEnabled();
  });

  it("resets and rebinds across populated, empty, and populated galleries", () => {
    const { rerender } = render(<PressCarousel creatorName="Animal Future" images={images} />);
    const viewport = screen.getByLabelText("Animal Future press photo carousel");
    let track = viewport.firstElementChild as HTMLElement;
    let slide = track.firstElementChild as HTMLElement;
    setGeometry(viewport, track, slide, { viewportWidth: 250, trackWidth: 500, slideWidth: 100 });
    act(() => callbacks[0]!([], {} as ResizeObserver));
    fireEvent.click(screen.getByRole("button", { name: "Next press photo" }));
    expect(track.style.transform).toBe("translate3d(-110px, 0, 0)");

    const observerCount = callbacks.length;
    rerender(<PressCarousel creatorName="Animal Future" images={[]} />);
    expect(screen.queryByRole("heading", { name: "Press photos" })).not.toBeInTheDocument();
    expect(disconnect).toHaveBeenCalled();

    rerender(<PressCarousel creatorName="Animal Future" images={images.slice(0, 2)} />);
    const newObserverCallback = callbacks.at(-1);
    expect(callbacks.length).toBeGreaterThan(observerCount);
    const populatedViewport = screen.getByLabelText("Animal Future press photo carousel");
    track = populatedViewport.firstElementChild as HTMLElement;
    slide = track.firstElementChild as HTMLElement;
    setGeometry(populatedViewport, track, slide, { viewportWidth: 250, trackWidth: 500, slideWidth: 100 });
    act(() => newObserverCallback?.([], {} as ResizeObserver));

    expect(track.style.transform).toBe("translate3d(0px, 0, 0)");
    expect(screen.getByRole("button", { name: "Previous press photo" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Next press photo" })).toBeEnabled();
  });

  it("resets the position and observer when the creator changes", () => {
    const { rerender } = render(<PressCarousel creatorName="Animal Future" images={images} />);
    const viewport = screen.getByLabelText("Animal Future press photo carousel");
    let track = viewport.firstElementChild as HTMLElement;
    let slide = track.firstElementChild as HTMLElement;
    setGeometry(viewport, track, slide, { viewportWidth: 250, trackWidth: 500, slideWidth: 100 });
    act(() => callbacks[0]!([], {} as ResizeObserver));
    fireEvent.click(screen.getByRole("button", { name: "Next press photo" }));
    expect(track.style.transform).toBe("translate3d(-110px, 0, 0)");

    rerender(<PressCarousel creatorName="New Creator" images={images} />);
    const newObserverCallback = callbacks.at(-1);
    const newViewport = screen.getByLabelText("New Creator press photo carousel");
    track = newViewport.firstElementChild as HTMLElement;
    slide = track.firstElementChild as HTMLElement;
    setGeometry(newViewport, track, slide, { viewportWidth: 250, trackWidth: 500, slideWidth: 100 });
    act(() => newObserverCallback?.([], {} as ResizeObserver));

    expect(track.style.transform).toBe("translate3d(0px, 0, 0)");
    expect(screen.getByRole("button", { name: "Previous press photo" })).toBeDisabled();
  });
});
