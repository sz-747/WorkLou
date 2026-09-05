"use client";

import { useState } from "react";
import { Sheet } from "./Sheet";
import { PLAN } from "../../lib/a2-mock";

/** "Add anything · not from a suggestion" block on A2 / Plan · Maya. */
export function PlanAdd() {
  const [value, setValue] = useState("");
  const [added, setAdded] = useState<string[]>([]);

  return (
    <Sheet note={PLAN.add.note}>
      <p className="a2s-spotlight-label">{PLAN.add.label}</p>
      <textarea
        className="a2s-field"
        rows={2}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={PLAN.add.placeholder}
        aria-label={PLAN.add.label}
      />
      <div className="a2s-btn-row" style={{ marginTop: 12 }}>
        <button
          type="button"
          className="a2s-btn-primary"
          onClick={() => {
            if (!value.trim()) return;
            setAdded([...added, value.trim()]);
            setValue("");
          }}
        >
          {PLAN.add.button}
        </button>
      </div>

      {added.length > 0 && (
        <ul className="a2s-rows" style={{ marginTop: 12 }} data-testid="plan-added">
          {added.map((item) => (
            <li key={item}>
              <span className="a2s-row-left">
                <span className="a2s-ring" aria-hidden="true" />
                <span className="a2s-row-title" style={{ fontSize: 15 }}>
                  {item}
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </Sheet>
  );
}
