import {
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactElement,
} from "react";

import { PressImageFigure } from "./press-image.js";
import type { DeliveredPressImage } from "./press-types.js";
import styles from "./press-carousel.module.css";

export interface PressCarouselProps {
  readonly creatorName: string;
  readonly images: readonly DeliveredPressImage[];
}

/** Render an accessible, measured press-photo carousel. */
export function PressCarousel({ creatorName, images }: PressCarouselProps): ReactElement | null {
  const viewportRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const indexRef = useRef(0);
  const [index, setIndex] = useState(0);
  const [canGoBack, setCanGoBack] = useState(false);
  const [canGoForward, setCanGoForward] = useState(false);

  const renderPosition = useCallback(() => {
    const viewport = viewportRef.current;
    const track = trackRef.current;
    const firstSlide = track?.firstElementChild;
    if (!viewport || !track || !(firstSlide instanceof HTMLElement)) return;

    const gap = Number.parseFloat(getComputedStyle(track).gap) || 0;
    const stride = firstSlide.getBoundingClientRect().width + gap;
    const maxOffset = Math.max(0, track.scrollWidth - viewport.clientWidth);
    const maxIndex = stride > 0 ? Math.ceil(maxOffset / stride) : 0;
    const nextIndex = Math.max(0, Math.min(indexRef.current, maxIndex));
    indexRef.current = nextIndex;
    setIndex(nextIndex);
    track.style.transform = `translate3d(${-Math.min(nextIndex * stride, maxOffset)}px, 0, 0)`;
    setCanGoBack(nextIndex > 0);
    setCanGoForward(nextIndex < maxIndex);
  }, []);

  useLayoutEffect(() => {
    indexRef.current = index;
    renderPosition();
  }, [index, renderPosition]);

  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    const track = trackRef.current;
    if (!viewport || !track) return;

    if (typeof ResizeObserver !== "undefined") {
      const observer = new ResizeObserver(renderPosition);
      observer.observe(viewport);
      observer.observe(track);
      return () => observer.disconnect();
    }

    window.addEventListener("resize", renderPosition);
    return () => window.removeEventListener("resize", renderPosition);
  }, [renderPosition]);

  const move = (delta: number): void => {
    indexRef.current += delta;
    setIndex(indexRef.current);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      move(-1);
    }
    if (event.key === "ArrowRight") {
      event.preventDefault();
      move(1);
    }
  };

  if (images.length === 0) return null;

  return (
    <section className={styles.section} aria-labelledby="press-gallery-heading">
      <h2 className={styles.kicker} id="press-gallery-heading">Press photos</h2>
      <div className={styles.shell}>
        <div
          ref={viewportRef}
          className={styles.viewport}
          tabIndex={0}
          aria-label={`${creatorName} press photo carousel`}
          onKeyDown={handleKeyDown}
        >
          <div ref={trackRef} className={styles.track}>
            {images.map((image, imageIndex) => (
              <div className={styles.slide} key={`${image.key}-${imageIndex}`}>
                <PressImageFigure image={image} slot="gallery" creditMode="overlay" />
              </div>
            ))}
          </div>
        </div>
        <button
          className={`${styles.arrow} ${styles.previous}`}
          type="button"
          aria-label="Previous press photo"
          disabled={!canGoBack}
          onClick={() => move(-1)}
        >
          ←
        </button>
        <button
          className={`${styles.arrow} ${styles.next}`}
          type="button"
          aria-label="Next press photo"
          disabled={!canGoForward}
          onClick={() => move(1)}
        >
          →
        </button>
      </div>
      <p className={styles.note}>High-resolution selects available from the press contact.</p>
    </section>
  );
}
