"use client";

import { useState } from "react";

const BADGES = [
  {
    id: "first-light",
    title: "First Light",
    detail: "Your first recorded support",
    earned: "12 October 2025",
    mark: "logo",
    tone: "coral",
  },
  {
    id: "steady-hand",
    title: "Steady Hand",
    detail: "30 active support days",
    earned: "18 January 2026",
    mark: "30",
    tone: "blue",
  },
  {
    id: "safe-harbour",
    title: "Safe Harbour",
    detail: "25 accommodation referrals",
    earned: "22 May 2026",
    mark: "⌂",
    tone: "sunset",
  },
  {
    id: "hundred-hearts",
    title: "Hundred Hearts",
    detail: "100 women supported",
    earned: "28 August 2026",
    mark: "100",
    tone: "ember",
  },
] as const;

export function ContributionBadges() {
  const [flipped, setFlipped] = useState<string | null>(null);

  return (
    <div className="a2s-badges-section">
      <div className="a2s-badges-heading">
        <div>
          <span className="a2s-plan-eyebrow">Milestones</span>
          <h2>Your badges</h2>
        </div>
      </div>

      <div className="a2s-badge-gallery">
        {BADGES.map((badge) => {
          const isFlipped = flipped === badge.id;
          return (
            <button
              type="button"
              className={`a2s-achievement-badge is-${badge.tone}${isFlipped ? " is-flipped" : ""}`}
              key={badge.id}
              aria-pressed={isFlipped}
              aria-label={`${badge.title}. ${isFlipped ? `Earned ${badge.earned}` : `${badge.detail}. Select to see the date.`}`}
              onClick={() => setFlipped(isFlipped ? null : badge.id)}
            >
              <span className="a2s-achievement-inner">
                <span className="a2s-achievement-face is-front">
                  <span className="a2s-medal" aria-hidden="true">
                    <span className="a2s-medal-orbit" />
                    {badge.mark === "logo" ? (
                      // eslint-disable-next-line @next/next/no-img-element -- existing local logo asset
                      <img src="/lou-logo.png" alt="" />
                    ) : <b>{badge.mark}</b>}
                  </span>
                  <strong>{badge.title}</strong>
                  <small>{badge.detail}</small>
                </span>
                <span className="a2s-achievement-face is-back">
                  <span>Earned</span>
                  <strong>{badge.earned}</strong>
                  <small>{badge.detail}</small>
                  <i aria-hidden="true">↻</i>
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
