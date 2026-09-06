"use client";

import { useEffect, useState } from "react";
import { MAYA, QUICK_EXIT } from "../../lib/a2-mock";

/** A2 / Profile · quick exit (153:45) — the escape plan, one click away. */
export function QuickExit() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button
        type="button"
        className="a2s-btn-primary"
        onClick={() => setOpen(true)}
        data-testid="quick-exit-open"
      >
        {MAYA.quickExitButton}
      </button>

      {open && (
        <div
          className="a2s-overlay"
          role="presentation"
          onClick={(e) => e.target === e.currentTarget && setOpen(false)}
        >
          <div className="a2s-modal" role="dialog" aria-label={QUICK_EXIT.title}>
            <h2>{QUICK_EXIT.title}</h2>
            <p className="a2s-sub" style={{ fontSize: 14 }}>
              {QUICK_EXIT.subline}
            </p>

            <ul className="a2s-timeline" style={{ marginTop: 12 }}>
              {QUICK_EXIT.items.map((item) => (
                <li key={item.name}>
                  <span className="a2s-when" style={{ fontSize: 16 }}>
                    {item.name}
                  </span>
                  <span className="a2s-what">{item.detail}</span>
                </li>
              ))}
            </ul>

            <div className="a2s-btn-row" style={{ marginTop: 20 }}>
              {QUICK_EXIT.actions.map((action) => (
                <button type="button" className="a2s-matte a2s-btn" key={action}>
                  {action}
                </button>
              ))}
              <button
                type="button"
                className="a2s-matte a2s-btn a2s-btn-sm"
                onClick={() => setOpen(false)}
              >
                {QUICK_EXIT.close}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
