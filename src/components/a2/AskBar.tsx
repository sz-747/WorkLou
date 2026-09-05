"use client";

import { useState } from "react";
import { ASK_PLACEHOLDER, SEARCH_RESULT } from "../../lib/a2-mock";
import { ReturnGlyph, SearchGlyph } from "./glyphs";

/**
 * Spotlight / Bar on Today (136:139) plus the inline client result from
 * A2 / Today · search (138:2): typing a client's name reveals the match card.
 */
export function AskBar() {
  const [value, setValue] = useState("");
  const matches =
    value.trim().length > 1 &&
    `${SEARCH_RESULT.name} ${SEARCH_RESULT.line1}`
      .toLowerCase()
      .includes(value.trim().toLowerCase());

  return (
    <>
      <div className="a2s-ask a2s-matte">
        <SearchGlyph />
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={ASK_PLACEHOLDER}
          aria-label={ASK_PLACEHOLDER}
        />
        <button type="button" className="a2s-ask-go" aria-label="Run">
          <ReturnGlyph />
        </button>
      </div>

      {matches && (
        <div className="a2s-results" data-testid="a2-search-result">
          <div className="a2s-result-head">
            <span className="a2s-avatar">{SEARCH_RESULT.initials}</span>
            <span className="a2s-row-text">
              <span className="a2s-result-name">{SEARCH_RESULT.name}</span>
              <span className="a2s-result-line">{SEARCH_RESULT.line1}</span>
              <span className="a2s-result-line">{SEARCH_RESULT.line2}</span>
            </span>
          </div>

          <p className="a2s-spotlight-label">{SEARCH_RESULT.filesLabel}</p>
          <div className="a2s-chips">
            {SEARCH_RESULT.files.map((file) => (
              <span className="a2s-chip" key={file}>
                {file}
              </span>
            ))}
          </div>

          <div className="a2s-btn-row" style={{ marginTop: 16 }}>
            {SEARCH_RESULT.actions.map((action) => (
              <button type="button" className="a2s-matte a2s-btn" key={action}>
                {action}
              </button>
            ))}
            <button type="button" className="a2s-matte a2s-btn a2s-btn-sm">
              {SEARCH_RESULT.secondary}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
