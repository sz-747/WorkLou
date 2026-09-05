"use client";

import { useState } from "react";
import { Sheet } from "./Sheet";
import { DONE } from "../../lib/a2-mock";

/**
 * A2 / Done (137:400) plus the choosing state (171:2): clicking a shelter that
 * is not the current best fit offers "Make <name> the best fit" / "Cancel",
 * and the locked option shows "Locked in".
 */
export function DoneView() {
  const [best, setBest] = useState(DONE.options[0].name);
  const [candidate, setCandidate] = useState<string | null>(null);
  const choosing = candidate !== null;

  return (
    <>
      <header className="a2s-head">
        <h1 style={{ fontSize: 22, lineHeight: 1.35, maxWidth: 820 }}>{DONE.ask}</h1>
        <p className="a2s-sub" style={{ fontSize: 15 }}>
          {DONE.status}
        </p>
      </header>

      <div className="a2s-cols-3" style={{ marginBottom: 16 }}>
        {DONE.options.map((option) => {
          const isBest = option.name === best;
          const isCandidate = option.name === candidate;
          return (
            <button
              key={option.name}
              type="button"
              className="a2s-sheet"
              style={{ display: "block", textAlign: "left", cursor: "pointer" }}
              onClick={() => !isBest && setCandidate(option.name)}
              data-testid={`done-option-${option.name.split(" ")[0].toLowerCase()}`}
            >
              {isBest && (
                <span className="a2s-tag is-accent">
                  {choosing ? DONE.choosing.badge : DONE.options[0].badge}
                </span>
              )}
              <p className="a2s-minutes" style={{ margin: "10px 0 0" }}>
                {option.minutes}
              </p>
              <p className="a2s-walk" style={{ margin: "0 0 10px" }}>
                {option.walk}
              </p>
              <p style={{ fontSize: 18, fontWeight: 500, margin: 0 }}>{option.name}</p>
              <p className="a2s-fact" style={{ margin: "2px 0 8px" }}>
                {option.area}
              </p>
              {option.facts.map((fact) => (
                <p className="a2s-fact" key={fact} style={{ margin: "2px 0" }}>
                  {fact}
                </p>
              ))}
              <p className="a2s-link" style={{ display: "inline-block", marginTop: 12 }}>
                {option.link}
              </p>

              {isBest && (
                <p className="a2s-btn-row" style={{ marginTop: 12 }}>
                  <span className="a2s-btn-primary">
                    {choosing ? DONE.choosing.lockedLabel : DONE.options[0].primary}
                  </span>
                </p>
              )}

              {isCandidate && (
                <span className="a2s-btn-row" style={{ marginTop: 12 }}>
                  <span
                    role="button"
                    tabIndex={0}
                    className="a2s-btn-primary"
                    data-testid="confirm-best-fit"
                    onClick={(e) => {
                      e.stopPropagation();
                      setBest(option.name);
                      setCandidate(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        setBest(option.name);
                        setCandidate(null);
                      }
                    }}
                  >
                    {`Make ${option.name} the best fit`}
                  </span>
                  <span
                    role="button"
                    tabIndex={0}
                    className="a2s-matte a2s-btn a2s-btn-sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      setCandidate(null);
                    }}
                    onKeyDown={(e) => e.key === "Enter" && setCandidate(null)}
                  >
                    {DONE.choosing.cancel}
                  </span>
                </span>
              )}
            </button>
          );
        })}
      </div>

      <p className="a2s-sheet-note" style={{ margin: "0 0 20px" }}>
        {DONE.chooseNote}
      </p>

      <div className="a2s-grid">
        <div>
          <div className="a2s-cols-2">
            <Sheet title={DONE.did.title}>
              <ul className="a2s-timeline">
                {DONE.did.items.map((item) => (
                  <li key={item}>
                    <span className="a2s-what">{item}</span>
                  </li>
                ))}
              </ul>
            </Sheet>
            <Sheet title={DONE.didnt.title}>
              <ul className="a2s-timeline">
                {DONE.didnt.items.map((item) => (
                  <li key={item}>
                    <span className="a2s-what">{item}</span>
                  </li>
                ))}
              </ul>
            </Sheet>
          </div>

          <Sheet note={DONE.lockNote}>
            <div className="a2s-btn-row">
              {DONE.nextActions.map((action) => (
                <button type="button" className="a2s-matte a2s-btn" key={action}>
                  {action}
                </button>
              ))}
            </div>
          </Sheet>
        </div>

        <div className="a2s-rail">
          <Sheet
            title={DONE.paperTrail.title}
            foot={
              <button type="button" className="a2s-matte a2s-btn a2s-btn-sm">
                {DONE.paperTrail.link}
              </button>
            }
          >
            <ul className="a2s-rail-rows">
              {DONE.paperTrail.items.map((item) => (
                <li key={item.name}>
                  <span className="a2s-rail-top">
                    <span className="a2s-rail-name" style={{ fontSize: 15 }}>
                      {item.name}
                    </span>
                  </span>
                  <span className="a2s-dim">{item.meta}</span>
                </li>
              ))}
            </ul>
          </Sheet>
        </div>
      </div>
    </>
  );
}
