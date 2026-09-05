"use client";

import { useState } from "react";

/** Filter pill row (A2 / My clients, A2 / Shelters) — matte rest/pressed. */
export function Filters({ options }: { options: string[] }) {
  const [active, setActive] = useState(options[0]);

  return (
    <div className="a2s-filters">
      {options.map((option) => (
        <button
          key={option}
          type="button"
          className="a2s-matte a2s-filter"
          aria-pressed={active === option}
          onClick={() => setActive(option)}
        >
          {option}
        </button>
      ))}
    </div>
  );
}
