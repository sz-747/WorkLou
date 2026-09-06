import Link from "next/link";
import { Empty } from "../../../components/a2/Empty";
import { FollowUpProfiles } from "../../../components/a2/FollowUpProfiles";
import { Sheet } from "../../../components/a2/Sheet";
import { getFollowUpProfiles, getFollowUpRows } from "../../../lib/a2/follow-ups";

/** Follow-ups is a searchable history of referral emails and recorded actions. */
export const dynamic = "force-dynamic";

export default async function FollowUps() {
  const [due, profiles] = await Promise.all([getFollowUpRows(), getFollowUpProfiles()]);

  return (
    <>
      <header className="a2s-head">
        <h1>Follow-ups</h1>
        <p className="a2s-sub">
          Referral emails, service replies and recorded actions for {profiles.length} people
        </p>
      </header>

      <div className="a2s-grid">
        <Sheet title="Communication history" note="Filter using details stored with each person in Postgres.">
          <FollowUpProfiles profiles={profiles} />
        </Sheet>

        <aside className="a2s-rail">
          <Sheet title={`Due now · ${due.length}`}>
            {due.length === 0 ? (
              <Empty>Nothing needs follow-up right now.</Empty>
            ) : (
              <ul className="a2s-rail-rows">
                {due.map((row) => (
                  <li key={row.key}>
                    <span className="a2s-rail-top">
                      <span className="a2s-rail-name">{row.name}</span>
                      <Link className="a2s-rail-meta" href={`/follow-ups/${row.caseId}`}>
                        Open
                      </Link>
                    </span>
                    <span className="a2s-rail-detail">{row.detail}</span>
                    <span className={row.overdue ? "a2s-row-meta is-overdue" : "a2s-row-meta is-ink"}>
                      {row.meta}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Sheet>
        </aside>
      </div>
    </>
  );
}
