import Link from "next/link";
import { AskBar } from "../../../components/a2/AskBar";
import { RailRow, Row, Sheet } from "../../../components/a2/Sheet";
import { Empty } from "../../../components/a2/Empty";
import { getTodayView } from "../../../lib/a2/today";
import { getAccommodationAvailability } from "../../../lib/a2/capacity";

/**
 * A2 / Today (136:139). Needs attention and follow-ups come from the casework
 * tables. Accommodation availability shows only provider-confirmed
 * capacity — the service import carries wait times, never bed counts.
 */
export const dynamic = "force-dynamic";

export default async function Today() {
  const [today, availability] = await Promise.all([
    getTodayView(),
    getAccommodationAvailability(),
  ]);

  return (
    <>
      <header className="a2s-head">
        <h1>Today at Lou&apos;s</h1>
        <p className="a2s-sub">{today.subline}</p>
      </header>

      <AskBar />

      <div className="a2s-grid">
        <Sheet title={`Needs attention · ${today.needsAttention.length}`}>
          {today.needsAttention.length === 0 ? (
            <Empty>Nothing needs attention.</Empty>
          ) : (
            <ul className="a2s-rows">
              {today.needsAttention.map((row) => (
                <Row
                  key={row.key}
                  title={row.name}
                  detail={row.detail}
                  meta={row.meta}
                  metaTone={row.overdue ? "overdue" : "muted"}
                />
              ))}
            </ul>
          )}

          <p className="a2s-group-label">Follow-ups due</p>
          {today.followUps.length === 0 ? (
            <Empty>No follow-ups due today.</Empty>
          ) : (
            <ul className="a2s-rows">
              {today.followUps.map((row) => (
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
          <Sheet
            title="Accommodation availability"
            note="Only what a provider confirmed, and when. We do not track bed counts."
            foot={
              <Link className="a2s-link" href="/shelters">
                All services
              </Link>
            }
          >
            {availability.length === 0 ? (
              <Empty>No accommodation services in the database yet.</Empty>
            ) : (
              <ul className="a2s-rail-rows">
                {availability.map((service) => (
                  <RailRow
                    key={service.id}
                    name={service.name}
                    meta={service.status}
                    detail={service.detail}
                    unknown={service.unknown || service.stale}
                  />
                ))}
              </ul>
            )}
          </Sheet>


        </div>
      </div>
    </>
  );
}
