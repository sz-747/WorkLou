"use client";

import Link from "next/link";
import { useState } from "react";
import { Scribble } from "./Scribble";

/** Drop the screenshot here (public/lou-logo.png) and it replaces the mark. */
const LOGO_SRC = "/lou-logo.png";

/**
 * Standalone Lou's logo, sitting on its own to the left of the nav bar rather
 * than inside it. It renders the supplied image; until that file exists (or if
 * it fails to load) it falls back to the hand-drawn "Lou's" scribble mark so
 * the header never shows a broken image.
 */
export function Logo() {
  const [imageOk, setImageOk] = useState(true);

  return (
    <Link href="/today" className="a2s-brand" aria-label="Lou's Place — home">
      {imageOk ? (
        // eslint-disable-next-line @next/next/no-img-element -- unknown intrinsic size until the screenshot lands
        <img
          src={LOGO_SRC}
          alt="Lou's Place"
          className="a2s-brand-img"
          onError={() => setImageOk(false)}
        />
      ) : (
        <span className="a2s-logo">
          <Scribble className="a2s-logo-scribble" strokeWidth={2.6} />
          <span className="a2s-logo-text">Lou&apos;s</span>
        </span>
      )}
    </Link>
  );
}
