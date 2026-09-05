import { Row, Sheet } from "../../../components/a2/Sheet";
import { Empty } from "../../../components/a2/Empty";
import { getFollowUpRows, getWaitingRows } from "../../../lib/a2/follow-ups";

/**
 * Follow-ups. No dedicated Figma frame exists for this nav item, so it reuses
 * Today's "Follow-ups due" rows and My clients' "Waiting on a service" sheet.
 * Data: Phase 6 referrals + referral events.
 */
export const dynamic = "force-dynamic";

export default async function FollowUps() {
  const [due, waiting] = await Promise.all([getFollowUpRows(), getWaitingRows()]);

  return (
    <>
      <header className="a2s-head">
        <h1>Follow-ups</h1>
        <p className="a2s-sub">
          {due.length} due · {waiting.length} waiting on a service
        </p>
      </header>

      <div className="a2s-grid">
        <Sheet title="Follow-ups due">
          {due.length === 0 ? (
            <Empty>Nothing due. Follow-ups appear here once a referral is sent.</Empty>
          ) : (
            <ul className="a2s-rows">
              {due.map((row) => (
                <Row
                  key={row.key}
                  title={row.name}
                  detail={row.detail}
                  meta={row.meta}
                  metaTone={row.overdue ? "overdue" : "ink"}
                />
              ))}
            </ul>
          )}
        </Sheet>

        <div className="a2s-rail">
          <Sheet title="Waiting on a service">
            {waiting.length === 0 ? (
              <Empty>No referrals are out with a provider.</Empty>
            ) : (
              <ul className="a2s-rail-rows">
                {waiting.map((item) => (
                  <li key={item.key}>
                    <span className="a2s-rail-top">
                      <span className="a2s-rail-name">{item.name}</span>
                    </span>
                    <span className="a2s-rail-detail">{item.detail}</span>
                  </li>
                ))}
              </ul>
            )}
          </Sheet>
        </div>
      </div>
    </>
  );
}
