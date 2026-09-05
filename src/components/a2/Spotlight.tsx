"use client";

import { useEffect, useState } from "react";
import { SPOTLIGHT } from "../../lib/a2-mock";
import { SearchGlyph } from "./glyphs";

/** A2 / Spotlight (175:94) — grouped results over a matte overlay. */
export function Spotlight({ onClose }: { onClose: () => void }) {
  const [query, setQuery] = useState(SPOTLIGHT.query);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  /* The frame shows a semantic result set for "beds" — shelters, the client it
     concerns, the action it implies and matching pages — so the grouped results
     are shown as designed rather than substring-filtered. */
  const groups = SPOTLIGHT.groups;

  return (
    <div
      className="a2s-overlay"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="a2s-spotlight" role="dialog" aria-label="Spotlight">
        <div className="a2s-spotlight-bar">
          <SearchGlyph />
          {/* eslint-disable-next-line jsx-a11y/no-autofocus */}
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Spotlight search"
          />
        </div>

        {groups.map((group) => (
          <div className="a2s-spotlight-group" key={group.label}>
            <p className="a2s-spotlight-label">{group.label}</p>
            {group.items.map((item) => (
              <button type="button" className="a2s-spotlight-item" key={item.title}>
                <b>{item.title}</b>
                <span>{item.detail}</span>
              </button>
            ))}
          </div>
        ))}

        <p className="a2s-spotlight-foot">{SPOTLIGHT.footer}</p>
      </div>
    </div>
  );
}
