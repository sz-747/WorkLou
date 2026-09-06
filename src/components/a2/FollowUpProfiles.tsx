"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

export type FollowUpProfile = {
  id: string;
  name: string;
  ref: string;
  pills: string[];
  referrals: {
    id: string;
    service: string;
    email: string | null;
    sent: string;
    result: string;
    followUp: string;
    overdue: boolean;
  }[];
};

const FILTERS = ["All", "Overdue", "Language", "Children", "Income"] as const;
type Filter = (typeof FILTERS)[number];

/** Client-side pills narrow the referral profiles without fetching or changing case data. */
export function FollowUpProfiles({ profiles }: { profiles: FollowUpProfile[] }) {
  const [filter, setFilter] = useState<Filter>("All");
  const visible = useMemo(() => profiles.filter((profile) => {
    if (filter === "All") return true;
    if (filter === "Overdue") return profile.referrals.some((r) => r.overdue);
    return profile.pills.some((pill) => pill.startsWith(`${filter} ·`));
  }), [filter, profiles]);

  return (
    <>
      <div className="a2s-filters" aria-label="Filter follow-up profiles">
        {FILTERS.map((option) => (
          <button
            key={option}
            type="button"
            className="a2s-matte a2s-filter"
            aria-pressed={filter === option}
            onClick={() => setFilter(option)}
          >
            {option}
          </button>
        ))}
      </div>

      <div className="a2s-followup-profiles">
        {visible.map((profile) => (
          <article className="a2s-sheet a2s-followup-profile" key={profile.id}>
            <div className="a2s-sheet-head">
              <div>
                <h2><Link className="a2s-link" href={`/clients/${profile.id}`}>{profile.name}</Link></h2>
                <p className="a2s-dim">{profile.ref}</p>
              </div>
              <Link className="a2s-link" href={`/clients/${profile.id}/workflow`}>Casework</Link>
            </div>
            {profile.pills.length > 0 && (
              <div className="a2s-chips a2s-followup-chips">
                {profile.pills.map((pill) => <span className="a2s-chip" key={pill}>{pill}</span>)}
              </div>
            )}
            <div className="a2s-followup-history">
              {profile.referrals.map((referral) => (
                <section className="a2s-followup-referral" key={referral.id}>
                  <div className="a2s-rail-top">
                    <strong>{referral.service}</strong>
                    <span className={referral.overdue ? "a2s-row-meta is-overdue" : "a2s-row-meta"}>{referral.followUp}</span>
                  </div>
                  <p><b>Sent email:</b> {referral.email ?? "No saved email text"} <span className="a2s-dim">· {referral.sent}</span></p>
                  <p><b>Result:</b> {referral.result}</p>
                </section>
              ))}
            </div>
          </article>
        ))}
        {visible.length === 0 && <p className="a2s-empty">No people match this filter.</p>}
      </div>
    </>
  );
}
