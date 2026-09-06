/**
 * Hand-drawn orange scribble loop — the felt-tip circle used around the Lou's
 * logo and around the active nav tab.
 *
 * The loop is drawn in a 100 x 100 viewBox and stretched to whatever box it is
 * given; `vector-effect: non-scaling-stroke` keeps the crayon weight constant
 * so a wide two-word label ("My clients") gets a wide loop, not a fat one. The
 * path deliberately never closes: it starts on the right, runs anticlockwise
 * and comes back up the right side past its own start, so there is a gap with
 * one end overshooting. A second, lighter pass over the top adds the uneven
 * pressure of a real pen.
 */

/** Main open loop: gap on the right, the tail overshooting past the start. */
const LOOP =
  "M88 33C79 12 45 3 24 15C4 27 3 65 21 83C39 100 76 96 90 75C94 68 96 60 95 52L98 63";

/** Second, lighter pass: the doubled-back stroke over the top-left shoulder. */
const LOOP_PASS = "M80 15C61 5 33 8 17 26";

export function Scribble({
  strokeWidth = 2.4,
  className,
}: {
  strokeWidth?: number;
  className?: string;
}) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      fill="none"
      stroke="var(--accent)"
      strokeLinecap="round"
      strokeLinejoin="round"
      vectorEffect="non-scaling-stroke"
    >
      <path
        d={LOOP}
        strokeWidth={strokeWidth}
        vectorEffect="non-scaling-stroke"
        opacity="0.92"
      />
      <path
        d={LOOP_PASS}
        strokeWidth={strokeWidth * 0.62}
        vectorEffect="non-scaling-stroke"
        opacity="0.5"
      />
    </svg>
  );
}
