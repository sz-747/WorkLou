"use client";

import { useCallback, useEffect, useState } from "react";
import { Scribble } from "./Scribble";

type Box = { left: number; top: number; width: number; height: number };

/** Breathing room so the crayon stroke never crosses or clips the label. */
const PAD_X = 10;
const PAD_Y = 6;

/**
 * The single hand-drawn loop around the active nav tab.
 *
 * It measures whichever link the router marked `aria-current="page"`, so it
 * follows the real active route on first paint, on click, and on browser
 * back/forward. Moving and resizing to the new label is a CSS transition with
 * a springy curve (see .a2s-nav-loop in a2.css); the settle wobble is an
 * animation replayed by remounting the inner ink on each move. Both are
 * switched off under prefers-reduced-motion, which snaps the loop instantly.
 */
export function NavActiveLoop({
  navRef,
  pathname,
}: {
  navRef: React.RefObject<HTMLDivElement | null>;
  pathname: string;
}) {
  const [box, setBox] = useState<Box | null>(null);
  const [move, setMove] = useState(0);

  const measure = useCallback(() => {
    const nav = navRef.current;
    const active = nav?.querySelector<HTMLElement>('a[aria-current="page"]');
    if (!nav || !active) {
      setBox(null);
      return;
    }
    const navBox = nav.getBoundingClientRect();
    const linkBox = active.getBoundingClientRect();
    setBox({
      left: linkBox.left - navBox.left - PAD_X,
      top: linkBox.top - navBox.top - PAD_Y,
      width: linkBox.width + PAD_X * 2,
      height: linkBox.height + PAD_Y * 2,
    });
  }, [navRef]);

  useEffect(() => {
    measure();
    setMove((n) => n + 1);
  }, [measure, pathname]);

  useEffect(() => {
    const nav = navRef.current;
    if (!nav || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => measure());
    observer.observe(nav);
    return () => observer.disconnect();
  }, [measure, navRef]);

  if (!box) return null;

  return (
    <span
      className="a2s-nav-loop"
      aria-hidden="true"
      style={{ left: box.left, top: box.top, width: box.width, height: box.height }}
    >
      <span className="a2s-nav-loop-ink" key={move}>
        <Scribble strokeWidth={2.2} />
      </span>
    </span>
  );
}
