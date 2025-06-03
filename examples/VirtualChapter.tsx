// @ts-nocheck
// VirtualChapter.tsx
import React, { useState, useRef, useCallback, useEffect } from "react";

interface VirtualChapterProps {
  /** Full chapter broken into paragraphs (or any renderable string). */
  paragraphs: string[];
  /** Height of each paragraph in px (fixed height keeps the demo simple). */
  itemHeight?: number;
  /** Number of extra items rendered above & below the viewport. */
  overscan?: number;
  /** Height of the scrolling viewport. */
  height?: number | string;
}

export default function VirtualChapter({
  paragraphs,
  itemHeight = 28,
  overscan = 6,
  height = "100vh",
}: VirtualChapterProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [scrollTop, setScrollTop] = useState(0);

  const onScroll = useCallback(() => {
    if (containerRef.current) setScrollTop(containerRef.current.scrollTop);
  }, []);

  /** How many items can fit in the viewport */
  const viewportItemCount = Math.ceil(
    (typeof height === "number" ? height : window.innerHeight) / itemHeight
  );

  /** Calculate window of items to render */
  const startIndex = Math.max(
    0,
    Math.floor(scrollTop / itemHeight) - overscan
  );
  const endIndex = Math.min(
    paragraphs.length,
    startIndex + viewportItemCount + overscan * 2
  );
  const items = paragraphs.slice(startIndex, endIndex);

  /** Total pixel height of the full (virtual) list */
  const totalHeight = paragraphs.length * itemHeight;

  /** Top offset for the first rendered item */
  const offsetY = startIndex * itemHeight;

  // Keep scrollTop in sync if the viewport height changes (e.g., orientation)
  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current)
        setScrollTop(containerRef.current.scrollTop);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return (<div
      ref={containerRef}
      onScroll={onScroll}
      style={{
        height,
        overflowY: "auto",
        position: "relative",
        fontFamily: "serif",
        lineHeight: `${itemHeight}px`,
      }}
    >
      {/* “Spacer” div gives the list its full scroll height */}
      <div style={{ height: totalHeight, position: "relative" }}>
        {/* Render only the visible paragraph slice */}
        {items.map((para, idx) => (
          <p
            key={startIndex + idx}
            style={{
              position: "absolute",
              top: offsetY + idx * itemHeight,
              left: 0,
              right: 0,
              margin: 0,
              padding: "0 1rem",
            }}
          >
            {para}
          </p>
        ))}
      </div>
    </div>
  );
}
