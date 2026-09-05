"use client";

import { useState } from "react";
import { Sheet } from "./Sheet";
import { WORKING } from "../../lib/a2-mock";

/**
 * A2 / Working. The activity rail is the difference between the two frames
 * (137:27 with activity, 137:211 without), so it toggles here.
 */
export function WorkingView() {
  const [showActivity, setShowActivity] = useState(true);
  const [draft, setDraft] = useState(WORKING.approval.draft);
  const [decision, setDecision] = useState<"sent" | "skipped" | null>(null);

  return (
    <>
      <header className="a2s-head">
        <h1 style={{ fontSize: 22, lineHeight: 1.35, maxWidth: 820 }}>{WORKING.ask}</h1>
        <p className="a2s-sub" style={{ fontSize: 15 }}>
          {WORKING.status}
        </p>
      </header>

      <div className="a2s-btn-row" style={{ marginBottom: 20 }}>
        <button
          type="button"
          className="a2s-matte a2s-btn a2s-btn-sm"
          aria-pressed={showActivity}
          onClick={() => setShowActivity(!showActivity)}
        >
          {showActivity ? "Hide activity" : "Show activity"}
        </button>
      </div>

      <div className="a2s-grid">
        <Sheet note={WORKING.footNote}>
          <ul className="a2s-rows">
            {WORKING.steps.map((step) => (
              <li key={step.title}>
                <span className="a2s-row-left">
                  {step.state === "running" ? (
                    <span className="a2s-spinner" aria-hidden="true" />
                  ) : (
                    <span className="a2s-ring" aria-hidden="true" />
                  )}
                  <span className="a2s-row-text">
                    <span className="a2s-step-title">{step.title}</span>
                    <span className="a2s-row-detail">{step.detail}</span>
                    {step.lines && (
                      <span className="a2s-mono-lines">
                        {step.lines.map((line) => (
                          <span key={line}>{line}</span>
                        ))}
                      </span>
                    )}
                  </span>
                </span>
                <span className="a2s-row-meta">{step.time}</span>
              </li>
            ))}
          </ul>

          <div className="a2s-sheet" style={{ margin: "16px 0", padding: 18 }}>
            <div className="a2s-sheet-head">
              <span className="a2s-tag is-accent">{WORKING.approval.badge}</span>
              <span className="a2s-row-meta">{WORKING.approval.time}</span>
            </div>
            <p className="a2s-step-title" style={{ margin: "0 0 4px" }}>
              {WORKING.approval.title}
            </p>
            <textarea
              className="a2s-draft"
              rows={4}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              aria-label={WORKING.approval.title}
            />
            <p className="a2s-dim">{WORKING.approval.note}</p>
            <div className="a2s-btn-row" style={{ marginTop: 12 }}>
              <button
                type="button"
                className="a2s-btn-primary"
                onClick={() => setDecision("sent")}
              >
                {WORKING.approval.primary}
              </button>
              <button
                type="button"
                className="a2s-matte a2s-btn"
                onClick={() => setDecision("skipped")}
              >
                {WORKING.approval.secondary}
              </button>
            </div>
            {decision && (
              <p className="a2s-sheet-note" data-testid="approval-outcome">
                {decision === "sent"
                  ? "Sent · saved to Maya's file as an SMS"
                  : "Skipped · nothing was sent"}
              </p>
            )}
          </div>

          <ul className="a2s-rows">
            <li>
              <span className="a2s-row-left">
                <span className="a2s-ring" aria-hidden="true" />
                <span className="a2s-row-text">
                  <span className="a2s-step-title">{WORKING.queued.title}</span>
                  <span className="a2s-row-detail">{WORKING.queued.detail}</span>
                </span>
              </span>
              <span className="a2s-row-meta">{WORKING.queued.meta}</span>
            </li>
          </ul>
        </Sheet>

        <div className="a2s-rail">
          {showActivity ? (
            <Sheet
              title={WORKING.activity.title}
              action={<span className="a2s-tag is-accent">{WORKING.activity.badge}</span>}
            >
              <div className="a2s-mono-lines" data-testid="activity-rail">
                {WORKING.activity.lines.map((line) => (
                  <span key={line}>{line}</span>
                ))}
              </div>
            </Sheet>
          ) : (
            <Sheet>
              <p className="a2s-fact">{WORKING.sourcesInline}</p>
              <p className="a2s-tag is-accent" style={{ display: "inline-block", marginTop: 12 }}>
                {WORKING.activity.badge}
              </p>
            </Sheet>
          )}

          {showActivity && (
            <Sheet title={WORKING.sources.title}>
              <ul className="a2s-rail-rows">
                {WORKING.sources.items.map((source) => (
                  <li key={source.name}>
                    <span className="a2s-rail-top">
                      <span className="a2s-fact" style={{ color: "var(--ink)" }}>
                        {source.name}
                      </span>
                    </span>
                    <span className="a2s-dim">{source.meta}</span>
                  </li>
                ))}
              </ul>
            </Sheet>
          )}
        </div>
      </div>
    </>
  );
}
