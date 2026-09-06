"use client";

import { useState } from "react";
import { SHELTERS } from "../../lib/a2-mock";

/**
 * A2 / Shelters · ask (146:47): the ask field plus the eligible-for-Maya
 * result cards it reveals. "Find shelters" runs the mock match.
 */
export function ShelterAsk() {
  const [value, setValue] = useState(SHELTERS.ask.value);
  const [shown, setShown] = useState(false);

  return (
    <>
      <div className="a2s-ask-long a2s-matte" style={{ borderRadius: 20, maxWidth: "none" }}>
        <textarea
          rows={2}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          aria-label="Describe who needs accommodation"
        />
        <div className="a2s-btn-row">
          <button
            type="button"
            className="a2s-btn-primary"
            onClick={() => setShown(true)}
          >
            {SHELTERS.ask.button}
          </button>
        </div>
      </div>

      {shown && (
        <section className="a2s-sheet" data-testid="shelter-ask-results" style={{ marginTop: 16 }}>
          <div className="a2s-sheet-head">
            <h2>{SHELTERS.ask.resultsTitle}</h2>
          </div>
          <p className="a2s-sheet-note" style={{ margin: "0 0 12px" }}>
            {SHELTERS.ask.resultsNote}
          </p>

          <div className="a2s-cols-3">
            {SHELTERS.ask.results.map((result) => (
              <div className="a2s-sheet" key={result.name} style={{ padding: 18 }}>
                <div className="a2s-sheet-head">
                  <h2>{result.name}</h2>
                  <span className="a2s-tag">{result.badge}</span>
                </div>
                <p className="a2s-fact" style={{ margin: "0 0 10px" }}>
                  {result.area}
                </p>
                <p className="a2s-spotlight-label">Takes</p>
                <p className="a2s-fact">{result.takes}</p>
                <p className="a2s-spotlight-label">Accommodation availability</p>
                <p className="a2s-fact">{result.capacity}</p>
                <p className="a2s-spotlight-label">Why</p>
                <p className="a2s-fact">{result.why}</p>
                <div className="a2s-btn-row" style={{ marginTop: 14 }}>
                  <button type="button" className="a2s-matte a2s-btn a2s-btn-sm">
                    {result.action}
                  </button>
                </div>
                {result.actionNote && <p className="a2s-sheet-note">{result.actionNote}</p>}
              </div>
            ))}
          </div>

          <div className="a2s-sheet-foot">
            <button type="button" className="a2s-linkish">
              {SHELTERS.ask.notEligible}
            </button>
            <p className="a2s-sheet-note">{SHELTERS.ask.notEligibleNote}</p>
          </div>
        </section>
      )}
    </>
  );
}
