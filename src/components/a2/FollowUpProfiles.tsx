"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { FollowUpProfile } from "../../lib/a2/follow-ups";

const FILTERS = [
  "All",
  "Overdue",
  "Location",
  "Children",
  "Pets",
  "Income",
  "Language",
  "Visa",
] as const;
type Filter = (typeof FILTERS)[number];

/** Filterable referral communication history. It does not represent the five-step intake journey. */
export function FollowUpProfiles({ profiles }: { profiles: FollowUpProfile[] }) {
  const [filter, setFilter] = useState<Filter>("All");
  const visible = useMemo(
    () =>
      profiles.filter((profile) => {
        if (filter === "All") return true;
        if (filter === "Overdue") return profile.referrals.some((referral) => referral.overdue);
        return profile.pills.some((pill) => pill.startsWith(`${filter} ·`));
      }),
    [filter, profiles],
  );

  const rows = visible.flatMap((profile) =>
    profile.referrals.map((referral) => ({ profile, referral })),
  );

  return (
    <>
      <div className="a2s-filters" aria-label="Filter follow-up history">
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

      {rows.length > 0 ? (
        <div className="a2s-table-scroll">
          <table className="a2s-table a2s-followup-table">
            <thead>
              <tr>
                <th>Person</th>
                <th>Community service</th>
                <th>Status</th>
                <th>Sent</th>
                <th>Next follow-up</th>
                <th aria-label="Action" />
              </tr>
            </thead>
            <tbody>
              {rows.map(({ profile, referral }) => (
                <tr key={referral.id}>
                  <td className="is-name">
                    <Link href={`/clients/${profile.id}`}>{profile.name}</Link>
                    <span className="a2s-table-sub">{profile.ref}</span>
                  </td>
                  <td>{referral.service}</td>
                  <td>{referral.result}</td>
                  <td>{referral.sent}</td>
                  <td className={referral.overdue ? "is-overdue" : undefined}>
                    {referral.followUp}
                  </td>
                  <td>
                    <Link
                      className="a2s-matte a2s-btn a2s-btn-sm"
                      href={`/follow-ups/${profile.id}`}
                    >
                      View history
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="a2s-empty">No follow-up history matches this filter.</p>
      )}
    </>
  );
}
