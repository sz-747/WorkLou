/** Glyphs traced from the A2 frames (Glyph / Search, Glyph / Return). */

export function SearchGlyph() {
  return (
    <svg
      className="a2s-glyph"
      width="18"
      height="18"
      viewBox="0 0 18 18"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="7.5" cy="7.5" r="5.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M11.6 11.6 16 16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function ReturnGlyph() {
  return (
    <svg width="12" height="11" viewBox="0 0 12 11" fill="none" aria-hidden="true">
      <path
        d="M11 1v3.5a2 2 0 0 1-2 2H1.5M4 3.5 1 6.5l3 3"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
